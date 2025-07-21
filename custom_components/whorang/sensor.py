"""Sensor platform for WhoRang AI Doorbell integration."""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, Optional

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorEntityDescription,
    SensorStateClass,
)
from homeassistant.helpers.entity import EntityCategory
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
    SENSOR_LATEST_VISITOR,
    SENSOR_VISITOR_COUNT_TODAY,
    SENSOR_VISITOR_COUNT_WEEK,
    SENSOR_VISITOR_COUNT_MONTH,
    SENSOR_SYSTEM_STATUS,
    SENSOR_AI_PROVIDER_ACTIVE,
    SENSOR_AI_COST_TODAY,
    SENSOR_AI_COST_MONTH,
    SENSOR_AI_RESPONSE_TIME,
    SENSOR_KNOWN_FACES_COUNT,
    SENSOR_UNKNOWN_FACES,
    SENSOR_LATEST_FACE_DETECTION,
    ATTR_VISITOR_ID,
    ATTR_TIMESTAMP,
    ATTR_AI_MESSAGE,
    ATTR_AI_TITLE,
    ATTR_LOCATION,
    ATTR_WEATHER,
    ATTR_DEVICE_NAME,
    ATTR_CONFIDENCE_SCORE,
    ATTR_OBJECTS_DETECTED,
    ATTR_FACES_DETECTED,
    ATTR_PROCESSING_TIME,
    ATTR_AI_PROVIDER,
    ATTR_COST_USD,
    ATTR_IMAGE_URL,
    ATTR_FACE_ID,
    ATTR_FACE_CROP_PATH,
    ATTR_FACE_QUALITY,
    ATTR_UNKNOWN_FACES,
    ATTR_KNOWN_FACES,
    ATTR_FACE_DETAILS,
    ATTR_REQUIRES_LABELING,
    UNIT_MILLISECONDS,
    UNIT_CURRENCY_USD,
    UNIT_VISITORS,
    UNIT_FACES,
    STATE_CLASS_MEASUREMENT,
    STATE_CLASS_TOTAL,
    STATE_CLASS_TOTAL_INCREASING,
    DEVICE_CLASS_TIMESTAMP,
    DEVICE_CLASS_DURATION,
    DEVICE_CLASS_MONETARY,
)
from .coordinator import WhoRangDataUpdateCoordinator

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    config_entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up WhoRang sensor entities."""
    coordinator: WhoRangDataUpdateCoordinator = hass.data[DOMAIN][config_entry.entry_id]

    entities = [
        WhoRangLatestVisitorSensor(coordinator, config_entry),
        WhoRangVisitorCountTodaySensor(coordinator, config_entry),
        WhoRangVisitorCountWeekSensor(coordinator, config_entry),
        WhoRangVisitorCountMonthSensor(coordinator, config_entry),
        WhoRangSystemStatusSensor(coordinator, config_entry),
        WhoRangAIProviderSensor(coordinator, config_entry),
        WhoRangAICostTodaySensor(coordinator, config_entry),
        WhoRangAICostMonthSensor(coordinator, config_entry),
        WhoRangAIResponseTimeSensor(coordinator, config_entry),
        WhoRangKnownFacesCountSensor(coordinator, config_entry),
        WhoRangUnknownFacesSensor(coordinator, config_entry),
        WhoRangLatestFaceDetectionSensor(coordinator, config_entry),
        WhoRangFaceGallerySensor(coordinator, config_entry),
        WhoRangKnownPersonsGallerySensor(coordinator, config_entry),
    ]

    async_add_entities(entities)


class WhoRangSensorEntity(CoordinatorEntity, SensorEntity):
    """Base class for WhoRang sensor entities."""

    def __init__(
        self,
        coordinator: WhoRangDataUpdateCoordinator,
        config_entry: ConfigEntry,
        sensor_type: str,
    ) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator)
        self.config_entry = config_entry
        self.sensor_type = sensor_type
        self._attr_unique_id = f"{config_entry.entry_id}_{sensor_type}"
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


class WhoRangLatestVisitorSensor(WhoRangSensorEntity):
    """Sensor for the latest visitor information."""

    def __init__(
        self,
        coordinator: WhoRangDataUpdateCoordinator,
        config_entry: ConfigEntry,
    ) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator, config_entry, SENSOR_LATEST_VISITOR)
        self._attr_name = "Latest Visitor"
        self._attr_icon = "mdi:account-clock"

    @property
    def native_value(self) -> Optional[str]:
        """Return the state of the sensor."""
        # Check coordinator data first (for service calls), then fallback to API data
        if self.coordinator.data:
            latest_visitor = self.coordinator.data.get("latest_visitor")
            if latest_visitor:
                return (latest_visitor.get("visitor_name") or 
                       latest_visitor.get("ai_title") or 
                       latest_visitor.get("ai_analysis", "Unknown visitor"))
        
        # Fallback to coordinator method for API data
        latest_visitor = self.coordinator.async_get_latest_visitor()
        if latest_visitor:
            return latest_visitor.get("ai_title") or latest_visitor.get("ai_message", "Unknown visitor")
        
        return "No visitors"

    @property
    def extra_state_attributes(self) -> Dict[str, Any]:
        """Return additional state attributes."""
        attributes = {}
        
        # Check coordinator data first (for service calls)
        if self.coordinator.data:
            latest_visitor = self.coordinator.data.get("latest_visitor")
            last_service_call = self.coordinator.data.get("last_service_call")
            
            if latest_visitor:
                attributes.update({
                    ATTR_VISITOR_ID: latest_visitor.get("visitor_id"),
                    ATTR_TIMESTAMP: latest_visitor.get("timestamp"),
                    ATTR_AI_MESSAGE: latest_visitor.get("ai_analysis"),
                    ATTR_AI_TITLE: latest_visitor.get("ai_title"),
                    ATTR_CONFIDENCE_SCORE: latest_visitor.get("confidence"),
                    ATTR_FACES_DETECTED: latest_visitor.get("faces_detected", 0),
                    ATTR_IMAGE_URL: latest_visitor.get("image_url"),
                    "visitor_name": latest_visitor.get("visitor_name"),
                    "face_recognized": latest_visitor.get("face_recognized", False),
                    "source": latest_visitor.get("source", "unknown"),
                })
                
                # Handle weather data safely - can be dict, string, or None
                weather = latest_visitor.get("weather")
                
                if isinstance(weather, dict):
                    # Weather is a dictionary - extract individual values
                    attributes[ATTR_WEATHER] = weather
                    attributes["weather_temperature"] = weather.get("temperature")
                    attributes["weather_humidity"] = weather.get("humidity")
                    attributes["weather_condition"] = weather.get("condition")
                    attributes["weather_wind_speed"] = weather.get("wind_speed")
                    attributes["weather_pressure"] = weather.get("pressure")
                elif isinstance(weather, str):
                    # Weather is a string - likely the condition only
                    attributes[ATTR_WEATHER] = weather
                    attributes["weather_temperature"] = None
                    attributes["weather_humidity"] = None
                    attributes["weather_condition"] = weather
                    attributes["weather_wind_speed"] = None
                    attributes["weather_pressure"] = None
                else:
                    # Weather is None or other type - set all to None
                    attributes[ATTR_WEATHER] = None
                    attributes["weather_temperature"] = None
                    attributes["weather_humidity"] = None
                    attributes["weather_condition"] = None
                    attributes["weather_wind_speed"] = None
                    attributes["weather_pressure"] = None
                
                # Add individual weather fields from latest_visitor if available
                # (These might come directly from service calls and override the above)
                if "weather_temp" in latest_visitor:
                    attributes["weather_temperature"] = latest_visitor.get("weather_temp")
                if "weather_humidity" in latest_visitor:
                    attributes["weather_humidity"] = latest_visitor.get("weather_humidity")
                if "weather_condition" in latest_visitor:
                    attributes["weather_condition"] = latest_visitor.get("weather_condition")
                if "wind_speed" in latest_visitor:
                    attributes["weather_wind_speed"] = latest_visitor.get("wind_speed")
                if "pressure" in latest_visitor:
                    attributes["weather_pressure"] = latest_visitor.get("pressure")
            
            # Add service call information if available
            if last_service_call:
                attributes.update({
                    "last_service_call": last_service_call.get("timestamp"),
                    "service_call_data": last_service_call.get("data", {}),
                })
        
        # Fallback to coordinator method for API data if no service call data
        if not attributes:
            latest_visitor = self.coordinator.async_get_latest_visitor()
            if latest_visitor:
                attributes.update({
                    ATTR_VISITOR_ID: latest_visitor.get("visitor_id"),
                    ATTR_TIMESTAMP: latest_visitor.get("timestamp"),
                    ATTR_AI_MESSAGE: latest_visitor.get("ai_message"),
                    ATTR_AI_TITLE: latest_visitor.get("ai_title"),
                    ATTR_LOCATION: latest_visitor.get("location"),
                    ATTR_WEATHER: latest_visitor.get("weather"),
                    ATTR_DEVICE_NAME: latest_visitor.get("device_name"),
                    ATTR_CONFIDENCE_SCORE: latest_visitor.get("confidence_score"),
                    ATTR_OBJECTS_DETECTED: latest_visitor.get("objects_detected"),
                    ATTR_FACES_DETECTED: latest_visitor.get("faces_detected", 0),
                    ATTR_PROCESSING_TIME: latest_visitor.get("processing_time"),
                    ATTR_IMAGE_URL: latest_visitor.get("image_url"),
                })
        
        return attributes


class WhoRangFaceGallerySensor(WhoRangSensorEntity):
    """Sensor providing face gallery data with image URLs."""

    def __init__(
        self,
        coordinator: WhoRangDataUpdateCoordinator,
        config_entry: ConfigEntry,
    ) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator, config_entry, "face_gallery")
        self._attr_name = "Face Gallery"
        self._attr_icon = "mdi:view-gallery"
        self._attr_entity_category = EntityCategory.DIAGNOSTIC

    @property
    def native_value(self) -> str:
        """Return face gallery status."""
        try:
            # Get face gallery data from coordinator
            if self.coordinator.data and "face_gallery_data" in self.coordinator.data:
                gallery_data = self.coordinator.data["face_gallery_data"]
                if gallery_data.get("gallery_ready", False):
                    unknown_count = gallery_data.get("total_unknown", 0)
                    known_count = gallery_data.get("total_known", 0)
                    return f"{unknown_count} unknown, {known_count} known"
                else:
                    error = gallery_data.get("error", "Unknown error")
                    return f"Error: {error}"
            else:
                return "Loading gallery data..."
        except Exception as e:
            _LOGGER.error("Failed to get face gallery status: %s", e)
            return "Error loading gallery"

    @property
    def extra_state_attributes(self) -> Dict[str, Any]:
        """Return face gallery data as attributes."""
        try:
            # Get face gallery data from coordinator
            if self.coordinator.data and "face_gallery_data" in self.coordinator.data:
                gallery_data = self.coordinator.data["face_gallery_data"]
                
                if gallery_data.get("gallery_ready", False):
                    # Process unknown faces with full image URLs
                    unknown_faces = gallery_data.get("unknown_faces", [])
                    processed_unknown = []
                    
                    for face in unknown_faces:
                        processed_face = {
                            "id": face.get("id"),
                            "image_url": face.get("image_url"),
                            "thumbnail_url": face.get("thumbnail_url"),
                            "quality_score": face.get("quality", 0),
                            "confidence": face.get("confidence", 0),
                            "detection_date": face.get("detection_date"),
                            "description": face.get("description", "Unknown person"),
                            "selectable": face.get("selectable", True),
                            "face_crop_path": face.get("face_crop_path", ""),
                            "original_image": face.get("original_image", "")
                        }
                        processed_unknown.append(processed_face)
                    
                    # Process known persons
                    known_persons = gallery_data.get("known_persons", [])
                    processed_known = []
                    
                    for person in known_persons:
                        processed_person = {
                            "id": person.get("id"),
                            "name": person.get("name"),
                            "face_count": person.get("face_count", 0),
                            "last_seen": person.get("last_seen"),
                            "avatar_url": person.get("avatar_url"),
                            "recognition_count": person.get("recognition_count", 0),
                            "notes": person.get("notes", "")
                        }
                        processed_known.append(processed_person)
                    
                    return {
                        "unknown_faces": processed_unknown,
                        "known_persons": processed_known,
                        "total_unknown": gallery_data.get("total_unknown", len(processed_unknown)),
                        "total_known_persons": gallery_data.get("total_known", len(processed_known)),
                        "total_faces": gallery_data.get("total_faces", len(processed_unknown) + len(processed_known)),
                        "labeling_progress": gallery_data.get("labeling_progress", 100),
                        "gallery_loaded": True,
                        "gallery_ready": True,
                        "last_updated": gallery_data.get("last_updated")
                    }
                else:
                    # Gallery data exists but not ready (error state)
                    error = gallery_data.get("error", "Unknown error")
                    return {
                        "unknown_faces": [],
                        "known_persons": [],
                        "total_unknown": 0,
                        "total_known_persons": 0,
                        "total_faces": 0,
                        "labeling_progress": 100,
                        "gallery_loaded": False,
                        "gallery_ready": False,
                        "error": error,
                        "last_updated": gallery_data.get("last_updated")
                    }
            else:
                return {
                    "unknown_faces": [],
                    "known_persons": [],
                    "total_unknown": 0,
                    "total_known_persons": 0,
                    "total_faces": 0,
                    "labeling_progress": 100,
                    "gallery_loaded": False,
                    "gallery_ready": False,
                    "fetch_instruction": "Waiting for coordinator to load face gallery data..."
                }
                
        except Exception as e:
            _LOGGER.error("Failed to get face gallery attributes: %s", e)
            return {
                "unknown_faces": [],
                "known_persons": [],
                "total_unknown": 0,
                "total_known_persons": 0,
                "total_faces": 0,
                "labeling_progress": 100,
                "gallery_loaded": False,
                "gallery_ready": False,
                "error": str(e)
            }


class WhoRangVisitorCountTodaySensor(WhoRangSensorEntity):
    """Sensor for today's visitor count."""

    def __init__(
        self,
        coordinator: WhoRangDataUpdateCoordinator,
        config_entry: ConfigEntry,
    ) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator, config_entry, SENSOR_VISITOR_COUNT_TODAY)
        self._attr_name = "Visitors Today"
        self._attr_icon = "mdi:counter"
        self._attr_native_unit_of_measurement = UNIT_VISITORS
        self._attr_state_class = STATE_CLASS_TOTAL_INCREASING

    @property
    def native_value(self) -> int:
        """Return the state of the sensor."""
        # Check coordinator data first (includes service call updates)
        if self.coordinator.data:
            visitor_stats = self.coordinator.data.get("visitor_stats", {})
            if visitor_stats.get("today") is not None:
                return visitor_stats.get("today", 0)
        
        # Fallback to system info from API
        system_info = self.coordinator.async_get_system_info()
        stats = system_info.get("stats", {})
        return stats.get("today", 0)


class WhoRangVisitorCountWeekSensor(WhoRangSensorEntity):
    """Sensor for this week's visitor count."""

    def __init__(
        self,
        coordinator: WhoRangDataUpdateCoordinator,
        config_entry: ConfigEntry,
    ) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator, config_entry, SENSOR_VISITOR_COUNT_WEEK)
        self._attr_name = "Visitors This Week"
        self._attr_icon = "mdi:counter"
        self._attr_native_unit_of_measurement = UNIT_VISITORS
        self._attr_state_class = STATE_CLASS_TOTAL_INCREASING

    @property
    def native_value(self) -> int:
        """Return the state of the sensor."""
        system_info = self.coordinator.async_get_system_info()
        stats = system_info.get("stats", {})
        return stats.get("week", 0)


class WhoRangVisitorCountMonthSensor(WhoRangSensorEntity):
    """Sensor for this month's visitor count."""

    def __init__(
        self,
        coordinator: WhoRangDataUpdateCoordinator,
        config_entry: ConfigEntry,
    ) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator, config_entry, SENSOR_VISITOR_COUNT_MONTH)
        self._attr_name = "Visitors This Month"
        self._attr_icon = "mdi:counter"
        self._attr_native_unit_of_measurement = UNIT_VISITORS
        self._attr_state_class = STATE_CLASS_TOTAL_INCREASING

    @property
    def native_value(self) -> int:
        """Return the state of the sensor."""
        system_info = self.coordinator.async_get_system_info()
        stats = system_info.get("stats", {})
        return stats.get("month", 0)


class WhoRangSystemStatusSensor(WhoRangSensorEntity):
    """Sensor for system status."""

    def __init__(
        self,
        coordinator: WhoRangDataUpdateCoordinator,
        config_entry: ConfigEntry,
    ) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator, config_entry, SENSOR_SYSTEM_STATUS)
        self._attr_name = "System Status"
        self._attr_icon = "mdi:server"
        self._attr_entity_category = EntityCategory.DIAGNOSTIC

    @property
    def native_value(self) -> str:
        """Return the state of the sensor."""
        system_info = self.coordinator.async_get_system_info()
        health = system_info.get("health", {})
        return health.get("status", "unknown")

    @property
    def extra_state_attributes(self) -> Dict[str, Any]:
        """Return additional state attributes."""
        system_info = self.coordinator.async_get_system_info()
        health = system_info.get("health", {})
        stats = system_info.get("stats", {})
        
        return {
            "uptime": health.get("uptime"),
            "environment": health.get("environment"),
            "connected_clients": stats.get("connectedClients", 0),
            "is_online": stats.get("isOnline", False),
            "websocket_connected": self.coordinator.async_is_websocket_connected(),
        }


class WhoRangAIProviderSensor(WhoRangSensorEntity):
    """Sensor for active AI provider."""

    def __init__(
        self,
        coordinator: WhoRangDataUpdateCoordinator,
        config_entry: ConfigEntry,
    ) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator, config_entry, SENSOR_AI_PROVIDER_ACTIVE)
        self._attr_name = "AI Provider"
        self._attr_icon = "mdi:brain"
        self._attr_entity_category = EntityCategory.DIAGNOSTIC

    @property
    def native_value(self) -> str:
        """Return the state of the sensor."""
        system_info = self.coordinator.async_get_system_info()
        face_config = system_info.get("face_config", {})
        return face_config.get("ai_provider", "unknown")

    @property
    def extra_state_attributes(self) -> Dict[str, Any]:
        """Return additional state attributes."""
        system_info = self.coordinator.async_get_system_info()
        face_config = system_info.get("face_config", {})
        
        return {
            "enabled": face_config.get("enabled", False),
            "confidence_threshold": face_config.get("confidence_threshold"),
            "cost_tracking_enabled": face_config.get("cost_tracking_enabled", False),
            "monthly_budget_limit": face_config.get("monthly_budget_limit"),
        }


class WhoRangAICostTodaySensor(WhoRangSensorEntity):
    """Sensor for today's AI processing costs."""

    def __init__(
        self,
        coordinator: WhoRangDataUpdateCoordinator,
        config_entry: ConfigEntry,
    ) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator, config_entry, SENSOR_AI_COST_TODAY)
        self._attr_name = "AI Cost Today"
        self._attr_icon = "mdi:currency-usd"
        self._attr_native_unit_of_measurement = UNIT_CURRENCY_USD
        self._attr_device_class = SensorDeviceClass.MONETARY
        self._attr_state_class = STATE_CLASS_TOTAL  # Use TOTAL instead of TOTAL_INCREASING for monetary

    @property
    def native_value(self) -> float:
        """Return the state of the sensor."""
        ai_usage = self.coordinator.async_get_ai_usage()
        total_cost = ai_usage.get("total_cost", 0)
        
        # Ensure we return a proper float value, rounded to 4 decimal places for currency precision
        if isinstance(total_cost, (int, float)):
            return round(float(total_cost), 4)
        return 0.0

    @property
    def extra_state_attributes(self) -> Dict[str, Any]:
        """Return additional state attributes."""
        ai_usage = self.coordinator.async_get_ai_usage()
        
        # Build comprehensive attributes with provider breakdown
        attributes = {
            "total_requests": ai_usage.get("total_requests", 0),
            "period": ai_usage.get("period", "24h"),
            "providers_count": len(ai_usage.get("providers", [])),
        }
        
        # Add provider-specific cost breakdown
        providers = ai_usage.get("providers", [])
        for provider_data in providers:
            provider_name = provider_data.get("provider", "unknown")
            attributes[f"{provider_name}_cost"] = round(provider_data.get("cost", 0), 4)
            attributes[f"{provider_name}_requests"] = provider_data.get("requests", 0)
            attributes[f"{provider_name}_tokens"] = provider_data.get("tokens", 0)
            attributes[f"{provider_name}_success_rate"] = round(provider_data.get("success_rate", 0), 1)
        
        # Add budget information if available
        budget = ai_usage.get("budget", {})
        if budget:
            attributes["monthly_budget_limit"] = budget.get("monthly_limit", 0)
            attributes["monthly_spent"] = round(budget.get("monthly_spent", 0), 4)
            attributes["monthly_remaining"] = round(budget.get("remaining", 0), 4)
            
            # Calculate budget usage percentage
            monthly_limit = budget.get("monthly_limit", 0)
            monthly_spent = budget.get("monthly_spent", 0)
            if monthly_limit > 0:
                attributes["budget_usage_percent"] = round((monthly_spent / monthly_limit) * 100, 1)
            else:
                attributes["budget_usage_percent"] = 0
        
        # Add provider list for easy reference
        attributes["active_providers"] = [p.get("provider") for p in providers if p.get("cost", 0) > 0]
        
        return attributes


class WhoRangAICostMonthSensor(WhoRangSensorEntity):
    """Sensor for this month's AI processing costs."""

    def __init__(
        self,
        coordinator: WhoRangDataUpdateCoordinator,
        config_entry: ConfigEntry,
    ) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator, config_entry, SENSOR_AI_COST_MONTH)
        self._attr_name = "AI Cost This Month"
        self._attr_icon = "mdi:currency-usd"
        self._attr_native_unit_of_measurement = UNIT_CURRENCY_USD
        self._attr_device_class = SensorDeviceClass.MONETARY
        self._attr_state_class = STATE_CLASS_TOTAL

    @property
    def native_value(self) -> float:
        """Return the state of the sensor."""
        ai_usage = self.coordinator.async_get_ai_usage()
        
        # Get monthly cost from budget information
        budget = ai_usage.get("budget", {})
        monthly_spent = budget.get("monthly_spent", 0)
        
        # Ensure we return a proper float value, rounded to 4 decimal places for currency precision
        if isinstance(monthly_spent, (int, float)):
            return round(float(monthly_spent), 4)
        return 0.0

    @property
    def extra_state_attributes(self) -> Dict[str, Any]:
        """Return additional state attributes."""
        ai_usage = self.coordinator.async_get_ai_usage()
        budget = ai_usage.get("budget", {})
        
        attributes = {
            "period": "monthly",
            "monthly_budget_limit": budget.get("monthly_limit", 0),
            "monthly_remaining": round(budget.get("remaining", 0), 4),
        }
        
        # Calculate budget usage percentage
        monthly_limit = budget.get("monthly_limit", 0)
        monthly_spent = budget.get("monthly_spent", 0)
        if monthly_limit > 0:
            attributes["budget_usage_percent"] = round((monthly_spent / monthly_limit) * 100, 1)
        else:
            attributes["budget_usage_percent"] = 0
        
        # Add provider breakdown for the month if available
        providers = ai_usage.get("providers", [])
        monthly_providers = []
        for provider_data in providers:
            provider_name = provider_data.get("provider", "unknown")
            monthly_cost = provider_data.get("monthly_cost", 0)
            if monthly_cost > 0:
                monthly_providers.append({
                    "provider": provider_name,
                    "cost": round(monthly_cost, 4),
                    "requests": provider_data.get("monthly_requests", 0)
                })
        
        attributes["monthly_providers"] = monthly_providers
        attributes["active_providers_count"] = len(monthly_providers)
        
        return attributes


class WhoRangAIResponseTimeSensor(WhoRangSensorEntity):
    """Sensor for latest AI response time."""

    def __init__(
        self,
        coordinator: WhoRangDataUpdateCoordinator,
        config_entry: ConfigEntry,
    ) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator, config_entry, SENSOR_AI_RESPONSE_TIME)
        self._attr_name = "AI Response Time"
        self._attr_icon = "mdi:timer"
        self._attr_native_unit_of_measurement = UNIT_MILLISECONDS
        self._attr_device_class = SensorDeviceClass.DURATION
        self._attr_state_class = STATE_CLASS_MEASUREMENT

    @property
    def native_value(self) -> Optional[int]:
        """Return the state of the sensor."""
        # Check coordinator data first (includes service call updates and WebSocket data)
        if self.coordinator.data:
            latest_visitor = self.coordinator.data.get("latest_visitor")
            if latest_visitor and latest_visitor.get("processing_time"):
                processing_time = latest_visitor.get("processing_time")
                if isinstance(processing_time, str):
                    # Handle string format (remove "ms" suffix if present)
                    return int(processing_time.replace("ms", ""))
                elif isinstance(processing_time, (int, float)):
                    return int(processing_time)
            
            # Check WebSocket analysis status data
            analysis_status = self.coordinator.data.get("analysis_status", {})
            if analysis_status.get("processing_time_ms"):
                return int(analysis_status.get("processing_time_ms"))
        
        # Fallback to API data
        latest_visitor = self.coordinator.async_get_latest_visitor()
        if latest_visitor and latest_visitor.get("processing_time"):
            processing_time = latest_visitor.get("processing_time")
            if isinstance(processing_time, str):
                # Handle string format (remove "ms" suffix if present)
                return int(processing_time.replace("ms", ""))
            elif isinstance(processing_time, (int, float)):
                return int(processing_time)
        
        return None

    @property
    def extra_state_attributes(self) -> Dict[str, Any]:
        """Return additional state attributes."""
        attributes = {}
        
        # Get processing time details from coordinator data
        if self.coordinator.data:
            latest_visitor = self.coordinator.data.get("latest_visitor", {})
            analysis_status = self.coordinator.data.get("analysis_status", {})
            
            # Add AI provider information
            attributes["ai_provider"] = latest_visitor.get("analysis_provider") or analysis_status.get("provider")
            attributes["analysis_timestamp"] = latest_visitor.get("analysis_timestamp") or analysis_status.get("timestamp")
            attributes["confidence_score"] = latest_visitor.get("confidence") or analysis_status.get("confidence")
            
            # Add processing status
            if analysis_status:
                attributes["analysis_status"] = analysis_status.get("status", "unknown")
                attributes["visitor_id"] = analysis_status.get("visitor_id")
        
        # Fallback to API data
        if not attributes:
            latest_visitor = self.coordinator.async_get_latest_visitor()
            if latest_visitor:
                attributes["ai_provider"] = latest_visitor.get("ai_provider", "unknown")
                attributes["analysis_timestamp"] = latest_visitor.get("timestamp")
                attributes["confidence_score"] = latest_visitor.get("confidence_score")
                attributes["visitor_id"] = latest_visitor.get("visitor_id")
        
        return attributes


class WhoRangKnownFacesCountSensor(WhoRangSensorEntity):
    """Sensor for known faces count."""

    def __init__(
        self,
        coordinator: WhoRangDataUpdateCoordinator,
        config_entry: ConfigEntry,
    ) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator, config_entry, SENSOR_KNOWN_FACES_COUNT)
        self._attr_name = "Known Faces"
        self._attr_icon = "mdi:face-recognition"
        self._attr_native_unit_of_measurement = UNIT_FACES
        self._attr_state_class = STATE_CLASS_TOTAL

    @property
    def native_value(self) -> int:
        """Return the state of the sensor."""
        known_persons = self.coordinator.async_get_known_persons()
        return len(known_persons)

    @property
    def extra_state_attributes(self) -> Dict[str, Any]:
        """Return additional state attributes."""
        known_persons = self.coordinator.async_get_known_persons()
        
        return {
            "persons": [
                {
                    "id": person.get("id"),
                    "name": person.get("name"),
                    "face_count": person.get("face_count", 0),
                    "last_seen": person.get("last_seen"),
                }
                for person in known_persons
            ]
        }


class WhoRangUnknownFacesSensor(WhoRangSensorEntity):
    """Sensor for unknown faces requiring labeling."""

    def __init__(
        self,
        coordinator: WhoRangDataUpdateCoordinator,
        config_entry: ConfigEntry,
    ) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator, config_entry, SENSOR_UNKNOWN_FACES)
        self._attr_name = "Unknown Faces"
        self._attr_icon = "mdi:face-recognition"
        self._attr_native_unit_of_measurement = UNIT_FACES
        self._attr_state_class = STATE_CLASS_TOTAL
        self._attr_entity_category = EntityCategory.DIAGNOSTIC

    @property
    def native_value(self) -> int:
        """Return the number of unknown faces requiring labeling."""
        # Check coordinator data first (includes WebSocket updates)
        if self.coordinator.data:
            unknown_faces = self.coordinator.data.get(ATTR_UNKNOWN_FACES, [])
            if isinstance(unknown_faces, list):
                return len(unknown_faces)
            elif isinstance(unknown_faces, int):
                return unknown_faces
        
        # Fallback to API call
        try:
            # This will be populated by the coordinator when it fetches unknown faces
            return 0
        except Exception as e:
            _LOGGER.error("Failed to get unknown faces count: %s", e)
            return 0

    @property
    def extra_state_attributes(self) -> Dict[str, Any]:
        """Return unknown faces data as attributes."""
        attributes = {}
        
        # Get unknown faces from coordinator data
        if self.coordinator.data:
            unknown_faces = self.coordinator.data.get(ATTR_UNKNOWN_FACES, [])
            
            if isinstance(unknown_faces, list):
                attributes[ATTR_UNKNOWN_FACES] = unknown_faces
                attributes[ATTR_REQUIRES_LABELING] = len(unknown_faces) > 0
                
                # Add summary information
                if unknown_faces:
                    attributes["latest_unknown_face"] = unknown_faces[-1] if unknown_faces else None
                    attributes["oldest_unknown_face"] = unknown_faces[0] if unknown_faces else None
                    
                    # Quality statistics
                    qualities = [face.get("quality_score", 0) for face in unknown_faces if isinstance(face, dict)]
                    if qualities:
                        attributes["avg_quality"] = round(sum(qualities) / len(qualities), 2)
                        attributes["min_quality"] = min(qualities)
                        attributes["max_quality"] = max(qualities)
                
                # Enhanced face details for easy viewing and labeling
                face_details = []
                face_ids = []
                for face in unknown_faces:
                    if isinstance(face, dict):
                        face_id = face.get("id")
                        if face_id:
                            face_ids.append(face_id)
                            
                            # Create comprehensive face detail for UI display
                            face_detail = {
                                "face_id": face_id,
                                "quality_score": face.get("quality_score", 0),
                                "confidence": face.get("confidence", 0),
                                "face_crop_path": face.get("face_crop_path", ""),
                                "thumbnail_path": face.get("thumbnail_path", ""),
                                "created_at": face.get("created_at", ""),
                                "visitor_event_id": face.get("visitor_event_id", ""),
                                "original_image": face.get("original_image", ""),
                                "ai_title": face.get("ai_title", ""),
                                "timestamp": face.get("timestamp", ""),
                                # Construct full image URLs for easy access
                                "face_image_url": f"{self.coordinator.api_client.base_url}{face.get('face_crop_path', '')}" if face.get('face_crop_path') else None,
                                "thumbnail_url": f"{self.coordinator.api_client.base_url}{face.get('thumbnail_path', '')}" if face.get('thumbnail_path') else None,
                                "original_image_url": f"{self.coordinator.api_client.base_url}{face.get('original_image', '')}" if face.get('original_image') else None,
                            }
                            face_details.append(face_detail)
                
                attributes["face_ids"] = face_ids
                attributes["face_details"] = face_details
                
                # Add quick labeling information
                if face_details:
                    attributes["next_face_to_label"] = face_details[0]  # Highest quality or most recent
                    attributes["labeling_instructions"] = f"Use service whorang.label_face with face_id and person_name"
                    
            else:
                attributes[ATTR_REQUIRES_LABELING] = unknown_faces > 0 if isinstance(unknown_faces, int) else False
        
        # If no unknown faces in coordinator data, try to fetch them
        if not attributes.get(ATTR_UNKNOWN_FACES):
            try:
                # This will trigger the service to fetch unknown faces
                attributes["fetch_instruction"] = "Call service whorang.get_unknown_faces to populate this sensor"
                attributes[ATTR_REQUIRES_LABELING] = False
            except Exception as e:
                _LOGGER.debug("No unknown faces data available: %s", e)
        
        return attributes


class WhoRangKnownPersonsGallerySensor(WhoRangSensorEntity):
    """Sensor providing known persons gallery data with avatars."""

    def __init__(
        self,
        coordinator: WhoRangDataUpdateCoordinator,
        config_entry: ConfigEntry,
    ) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator, config_entry, "known_persons_gallery")
        self._attr_name = "Known Persons Gallery"
        self._attr_icon = "mdi:account-group"
        self._attr_entity_category = EntityCategory.DIAGNOSTIC

    @property
    def native_value(self) -> int:
        """Return the number of known persons."""
        try:
            # Get face gallery data from coordinator
            if self.coordinator.data and "face_gallery_data" in self.coordinator.data:
                gallery_data = self.coordinator.data["face_gallery_data"]
                if gallery_data.get("gallery_ready", False):
                    return gallery_data.get("total_known", 0)
                else:
                    return 0
            else:
                # Fallback to known persons from coordinator
                known_persons = self.coordinator.async_get_known_persons()
                return len(known_persons)
        except Exception as e:
            _LOGGER.error("Failed to get known persons count: %s", e)
            return 0

    @property
    def extra_state_attributes(self) -> Dict[str, Any]:
        """Return known persons gallery data as attributes."""
        try:
            # Get face gallery data from coordinator
            if self.coordinator.data and "face_gallery_data" in self.coordinator.data:
                gallery_data = self.coordinator.data["face_gallery_data"]
                
                if gallery_data.get("gallery_ready", False):
                    # Process known persons with full avatar URLs
                    known_persons = gallery_data.get("known_persons", [])
                    processed_persons = []
                    
                    for person in known_persons:
                        processed_person = {
                            "id": person.get("id"),
                            "name": person.get("name"),
                            "face_count": person.get("face_count", 0),
                            "last_seen": person.get("last_seen"),
                            "first_seen": person.get("first_seen"),
                            "avatar_url": person.get("avatar_url"),
                            "avg_confidence": person.get("avg_confidence", 0),
                            "recognition_count": person.get("recognition_count", 0),
                            "notes": person.get("notes", ""),
                            "created_at": person.get("created_at"),
                            "updated_at": person.get("updated_at")
                        }
                        processed_persons.append(processed_person)
                    
                    # Calculate statistics
                    total_faces = sum(p.get("face_count", 0) for p in processed_persons)
                    avg_faces_per_person = round(total_faces / len(processed_persons), 1) if processed_persons else 0
                    
                    # Find most and least active persons
                    most_active = max(processed_persons, key=lambda p: p.get("face_count", 0)) if processed_persons else None
                    least_active = min(processed_persons, key=lambda p: p.get("face_count", 0)) if processed_persons else None
                    
                    # Find most recent activity
                    recent_persons = [p for p in processed_persons if p.get("last_seen")]
                    most_recent = max(recent_persons, key=lambda p: p.get("last_seen", "")) if recent_persons else None
                    
                    return {
                        "persons": processed_persons,
                        "total_known_persons": len(processed_persons),
                        "total_labeled_faces": total_faces,
                        "avg_faces_per_person": avg_faces_per_person,
                        "most_active_person": most_active,
                        "least_active_person": least_active,
                        "most_recent_activity": most_recent,
                        "gallery_ready": True,
                        "backend_url": self.coordinator.api_client.base_url,
                        "last_updated": gallery_data.get("last_updated")
                    }
                else:
                    # Gallery data exists but not ready - check if it's an empty result vs error
                    error = gallery_data.get("error")
                    known_persons = gallery_data.get("known_persons", [])
                    
                    # If we have an empty list but no error, treat as ready with empty data
                    if not error and isinstance(known_persons, list) and len(known_persons) == 0:
                        return {
                            "persons": [],
                            "total_known_persons": 0,
                            "total_labeled_faces": 0,
                            "avg_faces_per_person": 0,
                            "gallery_ready": True,  # Set to True for empty but valid result
                            "backend_url": self.coordinator.api_client.base_url,
                            "last_updated": gallery_data.get("last_updated")
                        }
                    else:
                        # Actual error state
                        return {
                            "persons": [],
                            "total_known_persons": 0,
                            "total_labeled_faces": 0,
                            "avg_faces_per_person": 0,
                            "gallery_ready": False,
                            "error": error or "Gallery not ready",
                            "backend_url": self.coordinator.api_client.base_url,
                            "last_updated": gallery_data.get("last_updated")
                        }
            else:
                # Fallback to basic known persons data
                known_persons = self.coordinator.async_get_known_persons()
                processed_persons = []
                
                for person in known_persons:
                    processed_person = {
                        "id": person.get("id"),
                        "name": person.get("name"),
                        "face_count": person.get("face_count", 0),
                        "last_seen": person.get("last_seen"),
                        "avatar_url": None,  # Will need to be constructed
                        "avg_confidence": 0,
                        "recognition_count": 0,
                        "notes": person.get("notes", "")
                    }
                    processed_persons.append(processed_person)
                
                # If we successfully got known persons data (even if empty), mark as ready
                gallery_ready = True  # We have definitive data from the coordinator
                
                return {
                    "persons": processed_persons,
                    "total_known_persons": len(processed_persons),
                    "total_labeled_faces": sum(p.get("face_count", 0) for p in processed_persons),
                    "avg_faces_per_person": 0,
                    "gallery_ready": gallery_ready,
                    "backend_url": self.coordinator.api_client.base_url,
                    "fetch_instruction": "Using fallback known persons data" if len(processed_persons) == 0 else None
                }
                
        except Exception as e:
            _LOGGER.error("Failed to get known persons gallery attributes: %s", e)
            return {
                "persons": [],
                "total_known_persons": 0,
                "total_labeled_faces": 0,
                "avg_faces_per_person": 0,
                "gallery_ready": True,  # Set to True so card can show empty state instead of loading forever
                "backend_url": self.coordinator.api_client.base_url,
                "error": str(e)
            }


class WhoRangLatestFaceDetectionSensor(WhoRangSensorEntity):
    """Sensor for latest face detection results."""

    def __init__(
        self,
        coordinator: WhoRangDataUpdateCoordinator,
        config_entry: ConfigEntry,
    ) -> None:
        """Initialize the sensor."""
        super().__init__(coordinator, config_entry, SENSOR_LATEST_FACE_DETECTION)
        self._attr_name = "Latest Face Detection"
        self._attr_icon = "mdi:face-man"

    @property
    def native_value(self) -> str:
        """Return the latest face detection status."""
        # Check coordinator data first (includes WebSocket updates)
        if self.coordinator.data:
            latest_visitor = self.coordinator.data.get("latest_visitor", {})
            faces_detected = latest_visitor.get(ATTR_FACES_DETECTED, 0)
            
            if faces_detected == 0:
                return "No faces detected"
            elif faces_detected == 1:
                return "1 face detected"
            else:
                return f"{faces_detected} faces detected"
        
        # Fallback to API data
        latest_visitor = self.coordinator.async_get_latest_visitor()
        if latest_visitor:
            faces_detected = latest_visitor.get(ATTR_FACES_DETECTED, 0)
            if faces_detected == 0:
                return "No faces detected"
            elif faces_detected == 1:
                return "1 face detected"
            else:
                return f"{faces_detected} faces detected"
        
        return "No detection data"

    @property
    def extra_state_attributes(self) -> Dict[str, Any]:
        """Return face detection details."""
        attributes = {}
        
        # Get face detection data from coordinator
        if self.coordinator.data:
            latest_visitor = self.coordinator.data.get("latest_visitor", {})
            
            # Basic face detection info
            attributes[ATTR_FACES_DETECTED] = latest_visitor.get(ATTR_FACES_DETECTED, 0)
            attributes[ATTR_TIMESTAMP] = latest_visitor.get(ATTR_TIMESTAMP)
            attributes[ATTR_VISITOR_ID] = latest_visitor.get(ATTR_VISITOR_ID)
            attributes[ATTR_IMAGE_URL] = latest_visitor.get(ATTR_IMAGE_URL)
            
            # Face details
            face_details = latest_visitor.get(ATTR_FACE_DETAILS, [])
            if face_details:
                attributes[ATTR_FACE_DETAILS] = face_details
                
                # Extract face information
                face_ids = []
                face_qualities = []
                face_crops = []
                
                for face in face_details:
                    if isinstance(face, dict):
                        if face.get(ATTR_FACE_ID):
                            face_ids.append(face[ATTR_FACE_ID])
                        if face.get(ATTR_FACE_QUALITY):
                            face_qualities.append(face[ATTR_FACE_QUALITY])
                        if face.get(ATTR_FACE_CROP_PATH):
                            face_crops.append(face[ATTR_FACE_CROP_PATH])
                
                attributes["face_ids"] = face_ids
                attributes["face_qualities"] = face_qualities
                attributes["face_crop_paths"] = face_crops
                
                # Quality statistics
                if face_qualities:
                    attributes["avg_face_quality"] = round(sum(face_qualities) / len(face_qualities), 2)
                    attributes["best_face_quality"] = max(face_qualities)
                    attributes["worst_face_quality"] = min(face_qualities)
            
            # Known vs unknown faces
            known_faces = latest_visitor.get(ATTR_KNOWN_FACES, [])
            unknown_faces = latest_visitor.get(ATTR_UNKNOWN_FACES, [])
            
            attributes[ATTR_KNOWN_FACES] = known_faces
            attributes[ATTR_UNKNOWN_FACES] = unknown_faces
            attributes["known_faces_count"] = len(known_faces) if isinstance(known_faces, list) else 0
            attributes["unknown_faces_count"] = len(unknown_faces) if isinstance(unknown_faces, list) else 0
            attributes[ATTR_REQUIRES_LABELING] = len(unknown_faces) > 0 if isinstance(unknown_faces, list) else False
            
            # Recognition status
            if known_faces:
                recognized_names = []
                for face in known_faces:
                    if isinstance(face, dict) and face.get("person_name"):
                        recognized_names.append(face["person_name"])
                attributes["recognized_persons"] = recognized_names
                attributes["face_recognized"] = True
            else:
                attributes["face_recognized"] = False
                attributes["recognized_persons"] = []
        
        # Fallback to API data if no coordinator data
        if not attributes:
            latest_visitor = self.coordinator.async_get_latest_visitor()
            if latest_visitor:
                attributes[ATTR_FACES_DETECTED] = latest_visitor.get(ATTR_FACES_DETECTED, 0)
                attributes[ATTR_TIMESTAMP] = latest_visitor.get(ATTR_TIMESTAMP)
                attributes[ATTR_VISITOR_ID] = latest_visitor.get(ATTR_VISITOR_ID)
                attributes[ATTR_IMAGE_URL] = latest_visitor.get(ATTR_IMAGE_URL)
                attributes["face_recognized"] = latest_visitor.get("face_recognized", False)
        
        return attributes
