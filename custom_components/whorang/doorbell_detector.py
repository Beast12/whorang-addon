"""Automatic doorbell detection system for WhoRang AI Doorbell integration."""
from __future__ import annotations

import asyncio
import logging
import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set

from homeassistant.core import HomeAssistant, State, callback
from homeassistant.helpers.event import async_track_state_change_event
from homeassistant.helpers.entity_registry import async_get as async_get_entity_registry
from homeassistant.helpers.device_registry import async_get as async_get_device_registry
from homeassistant.const import STATE_ON, STATE_OFF

_LOGGER = logging.getLogger(__name__)

# Doorbell detection patterns with priority scoring
DOORBELL_PATTERNS = [
    # High priority - explicit doorbell entities
    {"pattern": r".*doorbell.*", "priority": 100, "trigger_states": [STATE_ON], "device_class": None},
    {"pattern": r".*door_bell.*", "priority": 100, "trigger_states": [STATE_ON], "device_class": None},
    {"pattern": r".*door\.bell.*", "priority": 100, "trigger_states": [STATE_ON], "device_class": None},
    
    # High priority - brand specific doorbell patterns
    {"pattern": r".*reolink.*doorbell.*", "priority": 95, "trigger_states": [STATE_ON], "device_class": None},
    {"pattern": r".*ring.*doorbell.*", "priority": 95, "trigger_states": [STATE_ON], "device_class": None},
    {"pattern": r".*nest.*doorbell.*", "priority": 95, "trigger_states": [STATE_ON], "device_class": None},
    {"pattern": r".*arlo.*doorbell.*", "priority": 95, "trigger_states": [STATE_ON], "device_class": None},
    
    # Medium priority - visitor/motion detection
    {"pattern": r".*visitor.*", "priority": 80, "trigger_states": [STATE_ON], "device_class": "motion"},
    {"pattern": r".*front.*door.*motion.*", "priority": 75, "trigger_states": [STATE_ON], "device_class": "motion"},
    {"pattern": r".*entrance.*motion.*", "priority": 75, "trigger_states": [STATE_ON], "device_class": "motion"},
    {"pattern": r".*porch.*motion.*", "priority": 70, "trigger_states": [STATE_ON], "device_class": "motion"},
    
    # Medium priority - button/press detection
    {"pattern": r".*doorbell.*button.*", "priority": 85, "trigger_states": [STATE_ON], "device_class": None},
    {"pattern": r".*door.*button.*", "priority": 80, "trigger_states": [STATE_ON], "device_class": None},
    {"pattern": r".*bell.*button.*", "priority": 80, "trigger_states": [STATE_ON], "device_class": None},
    
    # Lower priority - generic patterns
    {"pattern": r".*front.*door.*", "priority": 60, "trigger_states": [STATE_ON], "device_class": "motion"},
    {"pattern": r".*main.*entrance.*", "priority": 60, "trigger_states": [STATE_ON], "device_class": "motion"},
]

# Camera detection patterns for pairing with doorbells
CAMERA_PATTERNS = [
    # Direct doorbell camera matching
    {"pattern": r".*doorbell.*camera.*", "priority": 100},
    {"pattern": r".*doorbell.*", "priority": 95},
    
    # Brand specific camera patterns
    {"pattern": r".*reolink.*doorbell.*", "priority": 90},
    {"pattern": r".*ring.*doorbell.*", "priority": 90},
    {"pattern": r".*nest.*doorbell.*", "priority": 90},
    {"pattern": r".*arlo.*doorbell.*", "priority": 90},
    
    # Location-based camera matching
    {"pattern": r".*front.*door.*", "priority": 80},
    {"pattern": r".*entrance.*", "priority": 75},
    {"pattern": r".*porch.*", "priority": 70},
    {"pattern": r".*front.*", "priority": 65},
    
    # Generic camera patterns
    {"pattern": r".*camera.*", "priority": 50},
]


class DoorbellDetector:
    """Automatic doorbell detection and monitoring system."""

    def __init__(self, hass: HomeAssistant, coordinator) -> None:
        """Initialize the doorbell detector."""
        self.hass = hass
        self.coordinator = coordinator
        self._detected_doorbells: Dict[str, Dict[str, Any]] = {}
        self._detected_cameras: Dict[str, Dict[str, Any]] = {}
        self._doorbell_camera_pairs: List[Dict[str, str]] = []
        self._state_listeners: List[Any] = []
        self._last_triggers: Dict[str, datetime] = {}
        self._debounce_seconds = 2  # Prevent multiple triggers within 2 seconds
        self._enabled = True
        self._sensitivity = "medium"  # low, medium, high
        
    async def async_setup(self, config: Dict[str, Any]) -> None:
        """Set up the doorbell detector with configuration."""
        self._enabled = config.get("enable_auto_detection", True)
        self._sensitivity = config.get("detection_sensitivity", "medium")
        self._debounce_seconds = config.get("debounce_seconds", 2)
        
        if not self._enabled:
            _LOGGER.info("Doorbell auto-detection is disabled")
            return
            
        _LOGGER.info("Setting up doorbell detector with sensitivity: %s", self._sensitivity)
        
        # Discover doorbell and camera entities
        await self._discover_entities()
        
        # Set up state monitoring
        await self._setup_state_monitoring()
        
        _LOGGER.info("Doorbell detector setup complete. Found %d doorbells, %d cameras, %d pairs",
                    len(self._detected_doorbells), len(self._detected_cameras), len(self._doorbell_camera_pairs))

    async def async_shutdown(self) -> None:
        """Shutdown the doorbell detector."""
        # Remove state listeners
        for remove_listener in self._state_listeners:
            remove_listener()
        self._state_listeners.clear()
        
        _LOGGER.info("Doorbell detector shutdown complete")

    async def _discover_entities(self) -> None:
        """Discover doorbell and camera entities in Home Assistant."""
        entity_registry = async_get_entity_registry(self.hass)
        device_registry = async_get_device_registry(self.hass)
        
        # Get all entities
        all_entities = entity_registry.entities
        
        # Discover doorbell entities
        for entity_id, entity_entry in all_entities.items():
            if entity_entry.disabled:
                continue
                
            # Check if entity is a binary sensor (most doorbells are binary sensors)
            if entity_id.startswith("binary_sensor."):
                doorbell_match = self._match_doorbell_pattern(entity_id, entity_entry)
                if doorbell_match:
                    self._detected_doorbells[entity_id] = doorbell_match
                    _LOGGER.info("Discovered doorbell entity: %s (priority: %d)", 
                               entity_id, doorbell_match["priority"])
            
            # Check if entity is a camera
            elif entity_id.startswith("camera."):
                camera_match = self._match_camera_pattern(entity_id, entity_entry)
                if camera_match:
                    self._detected_cameras[entity_id] = camera_match
                    _LOGGER.info("Discovered camera entity: %s (priority: %d)", 
                               entity_id, camera_match["priority"])
        
        # Create doorbell-camera pairs
        self._create_doorbell_camera_pairs()

    def _match_doorbell_pattern(self, entity_id: str, entity_entry) -> Optional[Dict[str, Any]]:
        """Check if entity matches doorbell patterns."""
        # Get entity state to check device class
        state = self.hass.states.get(entity_id)
        device_class = None
        if state and state.attributes:
            device_class = state.attributes.get("device_class")
        
        # Apply sensitivity filtering
        min_priority = self._get_min_priority_for_sensitivity()
        
        for pattern_config in DOORBELL_PATTERNS:
            pattern = pattern_config["pattern"]
            required_device_class = pattern_config.get("device_class")
            priority = pattern_config["priority"]
            
            # Skip if priority is too low for current sensitivity
            if priority < min_priority:
                continue
            
            # Check if entity name matches pattern
            if re.search(pattern, entity_id.lower()):
                # Check device class requirement if specified
                if required_device_class and device_class != required_device_class:
                    continue
                    
                return {
                    "entity_id": entity_id,
                    "pattern": pattern,
                    "priority": priority,
                    "trigger_states": pattern_config["trigger_states"],
                    "device_class": device_class,
                    "friendly_name": entity_entry.name or entity_id,
                }
        
        return None

    def _match_camera_pattern(self, entity_id: str, entity_entry) -> Optional[Dict[str, Any]]:
        """Check if entity matches camera patterns."""
        min_priority = self._get_min_priority_for_sensitivity()
        
        for pattern_config in CAMERA_PATTERNS:
            pattern = pattern_config["pattern"]
            priority = pattern_config["priority"]
            
            # Skip if priority is too low for current sensitivity
            if priority < min_priority:
                continue
            
            # Check if entity name matches pattern
            if re.search(pattern, entity_id.lower()):
                return {
                    "entity_id": entity_id,
                    "pattern": pattern,
                    "priority": priority,
                    "friendly_name": entity_entry.name or entity_id,
                }
        
        return None

    def _get_min_priority_for_sensitivity(self) -> int:
        """Get minimum priority threshold based on sensitivity setting."""
        sensitivity_thresholds = {
            "high": 50,    # Include more entities (lower threshold)
            "medium": 70,  # Balanced approach
            "low": 85,     # Only high-confidence matches
        }
        return sensitivity_thresholds.get(self._sensitivity, 70)

    def _create_doorbell_camera_pairs(self) -> None:
        """Create pairs between doorbell and camera entities."""
        self._doorbell_camera_pairs.clear()
        
        for doorbell_id, doorbell_info in self._detected_doorbells.items():
            best_camera = None
            best_score = 0
            
            for camera_id, camera_info in self._detected_cameras.items():
                # Calculate pairing score based on name similarity
                score = self._calculate_pairing_score(doorbell_id, camera_id)
                
                if score > best_score:
                    best_score = score
                    best_camera = camera_id
            
            if best_camera and best_score > 30:  # Minimum confidence threshold
                pair = {
                    "doorbell_entity": doorbell_id,
                    "camera_entity": best_camera,
                    "confidence_score": best_score,
                    "doorbell_info": doorbell_info,
                    "camera_info": self._detected_cameras[best_camera]
                }
                self._doorbell_camera_pairs.append(pair)
                
                _LOGGER.info("Created doorbell-camera pair: %s -> %s (score: %d)",
                           doorbell_id, best_camera, best_score)

    def _calculate_pairing_score(self, doorbell_id: str, camera_id: str) -> int:
        """Calculate confidence score for doorbell-camera pairing."""
        score = 0
        
        # Extract base names (remove domain prefixes)
        doorbell_name = doorbell_id.replace("binary_sensor.", "").lower()
        camera_name = camera_id.replace("camera.", "").lower()
        
        # Exact match bonus
        if doorbell_name == camera_name:
            score += 100
        
        # Substring matching
        doorbell_words = set(re.findall(r'\w+', doorbell_name))
        camera_words = set(re.findall(r'\w+', camera_name))
        
        # Common words bonus
        common_words = doorbell_words.intersection(camera_words)
        score += len(common_words) * 20
        
        # Brand matching bonus
        brands = ["reolink", "ring", "nest", "arlo", "hikvision", "dahua"]
        for brand in brands:
            if brand in doorbell_name and brand in camera_name:
                score += 30
        
        # Location matching bonus
        locations = ["front", "door", "entrance", "porch", "main", "doorbell"]
        for location in locations:
            if location in doorbell_name and location in camera_name:
                score += 15
        
        return score

    async def _setup_state_monitoring(self) -> None:
        """Set up state change monitoring for detected doorbell entities."""
        if not self._detected_doorbells:
            _LOGGER.warning("No doorbell entities found for monitoring")
            return
        
        # Monitor all detected doorbell entities
        doorbell_entities = list(self._detected_doorbells.keys())
        
        @callback
        def doorbell_state_changed(event):
            """Handle doorbell state change."""
            asyncio.create_task(self._handle_doorbell_trigger(event))
        
        # Set up state change tracking
        remove_listener = async_track_state_change_event(
            self.hass, doorbell_entities, doorbell_state_changed
        )
        self._state_listeners.append(remove_listener)
        
        _LOGGER.info("Set up state monitoring for %d doorbell entities", len(doorbell_entities))

    async def _handle_doorbell_trigger(self, event) -> None:
        """Handle doorbell trigger event."""
        try:
            entity_id = event.data.get("entity_id")
            new_state = event.data.get("new_state")
            old_state = event.data.get("old_state")
            
            if not entity_id or not new_state:
                return
            
            # Get doorbell configuration
            doorbell_info = self._detected_doorbells.get(entity_id)
            if not doorbell_info:
                return
            
            # Check if this is a valid trigger state
            trigger_states = doorbell_info.get("trigger_states", [STATE_ON])
            if new_state.state not in trigger_states:
                return
            
            # Check if this is a state change (not just attribute update)
            if old_state and old_state.state == new_state.state:
                return
            
            # Debounce: prevent multiple triggers within debounce period
            now = datetime.now()
            last_trigger = self._last_triggers.get(entity_id)
            if last_trigger and (now - last_trigger).total_seconds() < self._debounce_seconds:
                _LOGGER.debug("Debouncing doorbell trigger for %s", entity_id)
                return
            
            self._last_triggers[entity_id] = now
            
            _LOGGER.info("Doorbell trigger detected: %s -> %s", entity_id, new_state.state)
            
            # Find associated camera for this doorbell
            camera_entity = self._find_camera_for_doorbell(entity_id)
            
            # Trigger the automation engine
            await self._trigger_doorbell_automation(entity_id, camera_entity, new_state)
            
        except Exception as err:
            _LOGGER.error("Error handling doorbell trigger: %s", err, exc_info=True)

    def _find_camera_for_doorbell(self, doorbell_entity: str) -> Optional[str]:
        """Find the best camera entity for a doorbell entity."""
        for pair in self._doorbell_camera_pairs:
            if pair["doorbell_entity"] == doorbell_entity:
                return pair["camera_entity"]
        return None

    async def _trigger_doorbell_automation(self, doorbell_entity: str, camera_entity: Optional[str], state: State) -> None:
        """Trigger the doorbell automation workflow."""
        try:
            # Import automation engine
            from .automation_engine import AutomationEngine
            
            # Get automation engine from coordinator
            automation_engine = getattr(self.coordinator, '_automation_engine', None)
            if not automation_engine:
                _LOGGER.error("Automation engine not available")
                return
            
            # Prepare event data
            event_data = {
                "doorbell_entity": doorbell_entity,
                "camera_entity": camera_entity,
                "trigger_state": state.state,
                "trigger_time": datetime.now().isoformat(),
                "doorbell_info": self._detected_doorbells.get(doorbell_entity, {}),
                "attributes": dict(state.attributes) if state.attributes else {}
            }
            
            # Trigger automation
            await automation_engine.handle_doorbell_event(event_data)
            
        except Exception as err:
            _LOGGER.error("Error triggering doorbell automation: %s", err, exc_info=True)

    @callback
    def get_detected_entities(self) -> Dict[str, Any]:
        """Get information about detected entities."""
        return {
            "doorbells": dict(self._detected_doorbells),
            "cameras": dict(self._detected_cameras),
            "pairs": list(self._doorbell_camera_pairs),
            "enabled": self._enabled,
            "sensitivity": self._sensitivity
        }

    @callback
    def get_statistics(self) -> Dict[str, Any]:
        """Get detector statistics."""
        return {
            "doorbells_detected": len(self._detected_doorbells),
            "cameras_detected": len(self._detected_cameras),
            "pairs_created": len(self._doorbell_camera_pairs),
            "triggers_today": len([t for t in self._last_triggers.values() 
                                 if (datetime.now() - t).days == 0]),
            "last_trigger": max(self._last_triggers.values()) if self._last_triggers else None,
            "sensitivity": self._sensitivity,
            "enabled": self._enabled
        }

    async def async_manual_pair(self, doorbell_entity: str, camera_entity: str) -> bool:
        """Manually create a doorbell-camera pair."""
        try:
            # Validate entities exist
            if not self.hass.states.get(doorbell_entity):
                _LOGGER.error("Doorbell entity not found: %s", doorbell_entity)
                return False
                
            if not self.hass.states.get(camera_entity):
                _LOGGER.error("Camera entity not found: %s", camera_entity)
                return False
            
            # Remove existing pairs for this doorbell
            self._doorbell_camera_pairs = [
                pair for pair in self._doorbell_camera_pairs 
                if pair["doorbell_entity"] != doorbell_entity
            ]
            
            # Create new pair
            pair = {
                "doorbell_entity": doorbell_entity,
                "camera_entity": camera_entity,
                "confidence_score": 100,  # Manual pairs get max confidence
                "manual": True,
                "doorbell_info": self._detected_doorbells.get(doorbell_entity, {}),
                "camera_info": self._detected_cameras.get(camera_entity, {})
            }
            
            self._doorbell_camera_pairs.append(pair)
            
            _LOGGER.info("Created manual doorbell-camera pair: %s -> %s", 
                        doorbell_entity, camera_entity)
            return True
            
        except Exception as err:
            _LOGGER.error("Error creating manual pair: %s", err)
            return False

    async def async_test_doorbell(self, doorbell_entity: str) -> bool:
        """Test doorbell detection by simulating a trigger."""
        try:
            if doorbell_entity not in self._detected_doorbells:
                _LOGGER.error("Doorbell entity not in detected list: %s", doorbell_entity)
                return False
            
            # Get current state
            state = self.hass.states.get(doorbell_entity)
            if not state:
                _LOGGER.error("Cannot get state for doorbell entity: %s", doorbell_entity)
                return False
            
            # Find camera
            camera_entity = self._find_camera_for_doorbell(doorbell_entity)
            
            # Trigger automation
            await self._trigger_doorbell_automation(doorbell_entity, camera_entity, state)
            
            _LOGGER.info("Test trigger completed for doorbell: %s", doorbell_entity)
            return True
            
        except Exception as err:
            _LOGGER.error("Error testing doorbell: %s", err)
            return False
