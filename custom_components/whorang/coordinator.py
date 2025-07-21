"""Data update coordinator for WhoRang AI Doorbell integration."""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import websockets
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .api_client import WhoRangAPIClient, WhoRangConnectionError
from .const import (
    DOMAIN,
    DEFAULT_UPDATE_INTERVAL,
    DEFAULT_WEBSOCKET_TIMEOUT,
    WEBSOCKET_PATH,
    WS_TYPE_NEW_VISITOR,
    WS_TYPE_CONNECTION_STATUS,
    WS_TYPE_AI_ANALYSIS_COMPLETE,
    WS_TYPE_FACE_DETECTION_COMPLETE,
    WS_TYPE_SYSTEM_STATUS,
    EVENT_VISITOR_DETECTED,
    EVENT_KNOWN_VISITOR_DETECTED,
    EVENT_AI_ANALYSIS_COMPLETE,
    EVENT_FACE_DETECTION_COMPLETE,
)

_LOGGER = logging.getLogger(__name__)


class WhoRangDataUpdateCoordinator(DataUpdateCoordinator):
    """Class to manage fetching data from the WhoRang API and WebSocket."""

    def __init__(
        self,
        hass: HomeAssistant,
        api_client: WhoRangAPIClient,
        update_interval: int = DEFAULT_UPDATE_INTERVAL,
        enable_websocket: bool = True,
    ) -> None:
        """Initialize the coordinator."""
        self.api_client = api_client
        self.enable_websocket = enable_websocket
        self._websocket = None
        self._websocket_task = None
        self._reconnect_task = None
        self._last_visitor_id = None
        self._known_persons = {}
        
        # Initialize with default data structure to prevent None errors
        self.data = {
            "latest_visitor": {},
            "latest_image": {},
            "doorbell_state": {},
            "visitor_stats": {},
            "system_info": {},
            "last_service_call": {}
        }
        
        # Build WebSocket URL with proper protocol
        self.websocket_url = self._build_websocket_url()
        
        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=timedelta(seconds=update_interval),
        )

    def _build_websocket_url(self) -> str:
        """Build WebSocket URL from API client configuration."""
        # Use ws:// for HTTP and wss:// for HTTPS
        scheme = "wss" if self.api_client.use_ssl else "ws"
        host = self.api_client.host
        port = self.api_client.port
        
        # Handle standard ports
        if (self.api_client.use_ssl and port == 443) or (not self.api_client.use_ssl and port == 80):
            return f"{scheme}://{host}{WEBSOCKET_PATH}"
        else:
            return f"{scheme}://{host}:{port}{WEBSOCKET_PATH}"

    async def _async_update_data(self) -> Dict[str, Any]:
        """Fetch data from API."""
        try:
            _LOGGER.debug("Updating coordinator data")
            
            # Get system information
            system_info = await self.api_client.get_system_info()
            
            # Get latest visitor
            latest_visitor = await self.api_client.get_latest_visitor()
            
            # Get known persons for face recognition
            known_persons = await self.api_client.get_known_persons()
            self._known_persons = {person["id"]: person for person in known_persons}
            
            # Get face gallery data for visual face management
            face_gallery_data = await self.api_client.get_face_gallery_data()
            
            # Get AI usage stats if cost tracking is enabled
            ai_usage = await self.api_client.get_ai_usage_stats(days=1)
            
            # Get current AI provider and model information
            face_config = system_info.get("face_config", {})
            current_ai_provider = face_config.get("ai_provider", "local")
            current_ai_model = await self.api_client.get_current_ai_model()
            
            # Get available models for all providers
            available_models = await self.api_client.get_available_models()
            
            # Special handling for local/Ollama provider - get dynamic models
            ollama_models = []
            ollama_status = {}
            if current_ai_provider == "local":
                try:
                    # Use the new backend endpoint for dynamic model discovery
                    local_models_response = await self.api_client.get_provider_models("local")
                    if local_models_response:
                        # Transform backend response to match expected format
                        ollama_models = []
                        for model in local_models_response:
                            if isinstance(model, dict):
                                ollama_models.append({
                                    "name": model.get("value", ""),
                                    "display_name": model.get("label", ""),
                                    "size": model.get("size", 0),
                                    "is_vision": model.get("is_vision", True),
                                    "recommended": model.get("recommended", False)
                                })
                            elif isinstance(model, str):
                                ollama_models.append({
                                    "name": model,
                                    "display_name": model,
                                    "size": 0,
                                    "is_vision": True,
                                    "recommended": False
                                })
                        
                        # Update available_models with dynamic Ollama models
                        available_models["local"] = [model["name"] for model in ollama_models]
                        _LOGGER.debug("Updated local models with %d Ollama models from backend", len(ollama_models))
                    else:
                        # Fallback to direct Ollama API if backend fails
                        _LOGGER.debug("Backend model discovery failed, trying direct Ollama API")
                        ollama_models = await self.api_client.get_ollama_models()
                        if ollama_models:
                            available_models["local"] = [model["name"] for model in ollama_models]
                            _LOGGER.debug("Updated local models with %d Ollama models from direct API", len(ollama_models))
                except Exception as e:
                    _LOGGER.error("Failed to get Ollama models: %s", e)
                    # Fallback to direct Ollama API
                    try:
                        ollama_models = await self.api_client.get_ollama_models()
                        if ollama_models:
                            available_models["local"] = [model["name"] for model in ollama_models]
                            _LOGGER.debug("Updated local models with %d Ollama models from fallback", len(ollama_models))
                    except Exception as fallback_error:
                        _LOGGER.error("Fallback Ollama model discovery also failed: %s", fallback_error)
                
                # Get Ollama status
                try:
                    ollama_status = await self.api_client.get_ollama_status()
                except Exception as e:
                    _LOGGER.error("Failed to get Ollama status: %s", e)
                    ollama_status = {"status": "unknown", "error": str(e)}
            
            # Detect if there's a new visitor
            if latest_visitor and latest_visitor.get("visitor_id") != self._last_visitor_id:
                self._last_visitor_id = latest_visitor.get("visitor_id")
                await self._handle_new_visitor(latest_visitor)
            
            # Update existing data structure instead of replacing
            updated_data = {
                "system_info": system_info,
                "latest_visitor": latest_visitor or {},
                "known_persons": known_persons,
                "face_gallery_data": face_gallery_data,
                "ai_usage": ai_usage,
                "current_ai_provider": current_ai_provider,
                "current_ai_model": current_ai_model,
                "available_models": available_models,
                "ollama_models": ollama_models,
                "ollama_status": ollama_status,
                "last_update": datetime.now().isoformat(),
                "websocket_connected": self._websocket is not None and not self._websocket.closed,
            }
            
            # Preserve service call data if it exists
            if hasattr(self, 'data') and self.data:
                for key in ["latest_image", "doorbell_state", "visitor_stats", "last_service_call"]:
                    if key in self.data:
                        updated_data[key] = self.data[key]
            
            _LOGGER.debug("Coordinator data updated successfully")
            return updated_data
            
        except Exception as err:
            _LOGGER.error("Error updating coordinator data: %s", err)
            # Return existing data instead of raising exception to prevent entity errors
            if hasattr(self, 'data') and self.data:
                return self.data
            else:
                # Return minimal safe structure
                return {
                    "latest_visitor": {},
                    "latest_image": {},
                    "doorbell_state": {},
                    "visitor_stats": {},
                    "system_info": {},
                    "last_service_call": {}
                }

    async def async_setup(self) -> None:
        """Set up the coordinator."""
        # Start WebSocket connection if enabled
        if self.enable_websocket:
            await self._start_websocket()

    async def async_shutdown(self) -> None:
        """Shutdown the coordinator."""
        await self._stop_websocket()
        await self.api_client.close()

    async def _start_websocket(self) -> None:
        """Start WebSocket connection."""
        if self._websocket_task is not None:
            return
            
        _LOGGER.debug("Starting WebSocket connection to %s", self.websocket_url)
        self._websocket_task = asyncio.create_task(self._websocket_handler())

    async def _stop_websocket(self) -> None:
        """Stop WebSocket connection."""
        if self._websocket_task:
            self._websocket_task.cancel()
            try:
                await self._websocket_task
            except asyncio.CancelledError:
                pass
            self._websocket_task = None
            
        if self._reconnect_task:
            self._reconnect_task.cancel()
            try:
                await self._reconnect_task
            except asyncio.CancelledError:
                pass
            self._reconnect_task = None
            
        if self._websocket:
            await self._websocket.close()
            self._websocket = None

    async def _websocket_handler(self) -> None:
        """Handle WebSocket connection with auto-reconnect."""
        reconnect_delay = 1
        max_reconnect_delay = 60
        
        while True:
            try:
                _LOGGER.debug("Connecting to WebSocket at %s", self.websocket_url)
                
                # Prepare connection parameters
                connect_kwargs = {
                    "timeout": DEFAULT_WEBSOCKET_TIMEOUT,
                    "ping_interval": 20,
                    "ping_timeout": 10,
                }
                
                # Add SSL context if using HTTPS
                if self.api_client.use_ssl and self.api_client._ssl_context:
                    connect_kwargs["ssl"] = self.api_client._ssl_context
                
                # Add headers if API key is present
                if self.api_client.api_key:
                    connect_kwargs["extra_headers"] = {
                        "Authorization": f"Bearer {self.api_client.api_key}"
                    }
                
                async with websockets.connect(
                    self.websocket_url,
                    **connect_kwargs
                ) as websocket:
                    self._websocket = websocket
                    reconnect_delay = 1  # Reset delay on successful connection
                    
                    _LOGGER.info("WebSocket connected to WhoRang")
                    
                    # Listen for messages
                    async for message in websocket:
                        try:
                            await self._handle_websocket_message(message)
                        except Exception as err:
                            _LOGGER.error("Error handling WebSocket message: %s", err)
                            
            except websockets.exceptions.InvalidStatusCode as err:
                if err.status_code == 400:
                    _LOGGER.error("WebSocket connection rejected (400). Check if WebSocket endpoint exists at %s", self.websocket_url)
                elif err.status_code == 401:
                    _LOGGER.error("WebSocket authentication failed (401). Check API key.")
                else:
                    _LOGGER.error("WebSocket connection failed with status %s: %s", err.status_code, err)
                self._websocket = None
                await asyncio.sleep(reconnect_delay)
                reconnect_delay = min(reconnect_delay * 2, max_reconnect_delay)
                
            except (websockets.exceptions.ConnectionClosed, OSError) as err:
                _LOGGER.warning("WebSocket connection lost: %s", err)
                self._websocket = None
                
                # Exponential backoff for reconnection
                _LOGGER.debug("Reconnecting in %s seconds", reconnect_delay)
                await asyncio.sleep(reconnect_delay)
                reconnect_delay = min(reconnect_delay * 2, max_reconnect_delay)
                
            except Exception as err:
                _LOGGER.error("Unexpected WebSocket error: %s", err)
                self._websocket = None
                await asyncio.sleep(reconnect_delay)
                reconnect_delay = min(reconnect_delay * 2, max_reconnect_delay)

    async def _handle_websocket_message(self, message) -> None:
        """Handle incoming WebSocket message with support for both string and JSON formats.
        
        WebSocket Message Formats Supported:
        
        1. Simple String Messages:
           - "new_visitor" - Indicates new visitor detected
           - "system_update" - Indicates system status change
           - "doorbell_ring" - Indicates doorbell was pressed
        
        2. JSON Dictionary Messages:
           {
             "type": "new_visitor",
             "data": {
               "visitor_id": "abc123",
               "ai_message": "Person detected",
               "timestamp": "2025-01-08T13:21:11.307Z"
             }
           }
        """
        try:
            _LOGGER.debug("Received WebSocket message: %s (type: %s)", message, type(message))
            
            # Handle simple string messages first
            if isinstance(message, str) and not message.strip().startswith('{'):
                await self._handle_string_message(message.strip())
                return
            
            # Handle JSON string messages
            if isinstance(message, str):
                try:
                    data = json.loads(message)
                    await self._handle_json_message(data)
                    return
                except json.JSONDecodeError as err:
                    _LOGGER.warning("Failed to parse WebSocket message as JSON: %s", err)
                    # Fallback: treat as simple string message
                    await self._handle_string_message(message.strip())
                    return
            
            # Handle already parsed dictionary messages
            elif isinstance(message, dict):
                await self._handle_json_message(message)
                return
            
            else:
                _LOGGER.warning("Unexpected WebSocket message format: %s (type: %s)", 
                              message, type(message))
                
        except Exception as err:
            _LOGGER.error("Error processing WebSocket message: %s", err, exc_info=True)

    async def _handle_string_message(self, message: str) -> None:
        """Handle simple string WebSocket messages."""
        try:
            _LOGGER.info("Processing string WebSocket message: %s", message)
            
            if message == "new_visitor":
                _LOGGER.info("New visitor detected via WebSocket string message")
                await self.async_request_refresh()
                
            elif message == "system_update":
                _LOGGER.info("System update detected via WebSocket string message")
                await self.async_request_refresh()
                
            elif message == "doorbell_ring":
                _LOGGER.info("Doorbell ring detected via WebSocket string message")
                await self.async_request_refresh()
                
            elif message == "face_processing_complete":
                _LOGGER.info("Face processing complete via WebSocket string message")
                await self.async_request_refresh()
                
            elif message == "ai_analysis_complete":
                _LOGGER.info("AI analysis complete via WebSocket string message")
                await self.async_request_refresh()
                
            else:
                _LOGGER.debug("Unknown WebSocket string message: %s", message)
                # Still trigger refresh for any unknown messages
                await self.async_request_refresh()
                
        except Exception as err:
            _LOGGER.error("Error handling string WebSocket message: %s", err)

    async def _handle_json_message(self, data: dict) -> None:
        """Handle JSON dictionary WebSocket messages."""
        try:
            message_type = data.get("type", "unknown")
            message_data = data.get("data", {})
            
            _LOGGER.info("Processing JSON WebSocket message type: %s", message_type)
            
            if message_type == WS_TYPE_NEW_VISITOR or message_type == "new_visitor":
                await self._handle_new_visitor(message_data)
                
            elif message_type == WS_TYPE_AI_ANALYSIS_COMPLETE or message_type == "ai_analysis_complete":
                await self._handle_ai_analysis_complete(message_data)
                
            elif message_type == WS_TYPE_FACE_DETECTION_COMPLETE or message_type == "face_detection_complete":
                await self._handle_face_detection_complete(message_data)
                
            elif message_type == WS_TYPE_SYSTEM_STATUS or message_type == "system_status":
                await self._handle_system_status(message_data)
                
            elif message_type == WS_TYPE_CONNECTION_STATUS or message_type == "connection_status":
                _LOGGER.debug("WebSocket connection status: %s", message_data)
                
            elif message_type == "face_recognized":
                await self._handle_face_recognized(message_data)
                
            elif message_type == "unknown_face_detected":
                await self._handle_unknown_face_detected(message_data)
                
            elif message_type == "face_processing_complete":
                await self._handle_face_processing_complete(message_data)
                
            elif message_type == "face_processing_error":
                await self._handle_face_processing_error(message_data)
                
            elif message_type == "database_cleared":
                await self._handle_database_cleared(message_data)
                
            elif message_type == "analysis_started":
                await self._handle_analysis_started(message_data)
                
            elif message_type == "analysis_complete":
                await self._handle_analysis_complete_auto(message_data)
                
            elif message_type == "analysis_error":
                await self._handle_analysis_error(message_data)
                
            else:
                _LOGGER.debug("Unknown WebSocket message type: %s", message_type)
                
            # Trigger coordinator update to refresh entities
            await self.async_request_refresh()
            
        except Exception as err:
            _LOGGER.error("Error handling JSON WebSocket message: %s", err)

    async def _handle_new_visitor(self, visitor_data: Dict[str, Any]) -> None:
        """Handle new visitor event."""
        _LOGGER.info("New visitor detected: %s", visitor_data.get("ai_message", "Unknown"))
        
        # Update last visitor ID
        self._last_visitor_id = visitor_data.get("visitor_id")
        
        # Check if this is a known visitor
        is_known_visitor = self._is_known_visitor(visitor_data)
        
        # Fire Home Assistant events
        event_type = EVENT_KNOWN_VISITOR_DETECTED if is_known_visitor else EVENT_VISITOR_DETECTED
        
        self.hass.bus.async_fire(
            event_type,
            {
                "visitor_id": visitor_data.get("visitor_id"),
                "timestamp": visitor_data.get("timestamp"),
                "ai_message": visitor_data.get("ai_message"),
                "ai_title": visitor_data.get("ai_title"),
                "location": visitor_data.get("location"),
                "image_url": visitor_data.get("image_url"),
                "is_known_visitor": is_known_visitor,
                "confidence_score": visitor_data.get("confidence_score"),
                "faces_detected": visitor_data.get("faces_detected", 0),
            }
        )

    async def _handle_ai_analysis_complete(self, analysis_data: Dict[str, Any]) -> None:
        """Handle AI analysis complete event."""
        _LOGGER.debug("AI analysis complete: %s", analysis_data.get("visitor_id"))
        
        # Update coordinator data with processing time information
        if hasattr(self, 'data') and self.data:
            # Update latest visitor with processing time
            if "latest_visitor" in self.data:
                self.data["latest_visitor"].update({
                    "processing_time": analysis_data.get("processing_time") or analysis_data.get("processing_time_ms"),
                    "analysis_provider": analysis_data.get("ai_provider"),
                    "analysis_timestamp": analysis_data.get("timestamp")
                })
            
            # Update analysis status
            self.data["analysis_status"] = {
                "visitor_id": analysis_data.get("visitor_id"),
                "status": "completed",
                "timestamp": analysis_data.get("timestamp"),
                "processing_time_ms": analysis_data.get("processing_time") or analysis_data.get("processing_time_ms"),
                "provider": analysis_data.get("ai_provider"),
                "confidence": analysis_data.get("confidence_score"),
                "objects_detected": analysis_data.get("objects_detected"),
                "cost_usd": analysis_data.get("cost_usd")
            }
            
            self.async_set_updated_data(self.data)
        
        self.hass.bus.async_fire(
            EVENT_AI_ANALYSIS_COMPLETE,
            {
                "visitor_id": analysis_data.get("visitor_id"),
                "ai_provider": analysis_data.get("ai_provider"),
                "processing_time": analysis_data.get("processing_time") or analysis_data.get("processing_time_ms"),
                "confidence_score": analysis_data.get("confidence_score"),
                "objects_detected": analysis_data.get("objects_detected"),
                "cost_usd": analysis_data.get("cost_usd"),
            }
        )

    async def _handle_face_detection_complete(self, face_data: Dict[str, Any]) -> None:
        """Handle face detection complete event."""
        _LOGGER.debug("Face detection complete: %s", face_data.get("visitor_id"))
        
        self.hass.bus.async_fire(
            EVENT_FACE_DETECTION_COMPLETE,
            {
                "visitor_id": face_data.get("visitor_id"),
                "faces_detected": face_data.get("faces_detected", 0),
                "known_faces": face_data.get("known_faces", []),
                "processing_time": face_data.get("processing_time"),
            }
        )

    async def _handle_system_status(self, status_data: Dict[str, Any]) -> None:
        """Handle system status update."""
        _LOGGER.debug("System status update: %s", status_data.get("status"))

    async def _handle_face_recognized(self, face_data: Dict[str, Any]) -> None:
        """Handle face recognized event."""
        _LOGGER.info("Face recognized: %s", face_data.get("person_name", "Unknown"))
        
        # Fire Home Assistant event for face recognition
        self.hass.bus.async_fire(
            "whorang_face_recognized",
            {
                "person_name": face_data.get("person_name"),
                "person_id": face_data.get("person_id"),
                "confidence": face_data.get("confidence"),
                "visitor_id": face_data.get("visitor_id"),
                "timestamp": face_data.get("timestamp"),
            }
        )

    async def _handle_unknown_face_detected(self, face_data: Dict[str, Any]) -> None:
        """Handle unknown face detected event."""
        _LOGGER.info("Unknown face detected for visitor: %s", face_data.get("visitor_id"))
        
        # Fire Home Assistant event for unknown face
        self.hass.bus.async_fire(
            "whorang_unknown_face_detected",
            {
                "visitor_id": face_data.get("visitor_id"),
                "face_count": face_data.get("face_count", 1),
                "timestamp": face_data.get("timestamp"),
                "image_url": face_data.get("image_url"),
            }
        )

    async def _handle_face_processing_complete(self, processing_data: Dict[str, Any]) -> None:
        """Handle face processing complete event."""
        _LOGGER.debug("Face processing complete for visitor: %s", processing_data.get("visitor_id"))
        
        # Fire Home Assistant event for processing completion
        self.hass.bus.async_fire(
            "whorang_face_processing_complete",
            {
                "visitor_id": processing_data.get("visitor_id"),
                "faces_detected": processing_data.get("faces_detected", 0),
                "known_faces": processing_data.get("known_faces", 0),
                "unknown_faces": processing_data.get("unknown_faces", 0),
                "processing_time": processing_data.get("processing_time"),
                "timestamp": processing_data.get("timestamp"),
            }
        )

    async def _handle_face_processing_error(self, error_data: Dict[str, Any]) -> None:
        """Handle face processing error event."""
        _LOGGER.warning("Face processing error for visitor %s: %s", 
                       error_data.get("visitor_id"), error_data.get("error"))
        
        # Fire Home Assistant event for processing error
        self.hass.bus.async_fire(
            "whorang_face_processing_error",
            {
                "visitor_id": error_data.get("visitor_id"),
                "error": error_data.get("error"),
                "timestamp": error_data.get("timestamp"),
            }
        )

    async def _handle_database_cleared(self, clear_data: Dict[str, Any]) -> None:
        """Handle database cleared event."""
        _LOGGER.info("Database cleared: %s", clear_data.get("message", "Database reset"))
        
        # Fire Home Assistant event for database clear
        self.hass.bus.async_fire(
            "whorang_database_cleared",
            {
                "message": clear_data.get("message"),
                "timestamp": clear_data.get("timestamp"),
                "records_deleted": clear_data.get("records_deleted", 0),
            }
        )
        
        # Reset local visitor statistics
        if hasattr(self, 'data') and self.data:
            self.data["visitor_stats"] = {}
            self.async_set_updated_data(self.data)

    async def _handle_analysis_started(self, analysis_data: Dict[str, Any]) -> None:
        """Handle automatic AI analysis started event."""
        _LOGGER.info("AI analysis started for visitor: %s", analysis_data.get('visitor_id'))
        
        # Update coordinator data to show analysis in progress
        if hasattr(self, 'data') and self.data:
            self.data["ai_processing"] = True
            self.data["analysis_status"] = {
                "visitor_id": analysis_data.get('visitor_id'),
                "status": "started",
                "timestamp": analysis_data.get('timestamp'),
                "image_url": analysis_data.get('image_url')
            }
            self.async_set_updated_data(self.data)
        
        # Fire Home Assistant event
        self.hass.bus.async_fire(
            "whorang_analysis_started",
            {
                "visitor_id": analysis_data.get('visitor_id'),
                "image_url": analysis_data.get('image_url'),
                "timestamp": analysis_data.get('timestamp'),
                "automatic": True
            }
        )

    async def _handle_analysis_complete_auto(self, analysis_data: Dict[str, Any]) -> None:
        """Handle automatic AI analysis completed event."""
        _LOGGER.info("AI analysis completed for visitor: %s", analysis_data.get('visitor_id'))
        
        # Update coordinator data with analysis results
        if hasattr(self, 'data') and self.data:
            # Update latest visitor with analysis results
            if "latest_visitor" in self.data:
                ai_response = analysis_data.get("analysis", "Analysis completed")
                
                self.data["latest_visitor"].update({
                    "ai_analysis": ai_response,
                    "ai_message": ai_response,  # This is what the sensor reads!
                    "confidence": analysis_data.get("confidence", 0),
                    "faces_detected": analysis_data.get("faces_detected", 0),
                    "analysis_provider": analysis_data.get("provider", "unknown"),
                    "analysis_timestamp": analysis_data.get("timestamp"),
                    "processing": False  # Analysis is complete
                })
                
                _LOGGER.info("Updated sensor with AI response: %s", ai_response[:100] + "..." if len(ai_response) > 100 else ai_response)
            
            # Set AI processing to false
            self.data["ai_processing"] = False
            self.data["analysis_status"] = {
                "visitor_id": analysis_data.get('visitor_id'),
                "status": "completed",
                "timestamp": analysis_data.get('timestamp'),
                "analysis": analysis_data.get("analysis"),
                "confidence": analysis_data.get("confidence", 0),
                "faces_detected": analysis_data.get("faces_detected", 0),
                "provider": analysis_data.get("provider", "unknown")
            }
            
            self.async_set_updated_data(self.data)
        
        # Fire Home Assistant event
        self.hass.bus.async_fire(
            "whorang_analysis_complete",
            {
                "visitor_id": analysis_data.get('visitor_id'),
                "analysis": analysis_data.get("analysis"),
                "confidence": analysis_data.get("confidence", 0),
                "faces_detected": analysis_data.get("faces_detected", 0),
                "provider": analysis_data.get("provider", "unknown"),
                "timestamp": analysis_data.get('timestamp'),
                "automatic": True
            }
        )

    async def _handle_analysis_error(self, error_data: Dict[str, Any]) -> None:
        """Handle automatic AI analysis error event."""
        _LOGGER.warning("AI analysis error for visitor %s: %s", 
                       error_data.get("visitor_id"), error_data.get("error"))
        
        # Update coordinator data to show analysis failed
        if hasattr(self, 'data') and self.data:
            self.data["ai_processing"] = False
            self.data["analysis_status"] = {
                "visitor_id": error_data.get('visitor_id'),
                "status": "error",
                "timestamp": error_data.get('timestamp'),
                "error": error_data.get("error")
            }
            self.async_set_updated_data(self.data)
        
        # Fire Home Assistant event
        self.hass.bus.async_fire(
            "whorang_analysis_error",
            {
                "visitor_id": error_data.get('visitor_id'),
                "error": error_data.get("error"),
                "timestamp": error_data.get('timestamp'),
                "automatic": True
            }
        )

    def _is_known_visitor(self, visitor_data: Dict[str, Any]) -> bool:
        """Check if visitor is a known person based on face recognition."""
        # Check if any detected faces match known persons
        faces_detected = visitor_data.get("faces_detected", 0)
        if faces_detected > 0:
            # This would need to be enhanced with actual face matching logic
            # For now, we'll check if there's a person_id in the visitor data
            return visitor_data.get("person_id") is not None
        return False

    @callback
    def async_get_latest_visitor(self) -> Optional[Dict[str, Any]]:
        """Get the latest visitor data."""
        if self.data:
            return self.data.get("latest_visitor")
        return None

    @callback
    def async_get_system_info(self) -> Dict[str, Any]:
        """Get system information."""
        if self.data:
            return self.data.get("system_info", {})
        return {}

    @callback
    def async_get_known_persons(self) -> List[Dict[str, Any]]:
        """Get known persons list."""
        if self.data:
            return self.data.get("known_persons", [])
        return []

    @callback
    def async_get_ai_usage(self) -> Dict[str, Any]:
        """Get AI usage statistics."""
        if self.data:
            return self.data.get("ai_usage", {})
        return {"total_cost": 0, "total_requests": 0}

    @callback
    def async_is_websocket_connected(self) -> bool:
        """Check if WebSocket is connected."""
        if self.data:
            return self.data.get("websocket_connected", False)
        return False

    async def async_trigger_analysis(self, visitor_id: Optional[str] = None) -> bool:
        """Trigger AI analysis for a visitor with Home Assistant configuration."""
        try:
            # Get the Home Assistant configuration entry to pass AI template settings
            config_entry = None
            for entry in self.hass.config_entries.async_entries(DOMAIN):
                if entry.state.name == "loaded":
                    config_entry = entry
                    break
            
            # Extract AI template configuration from Home Assistant options
            ai_template_config = {}
            if config_entry and config_entry.options:
                automation_config = config_entry.options.get("intelligent_automation", {})
                ai_template_config = {
                    "ai_prompt_template": automation_config.get("ai_prompt_template", "professional"),
                    "custom_ai_prompt": automation_config.get("custom_ai_prompt", ""),
                    "enable_weather_context": automation_config.get("enable_weather_context", True)
                }
                
                _LOGGER.info("Triggering analysis with AI template: %s", 
                           ai_template_config.get("ai_prompt_template", "professional"))
            
            # Call the enhanced trigger analysis method
            await self.api_client.trigger_analysis_with_config(visitor_id, ai_template_config)
            return True
        except Exception as err:
            _LOGGER.error("Failed to trigger analysis: %s", err)
            return False

    async def async_test_webhook(self) -> bool:
        """Test webhook functionality."""
        try:
            await self.api_client.test_webhook()
            return True
        except Exception as err:
            _LOGGER.error("Failed to test webhook: %s", err)
            return False

    async def async_set_ai_provider(self, provider: str, api_key: str = None) -> bool:
        """Set the active AI provider with optional API key."""
        try:
            if api_key:
                success = await self.api_client.set_ai_provider_with_key(provider, api_key)
            else:
                await self.api_client.set_ai_provider(provider)
                success = True
            
            if success:
                # Refresh data after changing provider
                await self.async_request_refresh()
            return success
        except Exception as err:
            _LOGGER.error("Failed to set AI provider: %s", err)
            return False

    async def async_add_known_person(self, name: str, notes: Optional[str] = None) -> bool:
        """Add a new known person."""
        try:
            await self.api_client.create_person(name, notes)
            # Refresh data after adding person
            await self.async_request_refresh()
            return True
        except Exception as err:
            _LOGGER.error("Failed to add known person: %s", err)
            return False

    async def async_remove_known_person(self, person_id: int) -> bool:
        """Remove a known person."""
        try:
            await self.api_client.delete_person(person_id)
            # Refresh data after removing person
            await self.async_request_refresh()
            return True
        except Exception as err:
            _LOGGER.error("Failed to remove known person: %s", err)
            return False

    async def async_export_data(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        format_type: str = "json",
    ) -> Optional[Dict[str, Any]]:
        """Export visitor data."""
        try:
            return await self.api_client.export_visitor_data(start_date, end_date, format_type)
        except Exception as err:
            _LOGGER.error("Failed to export data: %s", err)
            return None

    async def async_process_doorbell_event(self, event_data: Dict[str, Any]) -> bool:
        """Process a complete doorbell event with image and context data."""
        try:
            _LOGGER.debug("Coordinator processing doorbell event: %s", event_data)
            
            # Extract data from event
            image_url = event_data.get("image_url")
            if not image_url:
                _LOGGER.error("Image URL is required for doorbell event")
                return False
            
            # Extract AI template configuration from automation_config
            automation_config = event_data.get("automation_config", {})
            ai_template_config = {}
            
            if automation_config:
                ai_template_config = {
                    "ai_prompt_template": automation_config.get("ai_prompt_template", "professional"),
                    "custom_ai_prompt": automation_config.get("custom_ai_prompt", ""),
                    "enable_weather_context": automation_config.get("enable_weather_context", True)
                }
                _LOGGER.info("🎯 Using AI template from HA config: %s", ai_template_config.get("ai_prompt_template"))
            else:
                _LOGGER.warning("No automation config found, using default professional template")
                ai_template_config = {
                    "ai_prompt_template": "professional",
                    "custom_ai_prompt": "",
                    "enable_weather_context": True
                }
            
            # Create enhanced event data with AI template configuration
            enhanced_event_data = event_data.copy()
            enhanced_event_data.update(ai_template_config)
            
            # Send event to backend API with AI template configuration
            success = await self.api_client.process_doorbell_event(enhanced_event_data)
            
            if not success:
                _LOGGER.error("Backend failed to process doorbell event")
                return False
            
            # Update coordinator data immediately for entity updates
            current_time = datetime.now()
            
            # Create weather data structure - ensure it's always a dict
            weather_data = {
                "temperature": event_data.get("weather_temp"),
                "humidity": event_data.get("weather_humidity"),
                "condition": event_data.get("weather_condition", "unknown"),
                "wind_speed": event_data.get("wind_speed", 0),
                "pressure": event_data.get("pressure", 1013)
            }
            
            # Create visitor data structure with initial processing message
            visitor_data = {
                "visitor_id": f"service_call_{int(current_time.timestamp())}",
                "visitor_name": "Unknown Visitor",
                "timestamp": event_data.get("timestamp", current_time.isoformat()),
                "face_recognized": False,
                "confidence": 0.8,
                "ai_analysis": "🔄 AI analysis in progress...",  # Initial processing message
                "ai_message": "🔄 AI analysis in progress...",     # For compatibility
                "ai_title": event_data.get("ai_title", "Doorbell Event"),
                "image_url": image_url,
                "location": event_data.get("location", "front_door"),
                "processing": True,  # Flag to indicate analysis is in progress
                
                # Store weather as both dict and individual fields for flexibility
                "weather": weather_data,
                "weather_temp": event_data.get("weather_temp"),
                "weather_humidity": event_data.get("weather_humidity"),
                "weather_condition": event_data.get("weather_condition"),
                "wind_speed": event_data.get("wind_speed"),
                "pressure": event_data.get("pressure"),
                
                "source": event_data.get("source", "service_call")
            }
            
            # Initialize data if needed
            if not hasattr(self, 'data') or self.data is None:
                self.data = {}
            
            # Update coordinator data structure for immediate entity updates
            self.data.update({
                "latest_visitor": visitor_data,
                "latest_image": {
                    "url": image_url,
                    "timestamp": current_time.isoformat(),
                    "status": "available",
                    "source": "service_call"
                },
                "doorbell_state": {
                    "last_triggered": current_time.isoformat(),
                    "is_triggered": True,
                    "trigger_source": "service_call"
                },
                "last_service_call": {
                    "timestamp": current_time.isoformat(),
                    "data": event_data
                }
            })
            
            # Update visitor statistics
            today = current_time.date().isoformat()
            if "visitor_stats" not in self.data:
                self.data["visitor_stats"] = {}
            
            if "today" not in self.data["visitor_stats"] or self.data["visitor_stats"].get("date") != today:
                self.data["visitor_stats"]["today"] = 0
                self.data["visitor_stats"]["date"] = today
                
            self.data["visitor_stats"]["today"] += 1
            
            # Update system status
            if "system_info" not in self.data:
                self.data["system_info"] = {}
            
            self.data["system_info"].update({
                "last_event": current_time.isoformat(),
                "processing": False,
                "last_service_call": current_time.isoformat()
            })
            
            _LOGGER.info("Coordinator data updated successfully for doorbell event")
            
            # Trigger immediate coordinator update to notify all entities
            self.async_set_updated_data(self.data)
            
            # Fire Home Assistant event for automations
            self.hass.bus.async_fire("whorang_visitor_detected", {
                "visitor_data": visitor_data,
                "event_source": "service_call",
                "image_url": image_url
            })
            
            # Schedule a delayed update to fetch the actual AI response from backend
            # This ensures we get the AI response even if WebSocket doesn't work
            asyncio.create_task(self._delayed_ai_response_fetch(visitor_data["visitor_id"]))
            
            _LOGGER.info("Successfully processed doorbell event with image: %s", image_url)
            return True
            
        except Exception as err:
            _LOGGER.error("Failed to process doorbell event in coordinator: %s", err, exc_info=True)
            return False

    async def _delayed_ai_response_fetch(self, visitor_id: str) -> None:
        """Fetch the actual AI response from backend after a delay to ensure analysis is complete."""
        try:
            # Wait for backend to complete AI analysis (typically takes 3-10 seconds)
            await asyncio.sleep(15)  # Give enough time for AI analysis to complete
            
            _LOGGER.info("Fetching updated visitor data for AI response: %s", visitor_id)
            
            # Fetch the latest visitor data from backend
            latest_visitor = await self.api_client.get_latest_visitor()
            
            if latest_visitor and hasattr(self, 'data') and self.data:
                # Check if this is the visitor we're looking for or if it's newer
                backend_visitor_id = latest_visitor.get("visitor_id")
                backend_timestamp = latest_visitor.get("timestamp")
                
                # Update the sensor with the actual AI response from backend
                ai_message = latest_visitor.get("ai_message", "")
                ai_title = latest_visitor.get("ai_title", "")
                
                if ai_message and ai_message != "🔄 AI analysis in progress...":
                    # Update coordinator data with the actual AI response
                    self.data["latest_visitor"].update({
                        "ai_analysis": ai_message,
                        "ai_message": ai_message,
                        "ai_title": ai_title,
                        "processing": False,
                        "backend_visitor_id": backend_visitor_id,
                        "backend_timestamp": backend_timestamp,
                        "confidence": latest_visitor.get("confidence_score", 0),
                        "faces_detected": latest_visitor.get("faces_detected", 0),
                        "objects_detected": latest_visitor.get("objects_detected", 0),
                        "analysis_provider": latest_visitor.get("ai_provider", "unknown")
                    })
                    
                    # Trigger coordinator update to refresh all entities
                    self.async_set_updated_data(self.data)
                    
                    _LOGGER.info("Successfully updated sensor with AI response from backend: %s", 
                               ai_message[:100] + "..." if len(ai_message) > 100 else ai_message)
                else:
                    _LOGGER.warning("Backend AI response not ready yet or still processing")
            else:
                _LOGGER.warning("Failed to fetch updated visitor data from backend")
                
        except Exception as err:
            _LOGGER.error("Error fetching delayed AI response: %s", err)
