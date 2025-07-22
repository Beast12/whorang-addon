"""Automation engine for WhoRang AI Doorbell integration."""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from homeassistant.core import HomeAssistant
from homeassistant.helpers.template import Template

_LOGGER = logging.getLogger(__name__)


class AutomationEngine:
    """Coordinates doorbell detection, camera snapshots, and AI analysis."""

    def __init__(self, hass: HomeAssistant, coordinator) -> None:
        """Initialize the automation engine."""
        self.hass = hass
        self.coordinator = coordinator
        self._doorbell_detector = None
        self._camera_manager = None
        self._config = {}
        self._events_processed = 0
        self._successful_events = 0
        self._failed_events = 0
        self._last_event_time = None
        
    async def async_setup(self, config: Dict[str, Any]) -> None:
        """Set up the automation engine with configuration."""
        self._config = config.get("intelligent_automation", {})
        
        # Import and initialize components
        from .doorbell_detector import DoorbellDetector
        from .camera_manager import CameraManager
        
        # Initialize doorbell detector
        self._doorbell_detector = DoorbellDetector(self.hass, self.coordinator)
        await self._doorbell_detector.async_setup(self._config)
        
        # Initialize camera manager
        self._camera_manager = CameraManager(self.hass, self.coordinator)
        await self._camera_manager.async_setup(self._config)
        
        # Store references in coordinator for access from other components
        self.coordinator._automation_engine = self
        self.coordinator._doorbell_detector = self._doorbell_detector
        self.coordinator._camera_manager = self._camera_manager
        
        _LOGGER.info("Automation engine setup complete")

    async def async_shutdown(self) -> None:
        """Shutdown the automation engine."""
        if self._doorbell_detector:
            await self._doorbell_detector.async_shutdown()
        
        _LOGGER.info("Automation engine shutdown complete")

    async def handle_doorbell_event(self, event_data: Dict[str, Any]) -> None:
        """Handle a doorbell trigger event and coordinate the response."""
        try:
            self._events_processed += 1
            self._last_event_time = datetime.now()
            
            doorbell_entity = event_data.get("doorbell_entity")
            camera_entity = event_data.get("camera_entity")
            
            _LOGGER.info("Processing doorbell event: %s -> %s", doorbell_entity, camera_entity)
            
            # Step 1: Capture camera snapshot if camera is available
            snapshot_info = None
            if camera_entity and self._camera_manager:
                snapshot_info = await self._capture_doorbell_snapshot(camera_entity, event_data)
            else:
                _LOGGER.warning("No camera entity available for doorbell: %s", doorbell_entity)
            
            # Step 2: Process the doorbell event with WhoRang backend
            await self._process_with_whorang_backend(event_data, snapshot_info)
            
            # Step 3: Update Home Assistant entities
            await self._update_home_assistant_entities(event_data, snapshot_info)
            
            # Step 4: Fire Home Assistant events for user automations
            await self._fire_home_assistant_events(event_data, snapshot_info)
            
            self._successful_events += 1
            _LOGGER.info("Successfully processed doorbell event from %s", doorbell_entity)
            
        except Exception as err:
            self._failed_events += 1
            _LOGGER.error("Error processing doorbell event: %s", err, exc_info=True)

    async def _capture_doorbell_snapshot(self, camera_entity: str, event_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Capture a snapshot from the doorbell camera."""
        try:
            # Prepare snapshot context
            snapshot_context = {
                "doorbell_trigger": True,
                "doorbell_entity": event_data.get("doorbell_entity"),
                "trigger_time": event_data.get("trigger_time"),
                "trigger_state": event_data.get("trigger_state"),
                "snapshot_delay": self._config.get("snapshot_delay", 1)
            }
            
            # Capture snapshot
            snapshot_info = await self._camera_manager.async_capture_snapshot(camera_entity, snapshot_context)
            
            if snapshot_info:
                _LOGGER.info("Captured doorbell snapshot: %s", snapshot_info["filename"])
                return snapshot_info
            else:
                _LOGGER.warning("Failed to capture doorbell snapshot from %s", camera_entity)
                return None
                
        except Exception as err:
            _LOGGER.error("Error capturing doorbell snapshot: %s", err)
            return None

    async def _process_with_whorang_backend(self, event_data: Dict[str, Any], snapshot_info: Optional[Dict[str, Any]]) -> None:
        """Process the doorbell event with WhoRang backend for AI analysis."""
        try:
            if not snapshot_info:
                _LOGGER.warning("No snapshot available for WhoRang processing")
                return
            
            # Get AI configuration from integration options
            config_entry = None
            for entry in self.hass.config_entries.async_entries("whorang"):
                if entry.state.name == "loaded":
                    config_entry = entry
                    break
            
            # Prepare event data for WhoRang backend
            whorang_event_data = {
                "image_url": snapshot_info["url"],
                "location": "front_door",  # Default location
                "ai_title": "Automatic Doorbell Detection",
                "timestamp": datetime.now().isoformat(),
                "source": "intelligent_automation",
                
                # Add weather context if available
                **await self._get_weather_context(),
                
                # Add AI template configuration
                **self._get_ai_template_config(config_entry)
            }
            
            # Process with coordinator (which handles backend communication)
            success = await self.coordinator.async_process_doorbell_event(whorang_event_data)
            
            if success:
                _LOGGER.info("Successfully sent doorbell event to WhoRang backend")
            else:
                _LOGGER.warning("Failed to process doorbell event with WhoRang backend")
                
        except Exception as err:
            _LOGGER.error("Error processing with WhoRang backend: %s", err)

    async def _get_weather_context(self) -> Dict[str, Any]:
        """Get weather context from Home Assistant weather entities."""
        try:
            weather_data = {}
            
            # Find weather entities
            weather_entities = [entity_id for entity_id in self.hass.states.async_entity_ids() 
                              if entity_id.startswith("weather.")]
            
            if weather_entities:
                # Use the first available weather entity
                weather_entity = weather_entities[0]
                weather_state = self.hass.states.get(weather_entity)
                
                if weather_state and weather_state.state != "unavailable":
                    attributes = weather_state.attributes
                    
                    weather_data = {
                        "weather_condition": weather_state.state,
                        "weather_temp": attributes.get("temperature"),
                        "weather_humidity": attributes.get("humidity"),
                        "wind_speed": attributes.get("wind_speed"),
                        "pressure": attributes.get("pressure")
                    }
                    
                    _LOGGER.debug("Retrieved weather context: %s", weather_data)
            
            return weather_data
            
        except Exception as err:
            _LOGGER.error("Error getting weather context: %s", err)
            return {}

    def _get_ai_template_config(self, config_entry) -> Dict[str, Any]:
        """Get AI template configuration from integration options."""
        try:
            if not config_entry or not config_entry.options:
                return {
                    "ai_prompt_template": "professional",
                    "custom_ai_prompt": "",
                    "enable_weather_context": True
                }
            
            automation_config = config_entry.options.get("intelligent_automation", {})
            
            return {
                "ai_prompt_template": automation_config.get("ai_prompt_template", "professional"),
                "custom_ai_prompt": automation_config.get("custom_ai_prompt", ""),
                "enable_weather_context": automation_config.get("enable_weather_context", True)
            }
            
        except Exception as err:
            _LOGGER.error("Error getting AI template config: %s", err)
            return {
                "ai_prompt_template": "professional",
                "custom_ai_prompt": "",
                "enable_weather_context": True
            }

    async def _update_home_assistant_entities(self, event_data: Dict[str, Any], snapshot_info: Optional[Dict[str, Any]]) -> None:
        """Update Home Assistant entities with doorbell event information."""
        try:
            # Update coordinator data to trigger entity updates
            current_time = datetime.now()
            
            # Update doorbell state
            doorbell_state = {
                "last_triggered": current_time.isoformat(),
                "is_triggered": True,
                "trigger_source": "intelligent_automation",
                "doorbell_entity": event_data.get("doorbell_entity"),
                "camera_entity": event_data.get("camera_entity")
            }
            
            # Update latest image if snapshot was captured
            latest_image = {}
            if snapshot_info:
                latest_image = {
                    "url": snapshot_info["url"],
                    "timestamp": snapshot_info["timestamp"],
                    "status": "available",
                    "source": "intelligent_automation",
                    "filename": snapshot_info["filename"]
                }
            
            # Update coordinator data
            if hasattr(self.coordinator, 'data') and self.coordinator.data:
                self.coordinator.data.update({
                    "doorbell_state": doorbell_state,
                    "latest_image": latest_image,
                    "last_automation_event": {
                        "timestamp": current_time.isoformat(),
                        "event_data": event_data,
                        "snapshot_captured": snapshot_info is not None
                    }
                })
                
                # Trigger coordinator update
                self.coordinator.async_set_updated_data(self.coordinator.data)
            
            _LOGGER.debug("Updated Home Assistant entities with doorbell event")
            
        except Exception as err:
            _LOGGER.error("Error updating Home Assistant entities: %s", err)

    async def _fire_home_assistant_events(self, event_data: Dict[str, Any], snapshot_info: Optional[Dict[str, Any]]) -> None:
        """Fire Home Assistant events for user automations."""
        try:
            # Fire doorbell detected event
            self.hass.bus.async_fire("whorang_intelligent_doorbell_detected", {
                "doorbell_entity": event_data.get("doorbell_entity"),
                "camera_entity": event_data.get("camera_entity"),
                "trigger_time": event_data.get("trigger_time"),
                "trigger_state": event_data.get("trigger_state"),
                "snapshot_captured": snapshot_info is not None,
                "snapshot_url": snapshot_info["url"] if snapshot_info else None,
                "automation_source": "intelligent_automation"
            })
            
            # Fire snapshot captured event if applicable
            if snapshot_info:
                self.hass.bus.async_fire("whorang_intelligent_snapshot_captured", {
                    "camera_entity": snapshot_info["camera_entity"],
                    "filename": snapshot_info["filename"],
                    "url": snapshot_info["url"],
                    "file_size": snapshot_info["file_size"],
                    "timestamp": snapshot_info["timestamp"]
                })
            
            _LOGGER.debug("Fired Home Assistant events for doorbell detection")
            
        except Exception as err:
            _LOGGER.error("Error firing Home Assistant events: %s", err)

    async def async_test_automation(self, doorbell_entity: str) -> Dict[str, Any]:
        """Test the complete automation workflow."""
        try:
            _LOGGER.info("Testing automation workflow for doorbell: %s", doorbell_entity)
            
            # Get doorbell state
            doorbell_state = self.hass.states.get(doorbell_entity)
            if not doorbell_state:
                return {
                    "success": False,
                    "message": f"Doorbell entity not found: {doorbell_entity}",
                    "error": "Entity not found"
                }
            
            # Create test event data
            test_event_data = {
                "doorbell_entity": doorbell_entity,
                "camera_entity": self._doorbell_detector._find_camera_for_doorbell(doorbell_entity) if self._doorbell_detector else None,
                "trigger_state": "on",
                "trigger_time": datetime.now().isoformat(),
                "test": True,
                "doorbell_info": self._doorbell_detector._detected_doorbells.get(doorbell_entity, {}) if self._doorbell_detector else {},
                "attributes": dict(doorbell_state.attributes) if doorbell_state.attributes else {}
            }
            
            # Process the test event
            await self.handle_doorbell_event(test_event_data)
            
            return {
                "success": True,
                "message": "Test automation completed successfully",
                "event_data": test_event_data
            }
            
        except Exception as err:
            _LOGGER.error("Error testing automation: %s", err)
            return {
                "success": False,
                "message": "Test automation failed",
                "error": str(err)
            }

    def get_statistics(self) -> Dict[str, Any]:
        """Get automation engine statistics."""
        return {
            "events_processed": self._events_processed,
            "successful_events": self._successful_events,
            "failed_events": self._failed_events,
            "success_rate": (
                self._successful_events / self._events_processed * 100
                if self._events_processed > 0 else 0
            ),
            "last_event_time": self._last_event_time.isoformat() if self._last_event_time else None,
            "doorbell_detector_stats": self._doorbell_detector.get_statistics() if self._doorbell_detector else {},
            "camera_manager_stats": self._camera_manager.get_statistics() if self._camera_manager else {},
            "config": dict(self._config)
        }

    def get_detected_entities(self) -> Dict[str, Any]:
        """Get information about detected doorbell and camera entities."""
        if self._doorbell_detector:
            return self._doorbell_detector.get_detected_entities()
        return {"doorbells": {}, "cameras": {}, "pairs": [], "enabled": False}

    async def async_manual_pair_entities(self, doorbell_entity: str, camera_entity: str) -> bool:
        """Manually pair a doorbell with a camera entity."""
        if self._doorbell_detector:
            return await self._doorbell_detector.async_manual_pair(doorbell_entity, camera_entity)
        return False

    async def async_test_camera_snapshot(self, camera_entity: str) -> Dict[str, Any]:
        """Test camera snapshot functionality."""
        if self._camera_manager:
            return await self._camera_manager.async_test_camera_snapshot(camera_entity)
        return {"success": False, "message": "Camera manager not available"}

    def update_config(self, new_config: Dict[str, Any]) -> None:
        """Update automation engine configuration."""
        self._config.update(new_config.get("intelligent_automation", {}))
        
        # Update component configurations
        if self._doorbell_detector:
            # Update doorbell detector config
            pass
        
        if self._camera_manager:
            self._camera_manager.update_config(new_config)
        
        _LOGGER.info("Automation engine configuration updated")
