"""API client for WhoRang AI Doorbell integration."""
from __future__ import annotations

import asyncio
import json
import logging
import ssl
from datetime import datetime
from typing import Any, Dict, List, Optional

import aiohttp

from .const import (
    API_HEALTH,
    API_VISITORS,
    API_STATS,
    API_CONFIG_WEBHOOK,
    API_FACES_CONFIG,
    API_FACES_PERSONS,
    API_DETECTED_FACES,
    API_OPENAI,
    DEFAULT_TIMEOUT,
)

_LOGGER = logging.getLogger(__name__)


class WhoRangAPIError(Exception):
    """Exception to indicate a general API error."""


class WhoRangConnectionError(WhoRangAPIError):
    """Exception to indicate a connection error."""


class WhoRangAuthError(WhoRangAPIError):
    """Exception to indicate an authentication error."""


class WhoRangAPIClient:
    """API client for WhoRang system."""

    def __init__(
        self,
        host: str,
        port: int,
        use_ssl: bool = False,
        api_key: Optional[str] = None,
        verify_ssl: bool = True,
        session: Optional[aiohttp.ClientSession] = None,
        timeout: int = DEFAULT_TIMEOUT,
        ollama_config: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Initialize the API client."""
        self.host = host
        self.port = port
        self.use_ssl = use_ssl
        self.verify_ssl = verify_ssl
        self.api_key = api_key
        self.timeout = timeout
        self.ollama_config = ollama_config or {
            "host": "localhost",
            "port": 11434,
            "enabled": False
        }
        self._session = session
        self._close_session = False
        self._ssl_context = None
        
        # Build base URL
        scheme = "https" if use_ssl else "http"
        if (use_ssl and port == 443) or (not use_ssl and port == 80):
            self.base_url = f"{scheme}://{host}"
        else:
            self.base_url = f"{scheme}://{host}:{port}"
        
        # Create SSL context during initialization to avoid blocking in async methods
        if self.use_ssl:
            self._ssl_context = self._create_ssl_context()
    
    def _create_ssl_context(self) -> ssl.SSLContext:
        """Create SSL context in sync method to avoid blocking warnings."""
        ssl_context = ssl.create_default_context()
        if not self.verify_ssl:
            # Disable SSL verification for self-signed certificates
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
        return ssl_context
        
    async def _get_session(self) -> aiohttp.ClientSession:
        """Get aiohttp session with SSL support."""
        if self._session is None or self._session.closed:
            connector = None
            if self.use_ssl and self._ssl_context:
                connector = aiohttp.TCPConnector(ssl=self._ssl_context)
            
            # Create session with proper timeout and headers
            timeout = aiohttp.ClientTimeout(total=self.timeout)
            self._session = aiohttp.ClientSession(
                connector=connector,
                timeout=timeout,
                headers=self._get_base_headers()
            )
            self._close_session = True
        return self._session
    
    def _get_base_headers(self) -> Dict[str, str]:
        """Get base headers for session."""
        return {
            "User-Agent": "HomeAssistant-WhoRang/1.0.0",
        }

    async def close(self) -> None:
        """Close the session."""
        if self._close_session and self._session:
            await self._session.close()

    def _get_headers(self) -> Dict[str, str]:
        """Get request headers."""
        headers = {
            "Content-Type": "application/json",
            "User-Agent": "HomeAssistant-WhoRang/1.0.0",
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    async def _request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Make an API request."""
        url = f"{self.base_url}{endpoint}"
        headers = self._get_headers()
        
        session = await self._get_session()
        
        try:
            async def make_request():
                async with session.request(
                    method,
                    url,
                    headers=headers,
                    json=data,
                    params=params,
                ) as response:
                    if response.status == 401:
                        raise WhoRangAuthError("Authentication failed")
                    elif response.status == 404:
                        raise WhoRangAPIError(f"Endpoint not found: {endpoint}")
                    elif response.status >= 400:
                        error_text = await response.text()
                        raise WhoRangAPIError(
                            f"API error {response.status}: {error_text}"
                        )
                    
                    if response.content_type == "application/json":
                        return await response.json()
                    else:
                        return {"data": await response.read()}
            
            return await asyncio.wait_for(make_request(), timeout=self.timeout)
                        
        except asyncio.TimeoutError as err:
            raise WhoRangConnectionError("Request timeout") from err
        except aiohttp.ClientError as err:
            raise WhoRangConnectionError(f"Connection error: {err}") from err

    async def get_health(self) -> Dict[str, Any]:
        """Get system health status."""
        try:
            return await self._request("GET", API_HEALTH)
        except Exception as err:
            _LOGGER.error("Failed to get health status: %s", err)
            raise

    async def get_visitors(
        self,
        page: int = 1,
        limit: int = 20,
        search: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get visitors with pagination."""
        params: Dict[str, Any] = {"page": page, "limit": limit}
        if search:
            params["search"] = search
            
        try:
            return await self._request("GET", API_VISITORS, params=params)
        except Exception as err:
            _LOGGER.error("Failed to get visitors: %s", err)
            raise

    async def get_latest_visitor(self) -> Optional[Dict[str, Any]]:
        """Get the latest visitor."""
        try:
            response = await self.get_visitors(page=1, limit=1)
            visitors = response.get("visitors", [])
            return visitors[0] if visitors else None
        except Exception as err:
            _LOGGER.error("Failed to get latest visitor: %s", err)
            return None

    async def get_visitor_by_id(self, visitor_id: str) -> Optional[Dict[str, Any]]:
        """Get a specific visitor by ID."""
        try:
            return await self._request("GET", f"{API_VISITORS}/{visitor_id}")
        except Exception as err:
            _LOGGER.error("Failed to get visitor %s: %s", visitor_id, err)
            return None

    async def get_stats(self) -> Dict[str, Any]:
        """Get visitor statistics."""
        try:
            return await self._request("GET", API_STATS)
        except Exception as err:
            _LOGGER.error("Failed to get stats: %s", err)
            raise

    async def get_detected_objects(self) -> Dict[str, Any]:
        """Get detected objects statistics."""
        try:
            return await self._request("GET", f"{API_VISITORS}/detected-objects")
        except Exception as err:
            _LOGGER.error("Failed to get detected objects: %s", err)
            raise

    async def get_webhook_config(self) -> Dict[str, Any]:
        """Get webhook configuration."""
        try:
            return await self._request("GET", API_CONFIG_WEBHOOK)
        except Exception as err:
            _LOGGER.error("Failed to get webhook config: %s", err)
            raise

    async def test_webhook(self) -> Dict[str, Any]:
        """Test webhook functionality."""
        try:
            return await self._request("POST", f"{API_CONFIG_WEBHOOK}/test")
        except Exception as err:
            _LOGGER.error("Failed to test webhook: %s", err)
            raise

    async def get_face_config(self) -> Dict[str, Any]:
        """Get face recognition configuration."""
        try:
            return await self._request("GET", API_FACES_CONFIG)
        except Exception as err:
            _LOGGER.error("Failed to get face config: %s", err)
            raise

    async def update_face_config(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Update face recognition configuration."""
        try:
            return await self._request("PUT", API_FACES_CONFIG, data=config)
        except Exception as err:
            _LOGGER.error("Failed to update face config: %s", err)
            raise

    async def get_known_persons(self) -> List[Dict[str, Any]]:
        """Get list of known persons with robust parsing."""
        try:
            response = await self._request("GET", API_FACES_PERSONS)
            
            # Handle different response formats
            if isinstance(response, list):
                # Direct list format (what PersonController returns)
                return response
            elif isinstance(response, dict):
                # Format: {"data": [...]} or {"persons": [...]} or {"known_persons": [...]}
                return (response.get("data") or 
                       response.get("persons") or 
                       response.get("known_persons") or [])
            else:
                _LOGGER.warning("Unexpected known persons response format: %s", type(response))
                return []
                
        except Exception as err:
            _LOGGER.error("Failed to get known persons: %s", err)
            return []

    async def create_person(self, name: str, notes: Optional[str] = None) -> Dict[str, Any]:
        """Create a new known person."""
        data = {"name": name}
        if notes:
            data["notes"] = notes
            
        try:
            return await self._request("POST", API_FACES_PERSONS, data=data)
        except Exception as err:
            _LOGGER.error("Failed to create person: %s", err)
            raise

    async def delete_person(self, person_id: int) -> Dict[str, Any]:
        """Delete a known person."""
        try:
            return await self._request("DELETE", f"{API_FACES_PERSONS}/{person_id}")
        except Exception as err:
            _LOGGER.error("Failed to delete person %s: %s", person_id, err)
            raise

    async def get_detected_faces(self) -> List[Dict[str, Any]]:
        """Get detected faces."""
        try:
            response = await self._request("GET", API_DETECTED_FACES)
            return response.get("faces", [])
        except Exception as err:
            _LOGGER.error("Failed to get detected faces: %s", err)
            return []

    async def get_ai_providers(self) -> List[Dict[str, Any]]:
        """Get available AI providers."""
        try:
            response = await self._request("GET", f"{API_OPENAI}/providers")
            return response.get("providers", [])
        except Exception as err:
            _LOGGER.error("Failed to get AI providers: %s", err)
            return []

    async def set_ai_provider(self, provider: str) -> Dict[str, Any]:
        """Set the active AI provider."""
        data = {"provider": provider}
        try:
            return await self._request("POST", f"{API_OPENAI}/provider", data=data)
        except Exception as err:
            _LOGGER.error("Failed to set AI provider: %s", err)
            raise

    async def set_ai_provider_with_key(self, provider: str, api_key: Optional[str] = None) -> bool:
        """Set AI provider with API key if required."""
        try:
            payload = {"provider": provider}
            if api_key and provider != "local":
                payload["api_key"] = api_key
            
            response = await self._request("POST", f"{API_OPENAI}/provider", data=payload)
            return response.get("success", False)
        except Exception as err:
            _LOGGER.error("Failed to set AI provider %s: %s", provider, err)
            return False

    async def get_available_providers(self) -> Dict[str, Any]:
        """Get available AI providers and their requirements."""
        try:
            response = await self._request("GET", f"{API_OPENAI}/providers")
            return response.get("data", {
                "local": {"requires_key": False},
                "openai": {"requires_key": True},
                "claude": {"requires_key": True},
                "gemini": {"requires_key": True},
                "google_cloud_vision": {"requires_key": True}
            })
        except Exception as err:
            _LOGGER.error("Failed to get AI providers: %s", err)
            return {
                "local": {"requires_key": False},
                "openai": {"requires_key": True},
                "claude": {"requires_key": True},
                "gemini": {"requires_key": True},
                "google_cloud_vision": {"requires_key": True}
            }

    async def trigger_analysis(self, visitor_id: Optional[str] = None) -> Dict[str, Any]:
        """Trigger AI analysis for a visitor or latest visitor."""
        endpoint = "/api/analysis/trigger"
        data = {}
        if visitor_id:
            data["visitor_id"] = visitor_id
            
        try:
            return await self._request("POST", endpoint, data=data)
        except Exception as err:
            _LOGGER.error("Failed to trigger analysis: %s", err)
            raise

    async def trigger_analysis_with_config(self, visitor_id: Optional[str] = None, ai_config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Trigger AI analysis for a visitor with AI template configuration."""
        endpoint = "/api/analysis/trigger"
        data = {}
        if visitor_id:
            data["visitor_id"] = visitor_id
        
        # Add AI template configuration if provided
        if ai_config:
            data.update(ai_config)
            
        try:
            return await self._request("POST", endpoint, data=data)
        except Exception as err:
            _LOGGER.error("Failed to trigger analysis with config: %s", err)
            raise

    async def get_latest_image(self) -> Optional[bytes]:
        """Get the latest doorbell image."""
        try:
            response = await self._request("GET", "/api/images/latest")
            if isinstance(response.get("data"), bytes):
                return response["data"]
            return None
        except Exception as err:
            _LOGGER.error("Failed to get latest image: %s", err)
            return None

    async def get_ai_usage_stats(self, days: int = 1) -> Dict[str, Any]:
        """Get AI usage statistics from the backend."""
        try:
            # Try the new dedicated AI endpoint first
            response = await self._request("GET", "/api/ai/usage", params={"days": days})
            
            if response and not response.get("error"):
                # The new endpoint returns data in the exact format we need
                return response
            
            # Fallback to the OpenAI endpoint if the new one doesn't exist yet
            _LOGGER.debug("New AI endpoint not available, trying OpenAI endpoint")
            period = "24h" if days == 1 else f"{days}d"
            response = await self._request("GET", "/api/openai/usage/stats", params={"period": period})
            
            if response:
                # Parse the backend response format
                overall_stats = response.get("overall_stats", [])
                budget = response.get("budget", {})
                
                # Calculate total cost across all providers
                total_cost = sum(stat.get("total_cost", 0) for stat in overall_stats)
                total_requests = sum(stat.get("total_requests", 0) for stat in overall_stats)
                
                # Create provider breakdown
                providers = []
                for stat in overall_stats:
                    providers.append({
                        "provider": stat.get("provider", "unknown"),
                        "cost": stat.get("total_cost", 0),
                        "requests": stat.get("total_requests", 0),
                        "tokens": stat.get("total_tokens", 0),
                        "avg_processing_time": stat.get("avg_processing_time", 0),
                        "success_rate": (stat.get("successful_requests", 0) / max(stat.get("total_requests", 1), 1)) * 100
                    })
                
                return {
                    "total_cost": total_cost,
                    "total_requests": total_requests,
                    "providers": providers,
                    "budget": {
                        "monthly_limit": budget.get("monthly_limit", 0),
                        "monthly_spent": budget.get("monthly_spent", 0),
                        "remaining": budget.get("remaining", 0)
                    },
                    "period": period
                }
            
            # Return default if no response
            return self._get_default_ai_usage_stats()
            
        except Exception as e:
            _LOGGER.error("Failed to get AI usage stats: %s", e)
            return self._get_default_ai_usage_stats()

    def _get_default_ai_usage_stats(self) -> Dict[str, Any]:
        """Return default AI usage statistics when no data is available."""
        return {
            "total_cost": 0.0,
            "total_requests": 0,
            "providers": [],
            "budget": {
                "monthly_limit": 0,
                "monthly_spent": 0,
                "remaining": 0
            },
            "period": "24h"
        }

    async def export_visitor_data(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        format_type: str = "json",
    ) -> Dict[str, Any]:
        """Export visitor data."""
        params = {"format": format_type}
        if start_date:
            params["start_date"] = start_date
        if end_date:
            params["end_date"] = end_date
            
        try:
            return await self._request("GET", "/api/export/visitors", params=params)
        except Exception as err:
            _LOGGER.error("Failed to export visitor data: %s", err)
            raise

    async def validate_connection(self) -> bool:
        """Validate connection to WhoRang system."""
        try:
            health = await self.get_health()
            status = health.get("status")
            # Accept both "ok" and "healthy" as valid status values
            return status in ("ok", "healthy")
        except Exception as err:
            _LOGGER.error("Connection validation failed: %s", err)
            return False

    async def get_available_models(self, provider: Optional[str] = None) -> Dict[str, Any]:
        """Get available models for AI providers."""
        try:
            endpoint = "/api/openai/models"
            if provider:
                endpoint = f"/api/openai/models/{provider}"
            
            response = await self._request("GET", endpoint)
            return response.get("data", self._get_default_models())
        except Exception as e:
            _LOGGER.error("Failed to get available models: %s", e)
            return self._get_default_models()

    def _get_default_models(self) -> Dict[str, List[str]]:
        """Return default model mappings based on frontend patterns."""
        return {
            "local": ["llava", "llava:7b", "llava:13b", "llava:34b", "bakllava", "cogvlm", "llama-vision"],
            "openai": [
                "gpt-4o",
                "gpt-4o-mini", 
                "gpt-4-turbo",
                "gpt-4-vision-preview",
                "gpt-3.5-turbo"
            ],
            "claude": [
                "claude-3-5-sonnet-20241022",
                "claude-3-5-haiku-20241022", 
                "claude-3-opus-20240229",
                "claude-3-sonnet-20240229",
                "claude-3-haiku-20240307"
            ],
            "gemini": [
                "gemini-1.5-pro",
                "gemini-1.5-flash",
                "gemini-1.0-pro-vision",
                "gemini-1.0-pro"
            ],
            "google-cloud-vision": [
                "vision-api-v1",
                "vision-api-v1p1beta1",
                "vision-api-v1p2beta1"
            ]
        }

    async def set_ai_model(self, model: str) -> bool:
        """Set the active AI model."""
        try:
            response = await self._request("POST", "/api/openai/model", data={"model": model})
            return response.get("success", False)
        except Exception as e:
            _LOGGER.error("Failed to set AI model %s: %s", model, e)
            return False

    async def get_current_ai_model(self) -> str:
        """Get currently selected AI model."""
        try:
            response = await self._request("GET", "/api/openai/model/current")
            return response.get("data", {}).get("model", "default")
        except Exception as e:
            _LOGGER.error("Failed to get current AI model: %s", e)
            return "default"

    async def get_provider_models(self, provider: str) -> List[str]:
        """Get available models for specific provider."""
        try:
            response = await self._request("GET", f"/api/openai/models/{provider}")
            return response.get("data", [])
        except Exception as e:
            _LOGGER.error("Failed to get models for provider %s: %s", provider, e)
            default_models = self._get_default_models()
            return default_models.get(provider, [])

    async def get_ollama_models(self) -> List[Dict[str, Any]]:
        """Get available Ollama models using configured host/port."""
        if not self.ollama_config.get("enabled", False):
            _LOGGER.debug("Ollama not enabled in configuration")
            return []
            
        ollama_host = self.ollama_config.get("host", "localhost")
        ollama_port = self.ollama_config.get("port", 11434)
        
        try:
            # Try direct Ollama connection first
            return await self._query_ollama_direct(ollama_host, ollama_port)
        except Exception as e:
            _LOGGER.error("Failed to get Ollama models from %s:%s - %s", 
                         ollama_host, ollama_port, e)
            # Fallback to WhoRang proxy
            return await self._get_ollama_models_via_whorang()

    async def _query_ollama_direct(self, host: str, port: int) -> List[Dict[str, Any]]:
        """Query Ollama API directly using configured host/port."""
        ollama_url = f"http://{host}:{port}"
        
        try:
            session = await self._get_session()
            async with session.get(
                f"{ollama_url}/api/tags",
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                if response.status == 200:
                    data = await response.json()
                    return self._parse_ollama_models(data.get("models", []))
                else:
                    _LOGGER.warning("Ollama API returned status %s", response.status)
                    return []
        except Exception as e:
            _LOGGER.error("Failed to query Ollama at %s:%s - %s", host, port, e)
            return []

    async def _get_ollama_models_via_whorang(self) -> List[Dict[str, Any]]:
        """Get Ollama models via WhoRang proxy (fallback method)."""
        try:
            response = await self._request("GET", "/api/faces/ollama/models")
            models_data = response.get("models", [])
            
            # Transform to match HA expectations
            transformed_models = []
            for model in models_data:
                if isinstance(model, dict):
                    transformed_models.append({
                        "name": model.get("value", ""),
                        "display_name": model.get("label", ""),
                        "size": model.get("size", 0),
                        "modified_at": model.get("modified_at"),
                        "is_vision": True  # Backend already filters for vision models
                    })
            
            _LOGGER.debug("Retrieved %d Ollama models via WhoRang proxy", len(transformed_models))
            return transformed_models
            
        except Exception as e:
            _LOGGER.error("Failed to get Ollama models via WhoRang proxy: %s", e)
            return []

    def _parse_ollama_models(self, models: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Parse Ollama models from direct API response - show ALL models, let user choose."""
        transformed_models = []
        for model in models:
            if isinstance(model, dict):
                model_name = model.get("name", "")
                if model_name:  # Only require that the model has a name
                    transformed_models.append({
                        "name": model_name,
                        "display_name": model_name,
                        "size": model.get("size", 0),
                        "modified_at": model.get("modified_at"),
                        "is_vision": True  # Let user decide which models work for vision
                    })
        
        _LOGGER.debug("Parsed %d Ollama models (all models, no filtering)", len(transformed_models))
        return transformed_models

    async def get_ollama_status(self) -> Dict[str, Any]:
        """Get Ollama connection status using configured host/port."""
        if not self.ollama_config.get("enabled", False):
            return {
                "status": "disabled",
                "message": "Ollama not enabled in configuration"
            }
            
        ollama_host = self.ollama_config.get("host", "localhost")
        ollama_port = self.ollama_config.get("port", 11434)
        
        try:
            # Try direct connection first
            if await self._test_ollama_connection(ollama_host, ollama_port):
                return {
                    "status": "connected",
                    "host": ollama_host,
                    "port": ollama_port,
                    "message": f"Connected to Ollama at {ollama_host}:{ollama_port}"
                }
            else:
                # Fallback to WhoRang proxy test
                response = await self._request("POST", "/api/faces/ollama/test")
                return {
                    "status": "connected" if response.get("success") else "disconnected",
                    "version": response.get("version"),
                    "url": response.get("ollama_url"),
                    "message": response.get("message"),
                    "last_check": response.get("debug", {}).get("response_data", {}),
                    "fallback": True
                }
        except Exception as e:
            _LOGGER.error("Failed to get Ollama status: %s", e)
            return {
                "status": "disconnected", 
                "error": str(e),
                "message": f"Connection failed: {e}",
                "host": ollama_host,
                "port": ollama_port
            }

    async def _test_ollama_connection(self, host: str, port: int) -> bool:
        """Test Ollama connection."""
        try:
            session = await self._get_session()
            async with session.get(
                f"http://{host}:{port}/api/tags",
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                return response.status == 200
        except Exception as e:
            _LOGGER.debug("Ollama connection test failed: %s", e)
            return False

    async def set_ollama_config(self, host: str, port: int) -> bool:
        """Update Ollama configuration in WhoRang backend."""
        try:
            response = await self._request("POST", "/api/ai/providers/local/config", data={
                "ollama": {
                    "host": host,
                    "port": port,
                    "enabled": True
                }
            })
            return response.get("success", False)
        except Exception as e:
            _LOGGER.error("Failed to set Ollama config: %s", e)
            return False

    def _format_size(self, size_bytes: int) -> str:
        """Format model size for display."""
        if size_bytes == 0:
            return "Unknown"
        
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if size_bytes < 1024.0:
                return f"{size_bytes:.1f} {unit}"
            size_bytes = int(size_bytes / 1024.0)
        return f"{size_bytes:.1f} PB"

    async def get_system_info(self) -> Dict[str, Any]:
        """Get comprehensive system information."""
        try:
            # Gather multiple pieces of system information
            health = await self.get_health()
            stats = await self.get_stats()
            face_config = await self.get_face_config()
            
            return {
                "health": health,
                "stats": stats,
                "face_config": face_config,
                "connected_clients": stats.get("connectedClients", 0),
                "is_online": stats.get("isOnline", False),
            }
        except Exception as err:
            _LOGGER.error("Failed to get system info: %s", err)
            return {
                "health": {"status": "unhealthy"},
                "stats": {"today": 0, "week": 0, "month": 0, "total": 0},
                "face_config": {"enabled": False},
                "connected_clients": 0,
                "is_online": False,
            }

    async def process_doorbell_event(self, payload: Dict[str, Any]) -> bool:
        """Process a complete doorbell event with image and context data.
        
        This replaces the original rest_command.doorbell_webhook functionality.
        """
        try:
            # Extract automation config if provided
            automation_config = payload.get("automation_config", {})
            
            # Prepare enhanced payload with AI template configuration
            enhanced_payload = payload.copy()
            
            # Add AI template configuration to the payload
            if automation_config:
                enhanced_payload.update({
                    "ai_prompt_template": automation_config.get("ai_prompt_template", "professional"),
                    "custom_ai_prompt": automation_config.get("custom_ai_prompt", ""),
                    "enable_weather_context": automation_config.get("enable_weather_context", True)
                })
                
                _LOGGER.info("Sending AI template configuration to backend: %s", 
                           automation_config.get("ai_prompt_template", "professional"))
            
            # Send the doorbell event to the backend webhook endpoint
            response = await self._request("POST", "/api/webhook/doorbell", data=enhanced_payload)
            
            # Check if the request was successful
            # The webhook returns the created event object, so check for visitor_id
            success = (
                response.get("success", False) or 
                response.get("status") == "ok" or
                response.get("visitor_id") is not None
            )
            
            if success:
                _LOGGER.info("Successfully processed doorbell event with image: %s", 
                           payload.get("image_url", "unknown"))
                _LOGGER.debug("Backend response: %s", response)
            else:
                _LOGGER.error("Backend rejected doorbell event: %s", 
                            response.get("message", "Unknown error"))
                
            return success
            
        except Exception as err:
            _LOGGER.error("Failed to process doorbell event: %s", err)
            return False

    # Face Management API Methods

    async def get_unassigned_faces(
        self, 
        limit: int = 50, 
        offset: int = 0, 
        quality_threshold: float = 0.0
    ) -> List[Dict[str, Any]]:
        """Get unknown faces requiring labeling."""
        try:
            params = {
                "limit": limit,
                "offset": offset,
                "quality_threshold": quality_threshold
            }
            response = await self._request("GET", f"{API_DETECTED_FACES}/unassigned", params=params)
            return response.get("faces", [])
        except Exception as e:
            _LOGGER.error("Failed to get unassigned faces: %s", e)
            return []

    async def assign_face_to_person(self, face_id: int, person_id: int) -> bool:
        """Assign a face to an existing person."""
        try:
            data = {"personId": person_id}
            response = await self._request("POST", f"{API_DETECTED_FACES}/{face_id}/assign", data=data)
            return response.get("success", False) or "message" in response
        except Exception as e:
            _LOGGER.error("Failed to assign face %s to person %s: %s", face_id, person_id, e)
            return False

    async def label_face_with_name(self, face_id: int, person_name: str) -> bool:
        """Label a face by creating a new person or finding existing one."""
        try:
            # First, try to find existing person with this name
            known_persons = await self.get_known_persons()
            existing_person = None
            
            for person in known_persons:
                if person.get("name", "").lower() == person_name.lower():
                    existing_person = person
                    break
            
            if existing_person:
                # Assign to existing person
                return await self.assign_face_to_person(face_id, existing_person["id"])
            else:
                # Create new person and assign face
                return await self.create_person_from_face(face_id, person_name)
                
        except Exception as e:
            _LOGGER.error("Failed to label face %s with name %s: %s", face_id, person_name, e)
            return False

    async def create_person_from_face(self, face_id: int, person_name: str, description: str = "") -> bool:
        """Create a new person and assign the face to them."""
        try:
            # Create the person first
            person_response = await self.create_person(person_name, description)
            
            if person_response.get("success", False):
                # Get the created person ID
                person_id = person_response.get("person", {}).get("id")
                if person_id:
                    # Assign the face to the new person
                    return await self.assign_face_to_person(face_id, person_id)
            
            return False
        except Exception as e:
            _LOGGER.error("Failed to create person from face %s: %s", face_id, e)
            return False

    async def get_face_similarities(self, face_id: int, threshold: float = 0.6, limit: int = 10) -> List[Dict[str, Any]]:
        """Get similar faces for a given face ID."""
        try:
            response = await self._request("POST", "/api/faces/similarities", data={
                "face_id": face_id,
                "threshold": threshold,
                "limit": limit
            })
            return response.get("similar_faces", [])
        except Exception as err:
            _LOGGER.error("Failed to get face similarities: %s", err)
            return []

    # Person Management Methods

    async def update_person(self, person_id: int, data: Dict[str, Any]) -> bool:
        """Update person information."""
        try:
            response = await self._request("PUT", f"/api/faces/persons/{person_id}", data=data)
            # PersonController returns the updated person object directly, not wrapped in success
            return isinstance(response, dict) and "id" in response
        except Exception as err:
            _LOGGER.error("Failed to update person %s: %s", person_id, err)
            return False

    async def get_person_details(self, person_id: int) -> Dict[str, Any]:
        """Get detailed person information including faces."""
        try:
            response = await self._request("GET", f"/api/faces/persons/{person_id}")
            # PersonController returns the person object directly with encodings and recentEvents
            if isinstance(response, dict) and "id" in response:
                return response
            return {}
        except Exception as err:
            _LOGGER.error("Failed to get person details for %s: %s", person_id, err)
            return {}

    async def merge_persons(self, source_id: int, target_id: int) -> bool:
        """Merge two person entries."""
        try:
            # This would need to be implemented in the backend
            # For now, we'll simulate it by transferring faces and deleting the source
            
            # Get source person faces
            source_details = await self.get_person_details(source_id)
            source_faces = source_details.get("faces", [])
            
            # Get target person details
            target_details = await self.get_person_details(target_id)
            target_name = target_details.get("name", "Unknown")
            
            # Transfer each face from source to target
            success_count = 0
            for face in source_faces:
                face_id = face.get("id")
                if face_id:
                    if await self.label_face_with_name(face_id, target_name):
                        success_count += 1
            
            # If all faces transferred successfully, delete the source person
            if success_count == len(source_faces) and success_count > 0:
                # Delete source person (this would remove the person entry)
                delete_response = await self._request("DELETE", f"/api/persons/{source_id}")
                return delete_response.get("success", False)
            
            return success_count > 0
            
        except Exception as err:
            _LOGGER.error("Failed to merge persons %s -> %s: %s", source_id, target_id, err)
            return False

    async def delete_face(self, face_id: int) -> bool:
        """Delete a detected face."""
        try:
            response = await self._request("DELETE", f"{API_DETECTED_FACES}/{face_id}")
            return response.get("success", False) or "message" in response
        except Exception as e:
            _LOGGER.error("Failed to delete face %s: %s", face_id, e)
            return False

    async def get_face_stats(self) -> Dict[str, Any]:
        """Get face detection statistics."""
        try:
            response = await self._request("GET", f"{API_DETECTED_FACES}/stats")
            return response
        except Exception as e:
            _LOGGER.error("Failed to get face stats: %s", e)
            return {
                "total": 0,
                "assigned": 0,
                "unassigned": 0,
                "qualityDistribution": [],
                "recentActivity": []
            }

    async def bulk_assign_faces(self, face_ids: List[int], person_id: int) -> Dict[str, Any]:
        """Bulk assign multiple faces to a person."""
        try:
            data = {
                "faceIds": face_ids,
                "personId": person_id
            }
            response = await self._request("POST", f"{API_DETECTED_FACES}/bulk-assign", data=data)
            return response
        except Exception as e:
            _LOGGER.error("Failed to bulk assign faces %s to person %s: %s", face_ids, person_id, e)
            return {"success": False, "error": str(e)}

    async def get_person_faces(self, person_id: int) -> List[Dict[str, Any]]:
        """Get all faces assigned to a specific person."""
        try:
            response = await self._request("GET", f"{API_DETECTED_FACES}/person/{person_id}")
            return response.get("faces", [])
        except Exception as e:
            _LOGGER.error("Failed to get faces for person %s: %s", person_id, e)
            return []

    async def get_face_image_url(self, face_id: int) -> Optional[str]:
        """Get the URL for a face crop image."""
        try:
            # The backend should provide face crop URLs in the face data
            # This is a helper method to construct the URL
            return f"{self.base_url}/api/faces/{face_id}/image"
        except Exception as e:
            _LOGGER.error("Failed to get face image URL for %s: %s", face_id, e)
            return None

    async def get_face_gallery_data(self) -> Dict[str, Any]:
        """Get comprehensive face gallery data using the actual addon endpoint."""
        try:
            # Use the actual face gallery endpoint from the addon
            response = await self._request("GET", "/api/faces/gallery")
            
            # The addon returns: { success: true, data: { unknown_faces: [...], known_persons: [...], statistics: {...} } }
            if response.get("success") and "data" in response:
                gallery_data = response["data"]
                
                # Extract data from the addon's response format
                unknown_faces = gallery_data.get("unknown_faces", [])
                known_persons = gallery_data.get("known_persons", [])
                statistics = gallery_data.get("statistics", {})
                
                # Process unknown faces - they already have the correct image URLs from the addon
                processed_unknown = []
                for face in unknown_faces:
                    if isinstance(face, dict):
                        face_data = {
                            "id": face.get("id"),
                            "image_url": face.get("image_url"),
                            "thumbnail_url": face.get("thumbnail_url"),
                            "quality": face.get("quality_score", 0),
                            "confidence": face.get("confidence", 0),
                            "detection_date": face.get("detection_date"),
                            "description": face.get("description", "Unknown person"),
                            "selectable": True,
                            "bounding_box": face.get("bounding_box"),
                            "original_image_url": face.get("original_image_url")
                        }
                        processed_unknown.append(face_data)
                
                # Process known persons - they already have the correct avatar URLs from the addon
                processed_known = []
                for person in known_persons:
                    if isinstance(person, dict):
                        person_data = {
                            "id": person.get("id"),
                            "name": person.get("name"),
                            "face_count": person.get("face_count", 0),
                            "last_seen": person.get("last_seen"),
                            "first_seen": person.get("first_seen"),
                            "avg_confidence": person.get("avg_confidence", 0),
                            "avatar_url": person.get("avatar_url")
                        }
                        processed_known.append(person_data)
                
                # Use statistics from the addon
                total_unknown = statistics.get("total_unknown", len(processed_unknown))
                total_known = statistics.get("total_known_persons", len(processed_known))
                total_labeled_faces = statistics.get("total_labeled_faces", 0)
                progress = statistics.get("labeling_progress", 100)
                
                return {
                    "unknown_faces": processed_unknown,
                    "known_persons": processed_known,
                    "total_unknown": total_unknown,
                    "total_known": total_known,
                    "total_faces": total_unknown + total_labeled_faces,
                    "labeling_progress": progress,
                    "gallery_ready": True,
                    "last_updated": datetime.now().isoformat()
                }
            else:
                # Handle case where addon returns error or unexpected format
                error_msg = response.get("error", "Unknown error from addon")
                _LOGGER.warning("Face gallery endpoint returned error: %s", error_msg)
                return {
                    "unknown_faces": [],
                    "known_persons": [],
                    "total_unknown": 0,
                    "total_known": 0,
                    "total_faces": 0,
                    "labeling_progress": 100,
                    "gallery_ready": False,
                    "error": error_msg,
                    "last_updated": datetime.now().isoformat()
                }
            
        except Exception as e:
            _LOGGER.error("Failed to get face gallery data: %s", e)
            return {
                "unknown_faces": [],
                "known_persons": [],
                "total_unknown": 0,
                "total_known": 0,
                "total_faces": 0,
                "labeling_progress": 100,
                "gallery_ready": False,
                "error": str(e),
                "last_updated": datetime.now().isoformat()
            }

    async def get_face_gallery(self) -> Dict[str, Any]:
        """Legacy method - redirects to new implementation."""
        return await self.get_face_gallery_data()

    async def get_face_suggestions(self, face_id: int) -> List[Dict[str, Any]]:
        """Get name suggestions for a face based on similarity."""
        try:
            response = await self._request("GET", f"/api/faces/{face_id}/suggestions")
            return response.get("data", [])
        except Exception as e:
            _LOGGER.error("Failed to get face suggestions for %s: %s", face_id, e)
            return []

    async def label_face(self, face_id: int, person_name: str, create_person: bool = True) -> bool:
        """Label a single face with a person name."""
        try:
            data = {
                "person_name": person_name,
                "create_person": create_person
            }
            response = await self._request("POST", f"/api/faces/{face_id}/label", data=data)
            return response.get("success", False)
        except Exception as e:
            _LOGGER.error("Failed to label face %s with name %s: %s", face_id, person_name, e)
            return False

    async def batch_label_faces(self, face_ids: List[int], person_name: str, create_person: bool = True) -> Dict[str, Any]:
        """Label multiple faces with the same person name."""
        try:
            data = {
                "face_ids": face_ids,
                "person_name": person_name,
                "create_person": create_person
            }
            response = await self._request("POST", "/api/faces/batch-label", data=data)
            return response.get("data", {
                "labeled_count": 0,
                "total_requested": len(face_ids),
                "results": []
            })
        except Exception as e:
            _LOGGER.error("Failed to batch label faces %s with name %s: %s", face_ids, person_name, e)
            return {
                "labeled_count": 0,
                "total_requested": len(face_ids),
                "results": [],
                "error": str(e)
            }

    async def delete_face_by_id(self, face_id: int) -> bool:
        """Delete a face by ID."""
        try:
            response = await self._request("DELETE", f"/api/faces/{face_id}")
            return response.get("success", False)
        except Exception as e:
            _LOGGER.error("Failed to delete face %s: %s", face_id, e)
            return False

    async def refresh_face_gallery(self) -> bool:
        """Refresh face gallery data (trigger backend to reload)."""
        try:
            # This could trigger a refresh or just return current data
            response = await self.get_face_gallery()
            return response is not None
        except Exception as e:
            _LOGGER.error("Failed to refresh face gallery: %s", e)
            return False
