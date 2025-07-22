"""Camera snapshot management for WhoRang AI Doorbell integration."""
from __future__ import annotations

import asyncio
import logging
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.components.camera import async_get_image
from homeassistant.exceptions import HomeAssistantError

_LOGGER = logging.getLogger(__name__)

# Default snapshot configuration
DEFAULT_SNAPSHOT_CONFIG = {
    "quality": 90,
    "timeout": 10,
    "max_file_size": 5 * 1024 * 1024,  # 5MB
    "cleanup_after_hours": 24,
    "filename_template": "doorbell_snapshot_{timestamp}_{uuid}.jpg"
}


class CameraManager:
    """Manages camera snapshot capture and storage for doorbell events."""

    def __init__(self, hass: HomeAssistant, coordinator) -> None:
        """Initialize the camera manager."""
        self.hass = hass
        self.coordinator = coordinator
        self._config = DEFAULT_SNAPSHOT_CONFIG.copy()
        self._www_path = None
        self._snapshots_taken = 0
        self._last_snapshot_time = None
        self._failed_snapshots = 0
        
    async def async_setup(self, config: Dict[str, Any]) -> None:
        """Set up the camera manager with configuration."""
        # Update configuration
        self._config.update(config.get("camera_config", {}))
        
        # Set up www directory path
        self._www_path = Path(self.hass.config.path("www"))
        
        # Create snapshots subdirectory
        snapshots_dir = self._www_path / "whorang_snapshots"
        snapshots_dir.mkdir(exist_ok=True)
        
        _LOGGER.info("Camera manager setup complete. Snapshots will be saved to: %s", snapshots_dir)

    async def async_capture_snapshot(self, camera_entity: str, event_context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Capture a snapshot from the specified camera entity."""
        try:
            if not camera_entity:
                _LOGGER.warning("No camera entity provided for snapshot")
                return None
            
            # Validate camera entity exists
            camera_state = self.hass.states.get(camera_entity)
            if not camera_state:
                _LOGGER.error("Camera entity not found: %s", camera_entity)
                return None
            
            if camera_state.state == "unavailable":
                _LOGGER.warning("Camera entity unavailable: %s", camera_entity)
                return None
            
            _LOGGER.info("Capturing snapshot from camera: %s", camera_entity)
            
            # Add delay if configured (some cameras need time after doorbell trigger)
            snapshot_delay = event_context.get("snapshot_delay", self._config.get("snapshot_delay", 1))
            if snapshot_delay > 0:
                _LOGGER.debug("Waiting %s seconds before snapshot", snapshot_delay)
                await asyncio.sleep(snapshot_delay)
            
            # Capture image from camera
            image_data = await self._get_camera_image(camera_entity)
            if not image_data:
                _LOGGER.error("Failed to get image data from camera: %s", camera_entity)
                self._failed_snapshots += 1
                return None
            
            # Generate filename
            filename = self._generate_filename(camera_entity, event_context)
            
            # Save image to www directory
            file_path = await self._save_snapshot(image_data, filename)
            if not file_path:
                _LOGGER.error("Failed to save snapshot to file")
                self._failed_snapshots += 1
                return None
            
            # Generate accessible URL
            snapshot_url = self._generate_snapshot_url(filename)
            
            # Update statistics
            self._snapshots_taken += 1
            self._last_snapshot_time = datetime.now()
            
            snapshot_info = {
                "camera_entity": camera_entity,
                "filename": filename,
                "file_path": str(file_path),
                "url": snapshot_url,
                "timestamp": datetime.now().isoformat(),
                "file_size": len(image_data),
                "event_context": event_context
            }
            
            _LOGGER.info("Snapshot captured successfully: %s (%d bytes)", filename, len(image_data))
            
            # Schedule cleanup of old snapshots
            asyncio.create_task(self._cleanup_old_snapshots())
            
            return snapshot_info
            
        except Exception as err:
            _LOGGER.error("Error capturing snapshot from %s: %s", camera_entity, err, exc_info=True)
            self._failed_snapshots += 1
            return None

    async def _get_camera_image(self, camera_entity: str) -> Optional[bytes]:
        """Get image data from camera entity."""
        try:
            # Use Home Assistant's camera service to get image
            image_data = await async_get_image(
                self.hass,
                camera_entity,
                timeout=self._config["timeout"]
            )
            
            # Check file size
            if len(image_data) > self._config["max_file_size"]:
                _LOGGER.warning("Snapshot too large (%d bytes), truncating", len(image_data))
                # Could implement image compression here if needed
            
            return image_data
            
        except HomeAssistantError as err:
            _LOGGER.error("Home Assistant error getting camera image: %s", err)
            return None
        except asyncio.TimeoutError:
            _LOGGER.error("Timeout getting image from camera: %s", camera_entity)
            return None
        except Exception as err:
            _LOGGER.error("Unexpected error getting camera image: %s", err)
            return None

    def _generate_filename(self, camera_entity: str, event_context: Dict[str, Any]) -> str:
        """Generate a unique filename for the snapshot."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        
        # Extract camera name from entity ID
        camera_name = camera_entity.replace("camera.", "").replace("_", "-")
        
        # Use template or default format
        template = self._config.get("filename_template", DEFAULT_SNAPSHOT_CONFIG["filename_template"])
        
        filename = template.format(
            timestamp=timestamp,
            uuid=unique_id,
            camera_name=camera_name,
            camera_entity=camera_entity.replace(".", "_")
        )
        
        # Ensure .jpg extension
        if not filename.lower().endswith('.jpg'):
            filename += '.jpg'
        
        return filename

    async def _save_snapshot(self, image_data: bytes, filename: str) -> Optional[Path]:
        """Save snapshot image data to file."""
        try:
            snapshots_dir = self._www_path / "whorang_snapshots"
            file_path = snapshots_dir / filename
            
            # Write image data to file
            with open(file_path, 'wb') as f:
                f.write(image_data)
            
            _LOGGER.debug("Saved snapshot to: %s", file_path)
            return file_path
            
        except Exception as err:
            _LOGGER.error("Error saving snapshot file: %s", err)
            return None

    def _generate_snapshot_url(self, filename: str) -> str:
        """Generate accessible URL for the snapshot."""
        # Use Home Assistant's base URL if available
        base_url = self.hass.config.external_url or self.hass.config.internal_url
        
        if base_url:
            return f"{base_url}/local/whorang_snapshots/{filename}"
        else:
            # Fallback to relative URL
            return f"/local/whorang_snapshots/{filename}"

    async def _cleanup_old_snapshots(self) -> None:
        """Clean up old snapshot files."""
        try:
            snapshots_dir = self._www_path / "whorang_snapshots"
            if not snapshots_dir.exists():
                return
            
            cleanup_hours = self._config.get("cleanup_after_hours", 24)
            cutoff_time = datetime.now().timestamp() - (cleanup_hours * 3600)
            
            files_deleted = 0
            for file_path in snapshots_dir.glob("*.jpg"):
                try:
                    if file_path.stat().st_mtime < cutoff_time:
                        file_path.unlink()
                        files_deleted += 1
                except Exception as err:
                    _LOGGER.debug("Error deleting old snapshot %s: %s", file_path, err)
            
            if files_deleted > 0:
                _LOGGER.info("Cleaned up %d old snapshot files", files_deleted)
                
        except Exception as err:
            _LOGGER.error("Error during snapshot cleanup: %s", err)

    async def async_test_camera_snapshot(self, camera_entity: str) -> Dict[str, Any]:
        """Test camera snapshot functionality."""
        try:
            _LOGGER.info("Testing camera snapshot for: %s", camera_entity)
            
            # Create test event context
            test_context = {
                "test": True,
                "trigger_time": datetime.now().isoformat(),
                "snapshot_delay": 0  # No delay for tests
            }
            
            # Capture test snapshot
            snapshot_info = await self.async_capture_snapshot(camera_entity, test_context)
            
            if snapshot_info:
                return {
                    "success": True,
                    "message": f"Test snapshot captured successfully",
                    "snapshot_info": snapshot_info
                }
            else:
                return {
                    "success": False,
                    "message": "Failed to capture test snapshot",
                    "error": "Unknown error occurred"
                }
                
        except Exception as err:
            _LOGGER.error("Error testing camera snapshot: %s", err)
            return {
                "success": False,
                "message": "Test failed with exception",
                "error": str(err)
            }

    async def async_get_camera_info(self, camera_entity: str) -> Dict[str, Any]:
        """Get information about a camera entity."""
        try:
            camera_state = self.hass.states.get(camera_entity)
            if not camera_state:
                return {"available": False, "error": "Entity not found"}
            
            attributes = dict(camera_state.attributes)
            
            return {
                "available": camera_state.state != "unavailable",
                "state": camera_state.state,
                "friendly_name": attributes.get("friendly_name", camera_entity),
                "brand": attributes.get("brand"),
                "model": attributes.get("model"),
                "motion_detection": attributes.get("motion_detection"),
                "supported_features": attributes.get("supported_features", 0),
                "entity_id": camera_entity
            }
            
        except Exception as err:
            _LOGGER.error("Error getting camera info: %s", err)
            return {"available": False, "error": str(err)}

    def get_statistics(self) -> Dict[str, Any]:
        """Get camera manager statistics."""
        return {
            "snapshots_taken": self._snapshots_taken,
            "failed_snapshots": self._failed_snapshots,
            "last_snapshot_time": self._last_snapshot_time.isoformat() if self._last_snapshot_time else None,
            "success_rate": (
                self._snapshots_taken / (self._snapshots_taken + self._failed_snapshots) * 100
                if (self._snapshots_taken + self._failed_snapshots) > 0 else 0
            ),
            "config": dict(self._config)
        }

    async def async_list_available_cameras(self) -> List[Dict[str, Any]]:
        """List all available camera entities in Home Assistant."""
        try:
            cameras = []
            
            # Get all camera entities
            for entity_id in self.hass.states.async_entity_ids("camera"):
                camera_info = await self.async_get_camera_info(entity_id)
                if camera_info.get("available", False):
                    cameras.append(camera_info)
            
            return cameras
            
        except Exception as err:
            _LOGGER.error("Error listing cameras: %s", err)
            return []

    async def async_manual_snapshot(self, camera_entity: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Manually trigger a snapshot (for testing or manual use)."""
        try:
            event_context = context or {
                "manual": True,
                "trigger_time": datetime.now().isoformat()
            }
            
            snapshot_info = await self.async_capture_snapshot(camera_entity, event_context)
            
            if snapshot_info:
                return {
                    "success": True,
                    "message": "Manual snapshot captured",
                    "snapshot_info": snapshot_info
                }
            else:
                return {
                    "success": False,
                    "message": "Failed to capture manual snapshot"
                }
                
        except Exception as err:
            _LOGGER.error("Error capturing manual snapshot: %s", err)
            return {
                "success": False,
                "message": "Manual snapshot failed",
                "error": str(err)
            }

    def update_config(self, new_config: Dict[str, Any]) -> None:
        """Update camera manager configuration."""
        self._config.update(new_config)
        _LOGGER.info("Camera manager configuration updated")
