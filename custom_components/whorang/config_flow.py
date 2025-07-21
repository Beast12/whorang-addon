"""Config flow for WhoRang AI Doorbell integration."""
from __future__ import annotations

import ipaddress
import logging
import urllib.parse
from typing import Any, Dict, Optional, Tuple

import aiohttp
import voluptuous as vol
from homeassistant import config_entries
from homeassistant.const import CONF_HOST, CONF_PORT
from homeassistant.core import HomeAssistant, callback
from homeassistant.data_entry_flow import FlowResult, FlowResultType
from homeassistant.exceptions import HomeAssistantError

from .api_client import WhoRangAPIClient, WhoRangConnectionError, WhoRangAuthError
from .const import (
    DOMAIN,
    CONF_API_KEY,
    CONF_URL,
    CONF_USE_SSL,
    CONF_VERIFY_SSL,
    CONF_UPDATE_INTERVAL,
    CONF_ENABLE_WEBSOCKET,
    CONF_ENABLE_COST_TRACKING,
    CONF_OLLAMA_HOST,
    CONF_OLLAMA_PORT,
    CONF_OLLAMA_ENABLED,
    DEFAULT_PORT,
    DEFAULT_UPDATE_INTERVAL,
    DEFAULT_OLLAMA_HOST,
    DEFAULT_OLLAMA_PORT,
    ADDON_DETECTION_HOSTS,
    ADDON_DETECTION_PORTS,
    ERROR_CANNOT_CONNECT,
    ERROR_INVALID_AUTH,
    ERROR_INVALID_URL,
    ERROR_SSL_ERROR,
    ERROR_TIMEOUT,
    ERROR_UNKNOWN,
)

_LOGGER = logging.getLogger(__name__)


def parse_whorang_url(url_input: str) -> Tuple[str, int, bool]:
    """Parse WhoRang URL input and return (host, port, use_ssl)."""
    
    # Check for empty input
    if not url_input or not url_input.strip():
        raise ValueError("URL cannot be empty")
    
    url_input = url_input.strip()
    
    # Handle full URLs
    if url_input.startswith(('http://', 'https://')):
        parsed = urllib.parse.urlparse(url_input)
        host = parsed.hostname
        port = parsed.port
        use_ssl = parsed.scheme == 'https'
        
        if host is None or not host:
            raise ValueError("Invalid URL: missing hostname")
        
        # Default ports
        if port is None:
            port = 443 if use_ssl else 80
            
        return host, port, use_ssl
    
    # Handle IP:port format
    elif ':' in url_input:
        host, port_str = url_input.split(':', 1)
        if not host:
            raise ValueError("Invalid URL: missing hostname")
        try:
            port = int(port_str)
            # Assume HTTP for IP:port unless port 443
            use_ssl = port == 443
            return host, port, use_ssl
        except ValueError:
            raise ValueError("Invalid port number")
    
    # Handle hostname only
    else:
        if not url_input:
            raise ValueError("Invalid URL: missing hostname")
        # Default to HTTPS for hostnames, HTTP for IP addresses
        try:
            ipaddress.ip_address(url_input)
            # It's an IP address, default to HTTP:3001
            return url_input, DEFAULT_PORT, False
        except ValueError:
            # It's a hostname, default to HTTPS:443
            return url_input, 443, True


STEP_USER_DATA_SCHEMA = vol.Schema(
    {
        vol.Required(CONF_URL, description="WhoRang URL"): str,
        vol.Optional(CONF_API_KEY, description="API Key (optional)"): str,
        vol.Optional(CONF_VERIFY_SSL, default=True): bool,
    }
)

STEP_OPTIONS_DATA_SCHEMA = vol.Schema(
    {
        vol.Optional(CONF_UPDATE_INTERVAL, default=DEFAULT_UPDATE_INTERVAL): vol.All(
            int, vol.Range(min=10, max=300)
        ),
        vol.Optional(CONF_ENABLE_WEBSOCKET, default=True): bool,
        vol.Optional(CONF_ENABLE_COST_TRACKING, default=True): bool,
    }
)


async def validate_input(hass: HomeAssistant, data: Dict[str, Any]) -> Dict[str, Any]:
    """Validate the user input allows us to connect.

    Data has the keys from STEP_USER_DATA_SCHEMA with values provided by the user.
    """
    try:
        # Parse URL input
        host, port, use_ssl = parse_whorang_url(data[CONF_URL])
        api_key = data.get(CONF_API_KEY)
        verify_ssl = data.get(CONF_VERIFY_SSL, True)

        api_client = WhoRangAPIClient(
            host=host,
            port=port,
            use_ssl=use_ssl,
            api_key=api_key,
            verify_ssl=verify_ssl
        )

        # Test the connection
        is_valid = await api_client.validate_connection()
        if not is_valid:
            raise CannotConnect("Failed to connect to WhoRang system")

        # Get system info for additional validation
        system_info = await api_client.get_system_info()
        
        # Return info that you want to store in the config entry.
        return {
            "title": f"WhoRang ({host}:{port})",
            "system_info": system_info,
            "parsed_data": {
                CONF_HOST: host,
                CONF_PORT: port,
                CONF_USE_SSL: use_ssl,
                CONF_VERIFY_SSL: verify_ssl,
                CONF_API_KEY: api_key,
                CONF_URL: data[CONF_URL],  # Store original URL for reference
            }
        }
    except ValueError as err:
        raise InvalidURL(str(err)) from err
    except WhoRangAuthError as err:
        raise InvalidAuth from err
    except WhoRangConnectionError as err:
        raise CannotConnect from err
    except Exception as err:
        _LOGGER.exception("Unexpected exception")
        raise CannotConnect from err
    finally:
        if 'api_client' in locals():
            await api_client.close()


class ConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for WhoRang AI Doorbell."""

    VERSION = 1

    def __init__(self) -> None:
        """Initialize the config flow."""
        self._discovered_info: Optional[Dict[str, Any]] = None
        self._config_data: Optional[Dict[str, Any]] = None

    async def async_step_user(
        self, user_input: Optional[Dict[str, Any]] = None
    ) -> FlowResult:
        """Handle the initial step."""
        errors: Dict[str, str] = {}

        # Try auto-discovery first if no user input
        if user_input is None:
            discovered_backend = await self._async_try_auto_discovery()
            if discovered_backend:
                host, port = discovered_backend
                _LOGGER.info("Auto-discovered WhoRang addon at %s:%s", host, port)
                
                # Check if already configured
                await self.async_set_unique_id(f"{host}:{port}")
                self._abort_if_unique_id_configured()
                
                # Auto-configure with discovered backend
                self._config_data = {
                    "title": f"WhoRang Addon ({host}:{port})",
                    "parsed_data": {
                        CONF_HOST: host,
                        CONF_PORT: port,
                        CONF_USE_SSL: False,
                        CONF_VERIFY_SSL: True,
                        CONF_API_KEY: None,
                        CONF_URL: f"http://{host}:{port}",
                    }
                }
                return await self.async_step_ai_providers()

        if user_input is not None:
            try:
                info = await validate_input(self.hass, user_input)
                parsed_data = info["parsed_data"]
            except InvalidURL:
                errors["base"] = ERROR_INVALID_URL
            except CannotConnect:
                errors["base"] = ERROR_CANNOT_CONNECT
            except InvalidAuth:
                errors["base"] = ERROR_INVALID_AUTH
            except Exception:  # pylint: disable=broad-except
                _LOGGER.exception("Unexpected exception")
                errors["base"] = ERROR_UNKNOWN
            else:
                # Check if already configured using parsed host:port
                await self.async_set_unique_id(
                    f"{parsed_data[CONF_HOST]}:{parsed_data[CONF_PORT]}"
                )
                self._abort_if_unique_id_configured()

                # Store config data and proceed to AI providers step
                self._config_data = {
                    "title": info["title"],
                    "parsed_data": parsed_data
                }
                return await self.async_step_ai_providers()

        return self.async_show_form(
            step_id="user", data_schema=STEP_USER_DATA_SCHEMA, errors=errors
        )

    async def _async_try_auto_discovery(self) -> Optional[Tuple[str, int]]:
        """Try to auto-discover WhoRang addon backend."""
        _LOGGER.debug("Attempting auto-discovery of WhoRang addon backend")
        
        for host in ADDON_DETECTION_HOSTS:
            for port in ADDON_DETECTION_PORTS:
                try:
                    # Create a temporary API client to test connection
                    test_client = WhoRangAPIClient(host=host, port=port)
                    
                    # Test if this is a WhoRang backend
                    if await test_client.validate_connection():
                        _LOGGER.info("Auto-discovered WhoRang backend at %s:%s", host, port)
                        await test_client.close()
                        return (host, port)
                        
                    await test_client.close()
                    
                except Exception as err:
                    _LOGGER.debug("Auto-discovery failed for %s:%s - %s", host, port, err)
                    continue
        
        _LOGGER.debug("No WhoRang addon backend auto-discovered")
        return None

    async def async_step_ai_providers(self, user_input: Optional[Dict[str, Any]] = None) -> FlowResult:
        """Configure AI providers and API keys."""
        errors: Dict[str, str] = {}
        
        if user_input is not None:
            # Validate API keys for selected providers
            api_keys = {}
            for provider, api_key in user_input.items():
                if api_key and api_key.strip():
                    api_keys[provider] = api_key.strip()
            
            # Test API keys if provided
            if not api_keys or await self._test_api_keys(api_keys):
                # Create config entry with AI API keys
                final_data = self._config_data["parsed_data"].copy()
                final_data["ai_api_keys"] = api_keys
                
                return self.async_create_entry(
                    title=self._config_data["title"],
                    data=final_data
                )
            else:
                errors["base"] = "invalid_api_keys"
        
        return self.async_show_form(
            step_id="ai_providers",
            data_schema=vol.Schema({
                vol.Optional("openai_api_key", description="OpenAI API Key"): str,
                vol.Optional("claude_api_key", description="Anthropic Claude API Key"): str,
                vol.Optional("gemini_api_key", description="Google Gemini API Key"): str,
                vol.Optional("google_cloud_api_key", description="Google Cloud Vision API Key"): str,
            }),
            errors=errors,
            description_placeholders={
                "openai_help": "Get your API key from https://platform.openai.com/api-keys",
                "claude_help": "Get your API key from https://console.anthropic.com/",
                "gemini_help": "Get your API key from https://aistudio.google.com/app/apikey",
                "google_cloud_help": "Get your API key from Google Cloud Console"
            }
        )

    async def _test_api_keys(self, api_keys: Dict[str, str]) -> bool:
        """Test provided API keys."""
        try:
            for provider, api_key in api_keys.items():
                if not await self._test_single_api_key(provider, api_key):
                    _LOGGER.error("API key validation failed for provider: %s", provider)
                    return False
            return True
        except Exception as err:
            _LOGGER.error("API key testing failed: %s", err)
            return False

    async def _test_single_api_key(self, provider: str, api_key: str) -> bool:
        """Test a single API key."""
        try:
            if provider == "openai_api_key":
                return await self._test_openai_key(api_key)
            elif provider == "claude_api_key":
                return await self._test_claude_key(api_key)
            elif provider == "gemini_api_key":
                return await self._test_gemini_key(api_key)
            elif provider == "google_cloud_api_key":
                return await self._test_google_cloud_key(api_key)
            return True
        except Exception as err:
            _LOGGER.error("Failed to test API key for %s: %s", provider, err)
            return False

    async def _test_openai_key(self, api_key: str) -> bool:
        """Test OpenAI API key."""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    "https://api.openai.com/v1/models",
                    headers={"Authorization": f"Bearer {api_key}"},
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    return response.status == 200
        except Exception as err:
            _LOGGER.debug("OpenAI API key test failed: %s", err)
            return False

    async def _test_claude_key(self, api_key: str) -> bool:
        """Test Claude API key."""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": api_key,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json"
                    },
                    json={
                        "model": "claude-3-haiku-20240307",
                        "max_tokens": 1,
                        "messages": [{"role": "user", "content": "test"}]
                    },
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    # 200 is success, 400 is also OK for validation (means API key is valid but request format might be wrong)
                    return response.status in [200, 400]
        except Exception as err:
            _LOGGER.debug("Claude API key test failed: %s", err)
            return False

    async def _test_gemini_key(self, api_key: str) -> bool:
        """Test Gemini API key."""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}",
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    return response.status == 200
        except Exception as err:
            _LOGGER.debug("Gemini API key test failed: %s", err)
            return False

    async def _test_google_cloud_key(self, api_key: str) -> bool:
        """Test Google Cloud Vision API key."""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"https://vision.googleapis.com/v1/images:annotate?key={api_key}",
                    json={
                        "requests": [{
                            "image": {"content": ""},
                            "features": [{"type": "LABEL_DETECTION", "maxResults": 1}]
                        }]
                    },
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    # 400 is expected for empty image, but means API key is valid
                    return response.status in [200, 400]
        except Exception as err:
            _LOGGER.debug("Google Cloud Vision API key test failed: %s", err)
            return False

    async def async_step_discovery(
        self, discovery_info: Dict[str, Any]
    ) -> FlowResult:
        """Handle discovery of a WhoRang instance."""
        self._discovered_info = discovery_info
        
        # Check if already configured
        await self.async_set_unique_id(
            f"{discovery_info[CONF_HOST]}:{discovery_info[CONF_PORT]}"
        )
        self._abort_if_unique_id_configured()

        # Set title and show confirmation form
        self.context["title_placeholders"] = {
            "name": f"WhoRang ({discovery_info[CONF_HOST]})"
        }

        return await self.async_step_discovery_confirm()

    async def async_step_discovery_confirm(
        self, user_input: Optional[Dict[str, Any]] = None
    ) -> FlowResult:
        """Confirm discovery."""
        if user_input is not None:
            try:
                info = await validate_input(self.hass, self._discovered_info)
            except CannotConnect:
                return self.async_abort(reason=ERROR_CANNOT_CONNECT)
            except InvalidAuth:
                return self.async_abort(reason=ERROR_INVALID_AUTH)
            except Exception:  # pylint: disable=broad-except
                _LOGGER.exception("Unexpected exception")
                return self.async_abort(reason=ERROR_UNKNOWN)
            else:
                return self.async_create_entry(
                    title=info["title"], data=self._discovered_info
                )

        return self.async_show_form(
            step_id="discovery_confirm",
            description_placeholders={
                "host": self._discovered_info[CONF_HOST],
                "port": self._discovered_info[CONF_PORT],
            },
        )

    @staticmethod
    def async_get_options_flow(
        config_entry: config_entries.ConfigEntry,
    ) -> OptionsFlowHandler:
        """Create the options flow."""
        return OptionsFlowHandler(config_entry)


class OptionsFlowHandler(config_entries.OptionsFlow):
    """Handle options flow for WhoRang AI Doorbell."""

    def __init__(self, config_entry: config_entries.ConfigEntry) -> None:
        """Initialize options flow."""
        self.config_entry = config_entry
        _LOGGER.debug("OptionsFlowHandler initialized for entry: %s", config_entry.entry_id)

    async def async_step_init(
        self, user_input: Optional[Dict[str, Any]] = None
    ) -> FlowResult:
        """Manage the options - comprehensive configuration form."""
        _LOGGER.debug("Options flow init step called with input: %s", user_input)
        errors: Dict[str, str] = {}
        
        if user_input is not None:
            # Validate Ollama connection if provided
            ollama_host = user_input.get(CONF_OLLAMA_HOST, "").strip()
            ollama_port = user_input.get(CONF_OLLAMA_PORT, DEFAULT_OLLAMA_PORT)
            
            if ollama_host and ollama_host != "localhost":
                try:
                    if not await self._test_ollama_connection(ollama_host, ollama_port):
                        errors[CONF_OLLAMA_HOST] = "cannot_connect_ollama"
                except Exception:
                    errors[CONF_OLLAMA_HOST] = "invalid_ollama_config"
            
            # Collect and validate API keys
            api_keys = {}
            for key in ["openai_api_key", "claude_api_key", "gemini_api_key", "google_cloud_api_key"]:
                api_key = user_input.get(key, "").strip()
                if api_key:
                    api_keys[key] = api_key
            
            # Test API keys if provided
            if api_keys and not await self._test_api_keys(api_keys):
                errors["base"] = "invalid_api_keys"
            
            if not errors:
                # Update configuration
                new_data = dict(self.config_entry.data)
                
                # Update AI API keys
                new_data["ai_api_keys"] = api_keys
                
                # Update Ollama configuration
                new_data["ollama_config"] = {
                    "host": ollama_host if ollama_host else DEFAULT_OLLAMA_HOST,
                    "port": ollama_port,
                    "enabled": bool(ollama_host and ollama_host.strip())
                }
                
                # Collect intelligent automation settings
                intelligent_automation = {
                    "ai_prompt_template": user_input.get("ai_prompt_template", "professional"),
                    "custom_ai_prompt": user_input.get("custom_ai_prompt", ""),
                    "enable_weather_context": user_input.get("enable_weather_context", True),
                    "notification_template": user_input.get("notification_template", "rich_media"),
                    "custom_notification_template": user_input.get("custom_notification_template", ""),
                    "doorbell_sound_file": user_input.get("doorbell_sound_file", "/local/sounds/doorbell.mp3"),
                    "enable_tts": user_input.get("enable_tts", False),
                    "tts_service": user_input.get("tts_service", ""),
                }
                
                # Update general options
                new_options = {
                    CONF_UPDATE_INTERVAL: user_input.get(CONF_UPDATE_INTERVAL, DEFAULT_UPDATE_INTERVAL),
                    CONF_ENABLE_WEBSOCKET: user_input.get(CONF_ENABLE_WEBSOCKET, True),
                    CONF_ENABLE_COST_TRACKING: user_input.get(CONF_ENABLE_COST_TRACKING, True),
                    "intelligent_automation": intelligent_automation,
                }
                
                # Update config entry
                self.hass.config_entries.async_update_entry(
                    self.config_entry, 
                    data=new_data,
                    options=new_options
                )
                
                _LOGGER.info("Successfully updated WhoRang configuration")
                _LOGGER.debug("New options saved: %s", new_options)
                
                # Don't trigger coordinator refresh immediately to avoid connection issues
                # The coordinator will pick up the new config on next update cycle
                
                return self.async_create_entry(title="", data={})
        
        # Get current configuration with defaults
        current_keys = self.config_entry.data.get("ai_api_keys", {})
        current_ollama = self.config_entry.data.get("ollama_config", {})
        current_options = self.config_entry.options
        
        # Get current intelligent automation settings
        current_automation = self.config_entry.options.get("intelligent_automation", {})
        
        # Debug: Log current automation settings
        _LOGGER.debug("Current automation settings from config: %s", current_automation)
        _LOGGER.debug("Current AI prompt template: %s", current_automation.get("ai_prompt_template", "professional"))
        _LOGGER.debug("Full config entry options: %s", self.config_entry.options)
        
        # Auto-discover TTS services
        tts_services = [entity_id for entity_id in self.hass.states.async_entity_ids("tts")]
        tts_options = [""] + tts_services  # Empty option for "none"
        
        # Auto-discover media players
        media_players = [entity_id for entity_id in self.hass.states.async_entity_ids("media_player")]
        
        # Create comprehensive configuration schema
        data_schema = vol.Schema({
            # AI Provider API Keys Section
            vol.Optional(
                "openai_api_key", 
                default=current_keys.get("openai_api_key", "")
            ): str,
            vol.Optional(
                "claude_api_key",
                default=current_keys.get("claude_api_key", "")
            ): str,
            vol.Optional(
                "gemini_api_key",
                default=current_keys.get("gemini_api_key", "")
            ): str,
            vol.Optional(
                "google_cloud_api_key",
                default=current_keys.get("google_cloud_api_key", "")
            ): str,
            
            # Ollama Configuration Section
            vol.Optional(
                CONF_OLLAMA_HOST,
                default=current_ollama.get("host", DEFAULT_OLLAMA_HOST)
            ): str,
            vol.Optional(
                CONF_OLLAMA_PORT,
                default=current_ollama.get("port", DEFAULT_OLLAMA_PORT)
            ): vol.All(vol.Coerce(int), vol.Range(min=1, max=65535)),
            
            # Intelligent Automation Configuration Section
            vol.Optional(
                "ai_prompt_template",
                default=current_automation.get("ai_prompt_template", "professional")
            ): vol.In(["professional", "friendly", "sarcastic", "detailed", "custom"]),
            vol.Optional(
                "custom_ai_prompt",
                default=current_automation.get("custom_ai_prompt", "")
            ): str,
            vol.Optional(
                "enable_weather_context",
                default=current_automation.get("enable_weather_context", True)
            ): bool,
            vol.Optional(
                "notification_template",
                default=current_automation.get("notification_template", "rich_media")
            ): vol.In(["rich_media", "simple", "custom"]),
            vol.Optional(
                "custom_notification_template",
                default=current_automation.get("custom_notification_template", "")
            ): str,
            vol.Optional(
                "doorbell_sound_file",
                default=current_automation.get("doorbell_sound_file", "/local/sounds/doorbell.mp3")
            ): str,
            vol.Optional(
                "enable_tts",
                default=current_automation.get("enable_tts", False)
            ): bool,
            vol.Optional(
                "tts_service",
                default=current_automation.get("tts_service", "")
            ): vol.In(tts_options) if tts_options else str,
            
            # General Options Section
            vol.Optional(
                CONF_UPDATE_INTERVAL,
                default=current_options.get(CONF_UPDATE_INTERVAL, DEFAULT_UPDATE_INTERVAL),
            ): vol.All(int, vol.Range(min=10, max=300)),
            vol.Optional(
                CONF_ENABLE_WEBSOCKET,
                default=current_options.get(CONF_ENABLE_WEBSOCKET, True),
            ): bool,
            vol.Optional(
                CONF_ENABLE_COST_TRACKING,
                default=current_options.get(CONF_ENABLE_COST_TRACKING, True),
            ): bool,
        })
        
        _LOGGER.debug("Showing comprehensive options form")
        return self.async_show_form(
            step_id="init",
            data_schema=data_schema,
            errors=errors,
            description_placeholders={
                "info": "Configure API keys for external AI providers, Ollama settings for local processing, and general integration options."
            }
        )

    async def _test_api_keys(self, api_keys: Dict[str, str]) -> bool:
        """Test provided API keys."""
        try:
            for provider, api_key in api_keys.items():
                if not await self._test_single_api_key(provider, api_key):
                    _LOGGER.error("API key validation failed for provider: %s", provider)
                    return False
            return True
        except Exception as err:
            _LOGGER.error("API key testing failed: %s", err)
            return False

    async def _test_single_api_key(self, provider: str, api_key: str) -> bool:
        """Test a single API key."""
        try:
            if provider == "openai_api_key":
                return await self._test_openai_key(api_key)
            elif provider == "claude_api_key":
                return await self._test_claude_key(api_key)
            elif provider == "gemini_api_key":
                return await self._test_gemini_key(api_key)
            elif provider == "google_cloud_api_key":
                return await self._test_google_cloud_key(api_key)
            return True
        except Exception as err:
            _LOGGER.error("Failed to test API key for %s: %s", provider, err)
            return False

    async def _test_openai_key(self, api_key: str) -> bool:
        """Test OpenAI API key."""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    "https://api.openai.com/v1/models",
                    headers={"Authorization": f"Bearer {api_key}"},
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    return response.status == 200
        except Exception as err:
            _LOGGER.debug("OpenAI API key test failed: %s", err)
            return False

    async def _test_claude_key(self, api_key: str) -> bool:
        """Test Claude API key."""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": api_key,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json"
                    },
                    json={
                        "model": "claude-3-haiku-20240307",
                        "max_tokens": 1,
                        "messages": [{"role": "user", "content": "test"}]
                    },
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    return response.status in [200, 400]
        except Exception as err:
            _LOGGER.debug("Claude API key test failed: %s", err)
            return False

    async def _test_gemini_key(self, api_key: str) -> bool:
        """Test Gemini API key."""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}",
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    return response.status == 200
        except Exception as err:
            _LOGGER.debug("Gemini API key test failed: %s", err)
            return False

    async def _test_google_cloud_key(self, api_key: str) -> bool:
        """Test Google Cloud Vision API key."""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"https://vision.googleapis.com/v1/images:annotate?key={api_key}",
                    json={
                        "requests": [{
                            "image": {"content": ""},
                            "features": [{"type": "LABEL_DETECTION", "maxResults": 1}]
                        }]
                    },
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    return response.status in [200, 400]
        except Exception as err:
            _LOGGER.debug("Google Cloud Vision API key test failed: %s", err)
            return False

    async def _test_ollama_connection(self, host: str, port: int) -> bool:
        """Test Ollama connection."""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"http://{host}:{port}/api/tags",
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    return response.status == 200
        except Exception as e:
            _LOGGER.debug("Ollama connection test failed: %s", e)
            return False


class CannotConnect(HomeAssistantError):
    """Error to indicate we cannot connect."""


class InvalidAuth(HomeAssistantError):
    """Error to indicate there is invalid auth."""


class InvalidURL(HomeAssistantError):
    """Error to indicate there is an invalid URL."""
