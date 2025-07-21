"""Camera platform for WhoRang AI Doorbell integration."""
from __future__ import annotations

import aiohttp
import logging
from typing import Optional

from homeassistant.components.camera import Camera
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import (
    DOMAIN,
    MANUFACTURER,
    MODEL,
    SW_VERSION,
    CAMERA_LATEST_IMAGE,
)
from .coordinator import WhoRangDataUpdateCoordinator

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    config_entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up WhoRang camera entities."""
    coordinator: WhoRangDataUpdateCoordinator = hass.data[DOMAIN][config_entry.entry_id]

    entities = [
        WhoRangLatestImageCamera(coordinator, config_entry),
    ]

    async_add_entities(entities)


class WhoRangCameraEntity(CoordinatorEntity, Camera):
    """Base class for WhoRang camera entities."""

    def __init__(
        self,
        coordinator: WhoRangDataUpdateCoordinator,
        config_entry: ConfigEntry,
        camera_type: str,
    ) -> None:
        """Initialize the camera."""
        super().__init__(coordinator)
        Camera.__init__(self)
        self.config_entry = config_entry
        self.camera_type = camera_type
        self._attr_unique_id = f"{config_entry.entry_id}_{camera_type}"
        self._attr_has_entity_name = True

    @property
    def device_info(self) -> DeviceInfo:
        """Return device information."""
        return DeviceInfo(
            identifiers={(DOMAIN, self.config_entry.entry_id)},
            name="WhoRang AI Doorbell",
            manufacturer=MANUFACTURER,
            model=MODEL,
            sw_version=SW_VERSION,
            configuration_url=f"http://{self.coordinator.api_client.host}:{self.coordinator.api_client.port}",
        )


class WhoRangLatestImageCamera(WhoRangCameraEntity):
    """Camera entity for the latest doorbell image."""

    def __init__(
        self,
        coordinator: WhoRangDataUpdateCoordinator,
        config_entry: ConfigEntry,
    ) -> None:
        """Initialize the camera."""
        super().__init__(coordinator, config_entry, CAMERA_LATEST_IMAGE)
        self._attr_name = "Latest Image"
        self._attr_icon = "mdi:camera"
        self._cached_image = None
        self._last_image_url = None

    @property
    def state(self) -> str:
        """Return the state of the camera."""
        try:
            # Safely get coordinator data with proper None handling
            coordinator_data = getattr(self.coordinator, 'data', None) or {}
            latest_image = coordinator_data.get("latest_image") or {}
            latest_visitor = coordinator_data.get("latest_visitor") or {}
            
            # Both are guaranteed to be dicts now, not None
            image_url = latest_image.get("url") or latest_visitor.get("image_url")
            
            if image_url and image_url != self._last_image_url:
                return "recording"
            elif image_url:
                return "idle"
            else:
                return "unavailable"
                
        except Exception as e:
            _LOGGER.debug("Error getting camera state: %s", e)
            return "unavailable"

    async def async_camera_image(
        self, width: Optional[int] = None, height: Optional[int] = None
    ) -> Optional[bytes]:
        """Return bytes of camera image."""
        try:
            # Safely get coordinator data with proper None handling
            coordinator_data = getattr(self.coordinator, 'data', None) or {}
            latest_image = coordinator_data.get("latest_image") or {}
            latest_visitor = coordinator_data.get("latest_visitor") or {}
            
            # Both are guaranteed to be dicts now, not None
            image_url = latest_image.get("url") or latest_visitor.get("image_url")
            
            if not image_url:
                _LOGGER.debug("No image URL available in coordinator data")
                return self._cached_image
            
            # If same URL as last time and we have cached image, return it
            if image_url == self._last_image_url and self._cached_image:
                _LOGGER.debug("Returning cached image for URL: %s", image_url)
                return self._cached_image
            
            _LOGGER.info("Fetching new image from URL: %s", image_url)
            
            # Fetch image from URL
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    image_url,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status == 200:
                        image_data = await response.read()
                        self._cached_image = image_data
                        self._last_image_url = image_url
                        _LOGGER.info("Successfully fetched image (%d bytes) from: %s", 
                                   len(image_data), image_url)
                        return image_data
                    else:
                        _LOGGER.error("Failed to fetch image from %s: HTTP %s", 
                                    image_url, response.status)
                        return self._cached_image
                        
        except Exception as e:
            _LOGGER.error("Error fetching camera image: %s", e, exc_info=True)
            return self._cached_image

    @property
    def extra_state_attributes(self):
        """Return additional state attributes."""
        try:
            # Safely get coordinator data with proper None handling
            coordinator_data = getattr(self.coordinator, 'data', None) or {}
            latest_image = coordinator_data.get("latest_image") or {}
            latest_visitor = coordinator_data.get("latest_visitor") or {}
            last_service_call = coordinator_data.get("last_service_call") or {}
            
            attributes = {
                "image_url": latest_image.get("url") or latest_visitor.get("image_url"),
                "timestamp": latest_image.get("timestamp") or latest_visitor.get("timestamp"),
                "status": latest_image.get("status", "unknown"),
                "source": latest_image.get("source", "unknown"),
                "coordinator_ready": coordinator_data is not None and len(coordinator_data) > 0,
            }
            
            # Add visitor data if available
            if latest_visitor:
                attributes.update({
                    "visitor_id": latest_visitor.get("visitor_id"),
                    "ai_message": latest_visitor.get("ai_analysis"),
                    "ai_title": latest_visitor.get("ai_title"),
                    "faces_detected": latest_visitor.get("faces_detected", 0),
                    "confidence": latest_visitor.get("confidence", 0),
                })
            
            # Add service call data if available
            if last_service_call:
                attributes.update({
                    "last_service_call": last_service_call.get("timestamp"),
                    "service_call_data": last_service_call.get("data", {}),
                })
            
            return attributes
            
        except Exception as e:
            _LOGGER.debug("Error getting camera attributes: %s", e)
            return {
                "status": "error",
                "error": str(e),
                "coordinator_ready": False
            }

    @property
    def available(self) -> bool:
        """Return True if entity is available."""
        try:
            # Camera is available if coordinator is successful and has data
            coordinator_data = getattr(self.coordinator, 'data', None)
            return (
                self.coordinator.last_update_success and 
                coordinator_data is not None
            )
        except Exception as e:
            _LOGGER.debug("Error checking camera availability: %s", e)
            return False
