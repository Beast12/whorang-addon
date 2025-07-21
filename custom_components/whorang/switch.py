"""Switch platform for WhoRang AI Doorbell."""
from __future__ import annotations

import logging
from typing import Any

from homeassistant.components.switch import SwitchEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN, MANUFACTURER, MODEL, SW_VERSION
from .coordinator import WhoRangDataUpdateCoordinator

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up WhoRang switch entities from a config entry."""
    coordinator: WhoRangDataUpdateCoordinator = hass.data[DOMAIN][entry.entry_id]

    entities = [
        WhoRangFaceProcessingSwitch(coordinator),
        WhoRangAIProcessingSwitch(coordinator),
    ]

    async_add_entities(entities)


class WhoRangFaceProcessingSwitch(CoordinatorEntity, SwitchEntity):
    """Switch to control face recognition processing."""

    def __init__(self, coordinator: WhoRangDataUpdateCoordinator) -> None:
        """Initialize the face processing switch."""
        super().__init__(coordinator)
        self.coordinator = coordinator
        self._attr_name = "Face Processing"
        self._attr_unique_id = f"{coordinator.config_entry.entry_id}_face_processing"
        self._attr_icon = "mdi:face-recognition"
        self._attr_has_entity_name = True

    @property
    def device_info(self) -> DeviceInfo:
        """Return device information."""
        return DeviceInfo(
            identifiers={(DOMAIN, self.coordinator.config_entry.entry_id)},
            name="WhoRang AI Doorbell",
            manufacturer=MANUFACTURER,
            model=MODEL,
            sw_version=SW_VERSION,
            configuration_url=f"http://{self.coordinator.api_client.host}:{self.coordinator.api_client.port}",
        )

    @property
    def is_on(self) -> bool:
        """Return true if face processing is enabled."""
        system_info = self.coordinator.data.get("system_info", {})
        config = system_info.get("face_config", {})
        return bool(config.get("enabled", False))

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return additional state attributes."""
        system_info = self.coordinator.data.get("system_info", {})
        config = system_info.get("face_config", {})
        return {
            "confidence_threshold": config.get("confidence_threshold", 0.6),
            "training_images_per_person": config.get("training_images_per_person", 3),
            "background_processing": bool(config.get("background_processing", True)),
            "auto_delete_after_days": config.get("auto_delete_after_days", 0),
        }

    async def async_turn_on(self, **kwargs: Any) -> None:
        """Turn on face processing."""
        _LOGGER.info("Turning on face processing")
        try:
            success = await self.coordinator.api_client.update_face_config({
                "enabled": True
            })
            if success:
                _LOGGER.info("Successfully enabled face processing")
                await self.coordinator.async_request_refresh()
            else:
                _LOGGER.error("Failed to enable face processing")
        except Exception as err:
            _LOGGER.error("Error enabling face processing: %s", err)

    async def async_turn_off(self, **kwargs: Any) -> None:
        """Turn off face processing."""
        _LOGGER.info("Turning off face processing")
        try:
            success = await self.coordinator.api_client.update_face_config({
                "enabled": False
            })
            if success:
                _LOGGER.info("Successfully disabled face processing")
                await self.coordinator.async_request_refresh()
            else:
                _LOGGER.error("Failed to disable face processing")
        except Exception as err:
            _LOGGER.error("Error disabling face processing: %s", err)


class WhoRangAIProcessingSwitch(CoordinatorEntity, SwitchEntity):
    """Switch to control AI processing (automatic analysis)."""

    def __init__(self, coordinator: WhoRangDataUpdateCoordinator) -> None:
        """Initialize the AI processing switch."""
        super().__init__(coordinator)
        self.coordinator = coordinator
        self._attr_name = "AI Processing"
        self._attr_unique_id = f"{coordinator.config_entry.entry_id}_ai_processing"
        self._attr_icon = "mdi:brain"
        self._attr_has_entity_name = True

    @property
    def device_info(self) -> DeviceInfo:
        """Return device information."""
        return DeviceInfo(
            identifiers={(DOMAIN, self.coordinator.config_entry.entry_id)},
            name="WhoRang AI Doorbell",
            manufacturer=MANUFACTURER,
            model=MODEL,
            sw_version=SW_VERSION,
            configuration_url=f"http://{self.coordinator.api_client.host}:{self.coordinator.api_client.port}",
        )

    @property
    def is_on(self) -> bool:
        """Return true if AI processing is enabled."""
        # AI processing is considered "on" if:
        # 1. Face processing is enabled (since that's where AI analysis happens)
        # 2. An AI provider is configured and not "none"
        system_info = self.coordinator.data.get("system_info", {})
        config = system_info.get("face_config", {})
        face_enabled = bool(config.get("enabled", False))
        ai_provider = config.get("ai_provider", "none")
        
        return face_enabled and ai_provider != "none"

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return additional state attributes."""
        system_info = self.coordinator.data.get("system_info", {})
        config = system_info.get("face_config", {})
        ai_usage = self.coordinator.data.get("ai_usage", {})
        
        return {
            "ai_provider": config.get("ai_provider", "none"),
            "current_ai_model": config.get("current_ai_model", "unknown"),
            "cost_tracking_enabled": bool(config.get("cost_tracking_enabled", False)),
            "monthly_budget_limit": config.get("monthly_budget_limit", 0),
            "total_cost_today": ai_usage.get("today", {}).get("cost", 0.0),
            "total_requests_today": ai_usage.get("today", {}).get("requests", 0),
            "monthly_cost": ai_usage.get("month", {}).get("cost", 0.0),
            "monthly_requests": ai_usage.get("month", {}).get("requests", 0),
        }

    async def async_turn_on(self, **kwargs: Any) -> None:
        """Turn on AI processing."""
        _LOGGER.info("Turning on AI processing")
        try:
            # Get current config to preserve other settings
            config = self.coordinator.data.get("face_config", {})
            current_provider = config.get("ai_provider", "openai")
            
            # If provider is "none", set it to a default
            if current_provider == "none":
                current_provider = "openai"  # Default to OpenAI
            
            # Enable face processing and ensure AI provider is set
            success = await self.coordinator.api_client.update_face_config({
                "enabled": True,
                "ai_provider": current_provider
            })
            
            if success:
                _LOGGER.info("Successfully enabled AI processing with provider: %s", current_provider)
                await self.coordinator.async_request_refresh()
            else:
                _LOGGER.error("Failed to enable AI processing")
        except Exception as err:
            _LOGGER.error("Error enabling AI processing: %s", err)

    async def async_turn_off(self, **kwargs: Any) -> None:
        """Turn off AI processing."""
        _LOGGER.info("Turning off AI processing")
        try:
            # Disable face processing (which includes AI analysis)
            success = await self.coordinator.api_client.update_face_config({
                "enabled": False
            })
            
            if success:
                _LOGGER.info("Successfully disabled AI processing")
                await self.coordinator.async_request_refresh()
            else:
                _LOGGER.error("Failed to disable AI processing")
        except Exception as err:
            _LOGGER.error("Error disabling AI processing: %s", err)
