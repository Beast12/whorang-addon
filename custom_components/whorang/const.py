"""Constants for the WhoRang AI Doorbell integration."""
from __future__ import annotations

from typing import Final

# Integration domain
DOMAIN: Final = "whorang"

# Configuration constants
CONF_HOST: Final = "host"
CONF_PORT: Final = "port"
CONF_URL: Final = "url"
CONF_USE_SSL: Final = "use_ssl"
CONF_VERIFY_SSL: Final = "verify_ssl"
CONF_API_KEY: Final = "api_key"
CONF_UPDATE_INTERVAL: Final = "update_interval"
CONF_ENABLE_WEBSOCKET: Final = "enable_websocket"
CONF_ENABLE_COST_TRACKING: Final = "enable_cost_tracking"
CONF_OLLAMA_HOST: Final = "ollama_host"
CONF_OLLAMA_PORT: Final = "ollama_port"
CONF_OLLAMA_ENABLED: Final = "ollama_enabled"


# Default values
DEFAULT_PORT: Final = 3001
DEFAULT_UPDATE_INTERVAL: Final = 30
DEFAULT_TIMEOUT: Final = 10
DEFAULT_WEBSOCKET_TIMEOUT: Final = 30
DEFAULT_OLLAMA_HOST: Final = "localhost"
DEFAULT_OLLAMA_PORT: Final = 11434

# Auto-discovery constants
ADDON_DETECTION_HOSTS: Final = [
    "localhost",
    "127.0.0.1",
    "homeassistant.local",
    "supervisor"
]
ADDON_DETECTION_PORTS: Final = [3001, 80]

# Intelligent Automation Defaults
DEFAULT_CAMERA_MONITOR_MODE: Final = "state_change"
DEFAULT_AI_PROMPT_TEMPLATE: Final = "professional"
DEFAULT_NOTIFICATION_TEMPLATE: Final = "rich_media"
DEFAULT_DISPLAY_DURATION: Final = 15
DEFAULT_DOORBELL_SOUND: Final = "/local/sounds/doorbell.mp3"

# AI Prompt Templates
AI_PROMPT_TEMPLATES: Final = {
    "professional": {
        "name": "Professional Security",
        "prompt": "Analyze this doorbell camera image and provide a professional security description. Focus on identifying people, vehicles, packages, and any security-relevant details. Be precise and factual.",
        "max_tokens": 150,
        "temperature": 0.1
    },
    "friendly": {
        "name": "Friendly Greeter",
        "prompt": "Describe what you see at the front door in a friendly, welcoming manner. Focus on visitors and any deliveries or interesting details.",
        "max_tokens": 120,
        "temperature": 0.3
    },
    "sarcastic": {
        "name": "Sarcastic Guard",
        "prompt": "You are my sarcastic funny security guard. Describe what you see. Don't mention trees, bushes, grass, landscape, driveway, light fixtures, yard, brick, wall, garden. Don't mention the time and date. Be precise and short in one funny one liner of max 10 words. Only describe the person, vehicle or the animal.",
        "max_tokens": 100,
        "temperature": 0.2
    },
    "detailed": {
        "name": "Detailed Analysis",
        "prompt": "Provide a comprehensive analysis of this doorbell image including people, objects, weather conditions, lighting, and any notable details. Include confidence levels for your observations.",
        "max_tokens": 200,
        "temperature": 0.1
    },
    "custom": {
        "name": "Custom Prompt",
        "prompt": "",
        "max_tokens": 150,
        "temperature": 0.2
    }
}

# Notification Templates
NOTIFICATION_TEMPLATES: Final = {
    "rich_media": {
        "name": "Rich Media Notification",
        "title": "{{ ai_title | default('Doorbell') }}",
        "message": "{{ ai_description }}",
        "data": {
            "image": "{{ snapshot_url }}",
            "ttl": 0,
            "priority": "high",
            "clickAction": "{{ snapshot_url }}",
            "actions": [
                {"action": "VIEW_PHOTO", "title": "📷 View Photo"},
                {"action": "OPEN_CAMERA", "title": "📹 Live Camera"},
                {"action": "DISMISS", "title": "❌ Dismiss"}
            ]
        }
    },
    "simple": {
        "name": "Simple Text Notification",
        "title": "{{ ai_title | default('Doorbell') }}",
        "message": "{{ ai_description }}",
        "data": {
            "priority": "high"
        }
    },
    "custom": {
        "name": "Custom Template",
        "title": "{{ ai_title }}",
        "message": "{{ ai_description }}",
        "data": {}
    }
}

# Camera Monitor Modes
CAMERA_MONITOR_MODES: Final = {
    "state_change": "Camera State Change",
    "webhook": "External Webhook",
    "manual": "Manual Trigger Only"
}

# API endpoints
API_HEALTH: Final = "/health"
API_VISITORS: Final = "/api/visitors"
API_STATS: Final = "/api/stats"
API_CONFIG_WEBHOOK: Final = "/api/config/webhook"
API_FACES_CONFIG: Final = "/api/faces/config"
API_FACES_PERSONS: Final = "/api/faces/persons"
API_DETECTED_FACES: Final = "/api/detected-faces"
API_OPENAI: Final = "/api/openai"
WEBSOCKET_PATH: Final = "/ws"

# Entity unique ID prefixes
SENSOR_PREFIX: Final = "sensor"
BINARY_SENSOR_PREFIX: Final = "binary_sensor"
CAMERA_PREFIX: Final = "camera"
DEVICE_TRACKER_PREFIX: Final = "device_tracker"
BUTTON_PREFIX: Final = "button"
SELECT_PREFIX: Final = "select"

# Sensor types
SENSOR_LATEST_VISITOR: Final = "latest_visitor"
SENSOR_VISITOR_COUNT_TODAY: Final = "visitor_count_today"
SENSOR_VISITOR_COUNT_WEEK: Final = "visitor_count_week"
SENSOR_VISITOR_COUNT_MONTH: Final = "visitor_count_month"
SENSOR_SYSTEM_STATUS: Final = "system_status"
SENSOR_AI_PROVIDER_ACTIVE: Final = "ai_provider_active"
SENSOR_AI_COST_TODAY: Final = "ai_cost_today"
SENSOR_AI_COST_MONTH: Final = "ai_cost_month"
SENSOR_AI_RESPONSE_TIME: Final = "ai_response_time"
SENSOR_KNOWN_FACES_COUNT: Final = "known_faces_count"
SENSOR_UNKNOWN_FACES: Final = "unknown_faces"
SENSOR_LATEST_FACE_DETECTION: Final = "latest_face_detection"

# Binary sensor types
BINARY_SENSOR_DOORBELL: Final = "doorbell"
BINARY_SENSOR_MOTION: Final = "motion"
BINARY_SENSOR_KNOWN_VISITOR: Final = "known_visitor"
BINARY_SENSOR_SYSTEM_ONLINE: Final = "system_online"
BINARY_SENSOR_AI_PROCESSING: Final = "ai_processing"

# Camera types
CAMERA_LATEST_IMAGE: Final = "latest_image"

# Button types
BUTTON_TRIGGER_ANALYSIS: Final = "trigger_analysis"
BUTTON_TEST_WEBHOOK: Final = "test_webhook"
BUTTON_REFRESH_DATA: Final = "refresh_data"

# Select types
SELECT_AI_PROVIDER: Final = "ai_provider"

# Service names
SERVICE_TRIGGER_ANALYSIS: Final = "trigger_analysis"
SERVICE_ADD_KNOWN_VISITOR: Final = "add_known_visitor"
SERVICE_REMOVE_KNOWN_VISITOR: Final = "remove_known_visitor"
SERVICE_SET_AI_PROVIDER: Final = "set_ai_provider"
SERVICE_SET_AI_MODEL: Final = "set_ai_model"
SERVICE_GET_AVAILABLE_MODELS: Final = "get_available_models"
SERVICE_REFRESH_OLLAMA_MODELS: Final = "refresh_ollama_models"
SERVICE_TEST_OLLAMA_CONNECTION: Final = "test_ollama_connection"
SERVICE_EXPORT_DATA: Final = "export_data"
SERVICE_TEST_WEBHOOK: Final = "test_webhook"
SERVICE_PROCESS_DOORBELL_EVENT: Final = "process_doorbell_event"
SERVICE_LABEL_FACE: Final = "label_face"
SERVICE_BATCH_LABEL_FACES: Final = "batch_label_faces"
SERVICE_CREATE_PERSON_FROM_FACE: Final = "create_person_from_face"
SERVICE_GET_UNKNOWN_FACES: Final = "get_unknown_faces"
SERVICE_DELETE_FACE: Final = "delete_face"
SERVICE_GET_FACE_SIMILARITIES: Final = "get_face_similarities"


# WebSocket message types
WS_TYPE_NEW_VISITOR: Final = "new_visitor"
WS_TYPE_CONNECTION_STATUS: Final = "connection_status"
WS_TYPE_AI_ANALYSIS_COMPLETE: Final = "ai_analysis_complete"
WS_TYPE_FACE_DETECTION_COMPLETE: Final = "face_detection_complete"
WS_TYPE_SYSTEM_STATUS: Final = "system_status"
WS_TYPE_FACE_DETECTED: Final = "face_detected"
WS_TYPE_UNKNOWN_FACE_FOUND: Final = "unknown_face_found"
WS_TYPE_FACE_LABELED: Final = "face_labeled"

# AI Providers
AI_PROVIDERS: Final = [
    "openai",
    "local",
    "claude",
    "gemini",
    "google-cloud-vision"
]

# Device information
MANUFACTURER: Final = "WhoRang"
MODEL: Final = "AI Doorbell System"
SW_VERSION: Final = "1.1.0-dev"

# Attributes
ATTR_VISITOR_ID: Final = "visitor_id"
ATTR_TIMESTAMP: Final = "timestamp"
ATTR_AI_MESSAGE: Final = "ai_message"
ATTR_AI_TITLE: Final = "ai_title"
ATTR_LOCATION: Final = "location"
ATTR_WEATHER: Final = "weather"
ATTR_DEVICE_NAME: Final = "device_name"
ATTR_CONFIDENCE_SCORE: Final = "confidence_score"
ATTR_OBJECTS_DETECTED: Final = "objects_detected"
ATTR_FACES_DETECTED: Final = "faces_detected"
ATTR_PROCESSING_TIME: Final = "processing_time"
ATTR_AI_PROVIDER: Final = "ai_provider"
ATTR_COST_USD: Final = "cost_usd"
ATTR_PERSON_NAME: Final = "person_name"
ATTR_PERSON_ID: Final = "person_id"
ATTR_IMAGE_URL: Final = "image_url"
ATTR_FACE_ID: Final = "face_id"
ATTR_FACE_CROP_PATH: Final = "face_crop_path"
ATTR_FACE_QUALITY: Final = "face_quality"
ATTR_UNKNOWN_FACES: Final = "unknown_faces"
ATTR_KNOWN_FACES: Final = "known_faces"
ATTR_FACE_DETAILS: Final = "face_details"
ATTR_REQUIRES_LABELING: Final = "requires_labeling"
ATTR_SIMILARITY_SCORE: Final = "similarity_score"

# Event types for automation
EVENT_VISITOR_DETECTED: Final = f"{DOMAIN}_visitor_detected"
EVENT_KNOWN_VISITOR_DETECTED: Final = f"{DOMAIN}_known_visitor_detected"
EVENT_AI_ANALYSIS_COMPLETE: Final = f"{DOMAIN}_ai_analysis_complete"
EVENT_FACE_DETECTION_COMPLETE: Final = f"{DOMAIN}_face_detection_complete"
EVENT_UNKNOWN_FACE_DETECTED: Final = f"{DOMAIN}_unknown_face_detected"
EVENT_FACE_LABELED: Final = f"{DOMAIN}_face_labeled"
EVENT_PERSON_CREATED: Final = f"{DOMAIN}_person_created"

# Intelligent Automation Events (HA 2025+ Compatible)
EVENT_DOORBELL_DETECTED: Final = f"{DOMAIN}_doorbell_detected"
EVENT_CAMERA_SNAPSHOT_CAPTURED: Final = f"{DOMAIN}_camera_snapshot_captured"
EVENT_INTELLIGENT_ANALYSIS_COMPLETE: Final = f"{DOMAIN}_intelligent_analysis_complete"
EVENT_NOTIFICATION_SENT: Final = f"{DOMAIN}_notification_sent"
EVENT_MEDIA_PLAYBACK_COMPLETE: Final = f"{DOMAIN}_media_playback_complete"
EVENT_AUTOMATION_STARTED: Final = f"{DOMAIN}_automation_started"
EVENT_AUTOMATION_STOPPED: Final = f"{DOMAIN}_automation_stopped"

# Error messages
ERROR_CANNOT_CONNECT: Final = "cannot_connect"
ERROR_INVALID_AUTH: Final = "invalid_auth"
ERROR_INVALID_URL: Final = "invalid_url"
ERROR_SSL_ERROR: Final = "ssl_error"
ERROR_UNKNOWN: Final = "unknown"
ERROR_TIMEOUT: Final = "timeout"
ERROR_API_ERROR: Final = "api_error"

# State classes
STATE_CLASS_MEASUREMENT: Final = "measurement"
STATE_CLASS_TOTAL: Final = "total"
STATE_CLASS_TOTAL_INCREASING: Final = "total_increasing"

# Device classes
DEVICE_CLASS_TIMESTAMP: Final = "timestamp"
DEVICE_CLASS_DURATION: Final = "duration"
DEVICE_CLASS_MONETARY: Final = "monetary"
DEVICE_CLASS_CONNECTIVITY: Final = "connectivity"
DEVICE_CLASS_MOTION: Final = "motion"
DEVICE_CLASS_OCCUPANCY: Final = "occupancy"

# Units
UNIT_MILLISECONDS: Final = "ms"
UNIT_CURRENCY_USD: Final = "USD"
UNIT_VISITORS: Final = "visitors"
UNIT_FACES: Final = "faces"
