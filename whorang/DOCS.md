# WhoRang AI Doorbell - Complete Documentation

This document provides comprehensive configuration and usage information for the WhoRang AI Doorbell add-on.

## Table of Contents

- [Installation](#installation)
- [Configuration](#configuration)
- [AI Provider Setup](#ai-provider-setup)
- [Home Assistant Integration](#home-assistant-integration)
- [API Reference](#api-reference)
- [Dashboard Setup](#dashboard-setup)
- [Automation Examples](#automation-examples)
- [Troubleshooting](#troubleshooting)
- [Advanced Configuration](#advanced-configuration)
- [Security](#security)
- [Performance Optimization](#performance-optimization)

## Installation

### Prerequisites

- Home Assistant OS or Supervised installation
- Minimum 2GB RAM (4GB recommended)
- 1GB free storage space
- Internet connection (for cloud AI providers)

### Add-on Installation

1. **Add Repository**:
   ```
   Settings → Add-ons → Add-on Store → ⋮ → Repositories
   Add: https://github.com/Beast12/whorang-addon
   ```

2. **Install Add-on**:
   - Find "WhoRang AI Doorbell" in the add-on store
   - Click Install
   - Wait for installation to complete

3. **Start Add-on**:
   - Configure your settings (see Configuration section)
   - Click Start
   - Check logs for any errors

4. **Integration Setup**:
   - The integration appears automatically in Home Assistant
   - Go to Settings → Devices & Services
   - Configure the WhoRang integration
   - Add your AI API keys

## Configuration

### Basic Configuration

The add-on provides extensive configuration options through the Home Assistant interface:

#### SSL Configuration
```yaml
ssl: false                    # Enable SSL/TLS
certfile: "fullchain.pem"     # SSL certificate file
keyfile: "privkey.pem"        # SSL private key file
```

#### AI Provider Settings
```yaml
ai_provider: "local"          # AI provider: local|openai|claude|gemini|google-cloud-vision
log_level: "info"             # Logging level: debug|info|warn|error
```

#### Database and Storage
```yaml
database_path: "/data/whorang.db"    # Database location
uploads_path: "/data/uploads"        # Upload directory
max_upload_size: "10MB"              # Maximum file upload size
```

#### Face Recognition
```yaml
face_recognition_threshold: 0.6      # Face matching threshold (0.1-1.0)
ai_analysis_timeout: 30              # AI analysis timeout (10-120 seconds)
```

#### Network Settings
```yaml
websocket_enabled: true              # Enable WebSocket for real-time updates
cors_enabled: true                   # Enable CORS for web interface
cors_origins: ["*"]                  # Allowed CORS origins
public_url: ""                       # Public URL for webhooks (optional)
```

### Environment Variables

The add-on automatically sets these environment variables:

- `NODE_ENV`: "production"
- `PORT`: "3001"
- `DATABASE_PATH`: "/data/whorang.db"
- `UPLOADS_PATH`: "/data/uploads"

## AI Provider Setup

### Local Ollama (Free, Private)

**Advantages**: Free, private, no API limits
**Disadvantages**: Requires local resources, slower processing

1. **Install Ollama** on your system or in a separate container
2. **Pull a vision model**:
   ```bash
   ollama pull llava-phi3
   # or
   ollama pull llava:13b
   ```
3. **Configure in Home Assistant**:
   ```yaml
   ai_provider: "local"
   ollama_host: "localhost"  # or container IP
   ollama_port: 11434
   ```

### OpenAI GPT-4 Vision (Recommended)

**Advantages**: Highest accuracy, fast processing, reliable
**Disadvantages**: Costs money, requires internet

1. **Get API Key**: Visit [OpenAI Platform](https://platform.openai.com/api-keys)
2. **Configure in Integration**:
   - Go to Settings → Devices & Services → WhoRang
   - Click Configure
   - Enter your OpenAI API key
   - Select model (gpt-4o recommended)

### Google Gemini (Fast and Affordable)

**Advantages**: Fast, affordable, good accuracy
**Disadvantages**: Requires internet, Google account

1. **Get API Key**: Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. **Configure in Integration**:
   - Enter your Gemini API key
   - Select model (gemini-1.5-flash recommended)

### Anthropic Claude (High Quality)

**Advantages**: High quality analysis, good privacy
**Disadvantages**: More expensive, requires internet

1. **Get API Key**: Visit [Anthropic Console](https://console.anthropic.com/)
2. **Configure in Integration**:
   - Enter your Claude API key
   - Select model (claude-3-sonnet recommended)

### Google Cloud Vision (Enterprise)

**Advantages**: Enterprise-grade, very reliable
**Disadvantages**: Complex setup, requires GCP account

1. **Setup GCP Project** with Vision API enabled
2. **Create Service Account** and download JSON key
3. **Configure in Integration**:
   - Upload service account JSON
   - Configure project settings

## Home Assistant Integration

### Entities Created

The integration creates 19+ entities across 6 platforms:

#### Sensors (9 entities)
- `sensor.whorang_latest_visitor` - Latest visitor analysis with AI description
- `sensor.whorang_visitor_count_today` - Number of visitors today
- `sensor.whorang_visitor_count_week` - Number of visitors this week
- `sensor.whorang_visitor_count_month` - Number of visitors this month
- `sensor.whorang_ai_response_time` - AI processing time in seconds
- `sensor.whorang_ai_cost_today` - AI usage cost today
- `sensor.whorang_ai_cost_month` - AI usage cost this month
- `sensor.whorang_system_status` - System health status
- `sensor.whorang_last_analysis_time` - Timestamp of last analysis

#### Binary Sensors (5 entities)
- `binary_sensor.whorang_doorbell` - Doorbell ring detection
- `binary_sensor.whorang_motion` - Motion detection at door
- `binary_sensor.whorang_known_visitor` - Known visitor presence
- `binary_sensor.whorang_system_online` - System connectivity status
- `binary_sensor.whorang_ai_processing` - AI processing active

#### Controls (5 entities)
- `button.whorang_trigger_analysis` - Manually trigger AI analysis
- `button.whorang_refresh_data` - Refresh all entity data
- `button.whorang_test_webhook` - Test webhook connectivity
- `select.whorang_ai_provider` - Select active AI provider
- `select.whorang_ai_model` - Select AI model for provider

#### Camera (1 entity)
- `camera.whorang_latest_image` - Latest doorbell image

### Services Available

#### Core Services
```yaml
# Trigger AI analysis of doorbell image
service: whorang.trigger_analysis
data:
  image_url: "http://your-camera/snapshot"
  webhook_id: "doorbell_main"

# Process complete doorbell event
service: whorang.process_doorbell_event
data:
  image_url: "http://your-camera/snapshot"
  event_type: "doorbell_press"
  timestamp: "2025-01-22T10:30:00Z"

# Change AI provider
service: whorang.set_ai_provider
data:
  provider: "openai"
  model: "gpt-4o"
```

#### Face Management Services
```yaml
# Label a detected face
service: whorang.label_face
data:
  face_id: "face_123"
  person_name: "John Doe"

# Create new person from face
service: whorang.create_person_from_face
data:
  face_id: "face_123"
  person_name: "Jane Smith"
  description: "Neighbor from next door"

# Get unknown faces needing labels
service: whorang.get_unknown_faces
# Returns list of faces without person labels
```

## API Reference

### REST API Endpoints

#### Analysis Endpoints
```http
POST /api/analyze
Content-Type: application/json
{
  "image_url": "http://camera/snapshot",
  "webhook_id": "doorbell_main",
  "ai_provider": "openai"
}

GET /api/stats
# Returns visitor statistics

GET /api/visitors?page=1&limit=20
# Returns paginated visitor list
```

#### Face Management
```http
GET /api/faces/gallery
# Returns face gallery with thumbnails

POST /api/faces/{face_id}/label
Content-Type: application/json
{
  "person_name": "John Doe"
}

DELETE /api/faces/{face_id}
# Deletes a face

GET /api/faces/persons
# Returns list of known persons
```

#### Configuration
```http
GET /api/config
# Returns current configuration

POST /api/config
Content-Type: application/json
{
  "ai_provider": "openai",
  "face_recognition_threshold": 0.7
}

GET /api/models
# Returns available AI models for current provider
```

### WebSocket Events

Connect to WebSocket at `ws://addon-ip:3001/ws` for real-time updates:

```javascript
// Visitor detected
{
  "type": "visitor_update",
  "data": {
    "visitor_id": "visitor_123",
    "timestamp": "2025-01-22T10:30:00Z",
    "ai_description": "A person in a blue jacket...",
    "known_person": "John Doe",
    "confidence": 0.85
  }
}

// Face detection complete
{
  "type": "face_detection_complete",
  "data": {
    "faces_detected": 2,
    "processing_time": 1.2,
    "faces": [...]
  }
}

// System status change
{
  "type": "system_status",
  "data": {
    "status": "online",
    "ai_provider": "openai",
    "last_analysis": "2025-01-22T10:30:00Z"
  }
}
```

## Dashboard Setup

### Custom Cards

WhoRang provides three custom Lovelace cards:

#### 1. Face Manager Card
Complete face labeling interface with drag-and-drop functionality.

```yaml
type: custom:whorang-face-manager
title: "Face Management"
show_unknown_only: false
auto_refresh: true
```

#### 2. Face Manager Simple Card
Streamlined interface for quick face labeling.

```yaml
type: custom:whorang-face-manager-simple
title: "Quick Face Labels"
max_faces: 10
```

#### 3. Known Persons Card
Gallery of known persons with avatars and statistics.

```yaml
type: custom:whorang-known-persons-card
title: "Known Visitors"
show_stats: true
avatar_size: "large"
```

### Dashboard Examples

#### Visitor Overview Dashboard
```yaml
title: "Doorbell Visitors"
views:
  - title: "Overview"
    cards:
      - type: entities
        title: "Visitor Stats"
        entities:
          - sensor.whorang_visitor_count_today
          - sensor.whorang_visitor_count_week
          - sensor.whorang_visitor_count_month
          - sensor.whorang_latest_visitor

      - type: picture-entity
        entity: camera.whorang_latest_image
        title: "Latest Visitor"

      - type: custom:whorang-known-persons-card
        title: "Known Visitors"
```

#### AI Management Dashboard
```yaml
title: "AI Configuration"
views:
  - title: "AI Settings"
    cards:
      - type: entities
        title: "AI Provider"
        entities:
          - select.whorang_ai_provider
          - select.whorang_ai_model
          - sensor.whorang_ai_response_time
          - sensor.whorang_ai_cost_today

      - type: entities
        title: "System Status"
        entities:
          - binary_sensor.whorang_system_online
          - binary_sensor.whorang_ai_processing
          - sensor.whorang_system_status
```

## Automation Examples

### Basic Doorbell Notification
```yaml
automation:
  - alias: "Doorbell Visitor Notification"
    trigger:
      - platform: state
        entity_id: binary_sensor.whorang_doorbell
        to: "on"
    action:
      - service: notify.mobile_app
        data:
          title: "Doorbell"
          message: "{{ states('sensor.whorang_latest_visitor') }}"
          data:
            image: "{{ state_attr('camera.whorang_latest_image', 'entity_picture') }}"
```

### Known Visitor Welcome
```yaml
automation:
  - alias: "Welcome Known Visitor"
    trigger:
      - platform: state
        entity_id: binary_sensor.whorang_known_visitor
        to: "on"
    condition:
      - condition: template
        value_template: "{{ trigger.to_state.attributes.person_name != 'Unknown' }}"
    action:
      - service: tts.speak
        data:
          entity_id: media_player.living_room
          message: "Welcome home, {{ trigger.to_state.attributes.person_name }}"
```

### AI Cost Monitoring
```yaml
automation:
  - alias: "AI Cost Alert"
    trigger:
      - platform: numeric_state
        entity_id: sensor.whorang_ai_cost_month
        above: 10.00
    action:
      - service: notify.admin
        data:
          title: "WhoRang Cost Alert"
          message: "Monthly AI costs have exceeded $10: ${{ states('sensor.whorang_ai_cost_month') }}"
```

### Automatic Face Labeling
```yaml
automation:
  - alias: "Auto-label Family Members"
    trigger:
      - platform: webhook
        webhook_id: "whorang_face_detected"
    condition:
      - condition: template
        value_template: "{{ trigger.json.confidence > 0.9 }}"
    action:
      - service: whorang.label_face
        data:
          face_id: "{{ trigger.json.face_id }}"
          person_name: "{{ trigger.json.suggested_name }}"
```

## Troubleshooting

### Common Issues

#### Add-on Won't Start
1. **Check Logs**: Look for error messages in add-on logs
2. **Verify Configuration**: Ensure all required fields are set
3. **Check Resources**: Ensure sufficient RAM and storage
4. **Port Conflicts**: Verify port 3001 is not in use

```bash
# Check add-on logs
docker logs addon_local_whorang

# Check port usage
netstat -tulpn | grep 3001
```

#### Integration Not Appearing
1. **Restart Home Assistant**: Sometimes required for new integrations
2. **Check Custom Components**: Verify integration files are present
3. **Clear Browser Cache**: Clear cache and refresh
4. **Check Logs**: Look for integration errors in HA logs

```bash
# Check integration files
ls -la /config/custom_components/whorang/

# Check Home Assistant logs
tail -f /config/home-assistant.log | grep whorang
```

#### Face Detection Not Working
1. **Verify AI Provider**: Ensure API keys are valid and working
2. **Check Image URLs**: Verify camera images are accessible
3. **Test Manually**: Use the trigger analysis button
4. **Review Logs**: Look for coordinate format issues

```bash
# Test AI provider manually
curl -X POST http://addon-ip:3001/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"image_url": "http://camera/snapshot"}'
```

#### Performance Issues
1. **Optimize AI Provider**: Use local Ollama for speed, OpenAI for accuracy
2. **Adjust Update Interval**: Increase interval to reduce API calls
3. **Enable Caching**: Ensure model caching is enabled
4. **Monitor Resources**: Check CPU and memory usage

### Debug Mode

Enable debug logging for detailed troubleshooting:

```yaml
# configuration.yaml
logger:
  default: info
  logs:
    custom_components.whorang: debug
    whorang: debug
```

### Network Diagnostics

Test network connectivity and API access:

```bash
# Test add-on connectivity
curl http://addon-ip:3001/api/health

# Test AI provider (OpenAI example)
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY"

# Test WebSocket connection
wscat -c ws://addon-ip:3001/ws
```

## Advanced Configuration

### Custom AI Templates

Customize AI analysis responses by modifying templates:

```yaml
# In integration configuration
ai_templates:
  professional: "Analyze this doorbell visitor professionally"
  friendly: "Describe this visitor in a friendly manner"
  detailed: "Provide detailed analysis of this person"
  security: "Security assessment of this visitor"
```

### Webhook Configuration

Set up webhooks for external integrations:

```yaml
# Add-on configuration
public_url: "https://your-domain.com"
webhook_secret: "your-secret-key"

# External webhook URL
# https://your-domain.com/api/webhook/doorbell_main
```

### Database Optimization

For high-traffic installations:

```yaml
# Advanced database settings
database_path: "/data/whorang.db"
database_backup_interval: 24  # hours
database_cleanup_days: 30     # keep data for 30 days
max_faces_per_visitor: 5      # limit faces stored per visitor
```

### SSL/TLS Configuration

Enable SSL for secure connections:

```yaml
ssl: true
certfile: "fullchain.pem"
keyfile: "privkey.pem"

# Place certificates in /ssl/ directory
# Access via: https://addon-ip:3001
```

## Security

### Best Practices

1. **Use SSL/TLS**: Enable SSL for production deployments
2. **Secure API Keys**: Store API keys securely in HA secrets
3. **Network Security**: Use firewall rules to restrict access
4. **Regular Updates**: Keep add-on and dependencies updated
5. **Monitor Logs**: Regularly review logs for suspicious activity

### AppArmor Security

The add-on includes a custom AppArmor profile for enhanced security:

- Restricts file system access to necessary directories
- Limits network access to required ports
- Prevents privilege escalation
- Isolates processes for better security

### Data Privacy

- **Local Processing**: Use Ollama for complete privacy
- **Data Retention**: Configure automatic cleanup of old data
- **Encryption**: Enable SSL/TLS for data in transit
- **Access Control**: Use HA authentication for web interface

## Performance Optimization

### AI Provider Optimization

#### For Speed
- **Local Ollama**: Fastest for repeated analysis
- **Gemini Flash**: Good balance of speed and accuracy
- **OpenAI GPT-4o-mini**: Fast and cost-effective

#### For Accuracy
- **OpenAI GPT-4o**: Highest accuracy
- **Claude Sonnet**: Excellent analysis quality
- **Gemini Pro**: Good accuracy with reasonable cost

#### For Cost
- **Local Ollama**: Free after initial setup
- **Gemini Flash**: Very affordable
- **OpenAI GPT-4o-mini**: Cost-effective cloud option

### System Optimization

```yaml
# Optimize for performance
ai_analysis_timeout: 15        # Reduce timeout for faster responses
face_recognition_threshold: 0.7 # Higher threshold for fewer false positives
max_upload_size: "5MB"         # Reduce if not needed
websocket_enabled: true        # Enable for real-time updates
```

### Caching Configuration

```yaml
# Enable caching for better performance
enable_model_caching: true
cache_duration: 3600          # 1 hour
max_cache_size: "100MB"
```

## Support

### Getting Help

- **GitHub Issues**: [Report bugs and feature requests](https://github.com/Beast12/whorang-addon/issues)
- **Discussions**: [Community support and questions](https://github.com/Beast12/whorang-addon/discussions)
- **Documentation**: [Complete setup guides](https://github.com/Beast12/whorang-addon/tree/main/docs)

### Contributing

We welcome contributions! Please see our [Contributing Guide](https://github.com/Beast12/whorang-addon/blob/main/CONTRIBUTING.md) for details.

### License

This project is licensed under the MIT License - see the [LICENSE](https://github.com/Beast12/whorang-addon/blob/main/LICENSE) file for details.

---

**Made with ❤️ for the Home Assistant community**

*Transform your doorbell into an intelligent AI-powered security system with WhoRang!*
