# 🏠 WhoRang Home Assistant Integration v1.0.0

**Complete Home Assistant Integration for WhoRang AI Doorbell System**

---

## 🚀 Installation

### Via HACS (Recommended)
1. Open HACS in Home Assistant
2. Go to "Integrations"
3. Click the three dots in the top right corner
4. Select "Custom repositories"
5. Add `https://github.com/Beast12/whorang-integration` as an Integration
6. Search for "WhoRang" and install

### Manual Installation
1. Download the `whorang-integration-1.0.0.zip` file from this release
2. Extract to your `custom_components` directory
3. Restart Home Assistant
4. Add the integration via Settings → Devices & Services

---

## ✨ Features

### 🏠 Home Assistant Native Integration
- **19+ Sensors & Binary Sensors**: Comprehensive monitoring entities
- **Custom Lovelace Cards**: Face management and gallery interfaces
- **Real-time Updates**: WebSocket integration for live data
- **Service Calls**: Complete automation support
- **HACS Compatible**: Easy installation and updates

### 👤 Face Management
- **Interactive Face Gallery**: Visual person management interface
- **Face Labeling Interface**: Easy person identification workflow
- **Person CRUD Operations**: Complete person management system
- **Avatar Generation**: Automatic person avatars from best face crops
- **Batch Operations**: Efficient face processing and labeling

### 📊 Monitoring & Analytics
- **AI Cost Tracking**: Real-time usage monitoring across all providers
- **Performance Metrics**: System health and statistics
- **Analysis Status**: Live processing updates and status
- **Provider Switching**: Dynamic AI provider selection
- **Model Management**: AI model configuration and switching

### 🎯 Automation Support
- **Rich Events**: Comprehensive event system for automations
- **Service Integration**: Full Home Assistant service support
- **Webhook Processing**: Doorbell event automation
- **Weather Integration**: Contextual analysis data
- **Custom Triggers**: Advanced automation capabilities

---

## 🔧 Configuration

After installation, add the integration via:
**Settings → Devices & Services → Add Integration → WhoRang**

### Required Configuration
- **Host**: WhoRang backend server IP/hostname
- **Port**: Backend server port (default: 3001)
- **API Key**: Optional authentication key

### Optional Configuration
- **Update Interval**: Data refresh frequency (default: 30 seconds)
- **WebSocket**: Enable real-time updates (recommended)
- **Cost Tracking**: Monitor AI usage costs
- **Ollama Integration**: Local AI processing configuration

---

## 📊 Available Entities

### Sensors
- `sensor.whorang_known_persons` - Count of known persons
- `sensor.whorang_unknown_faces` - Count of unidentified faces
- `sensor.whorang_total_faces` - Total faces in database
- `sensor.whorang_ai_cost_today` - Daily AI usage cost
- `sensor.whorang_ai_cost_month` - Monthly AI usage cost
- `sensor.whorang_analysis_count` - Number of analyses performed
- `sensor.whorang_current_ai_provider` - Active AI provider
- `sensor.whorang_current_ai_model` - Active AI model
- `sensor.whorang_last_analysis` - Last analysis timestamp
- `sensor.whorang_system_status` - Overall system status

### Binary Sensors
- `binary_sensor.whorang_system_online` - System connectivity
- `binary_sensor.whorang_ai_provider_available` - AI provider status
- `binary_sensor.whorang_websocket_connected` - WebSocket connection
- `binary_sensor.whorang_analysis_in_progress` - Active analysis status
- `binary_sensor.whorang_new_unknown_face` - New unknown face detected

### Buttons
- `button.whorang_trigger_analysis` - Manual analysis trigger
- `button.whorang_refresh_data` - Force data refresh
- `button.whorang_test_connection` - Test backend connection

### Select Entities
- `select.whorang_ai_provider` - Choose AI provider
- `select.whorang_ai_model` - Choose AI model

### Switch Entities
- `switch.whorang_cost_tracking` - Enable/disable cost tracking
- `switch.whorang_websocket` - Enable/disable WebSocket updates

---

## 🎨 Custom Lovelace Cards

This integration includes custom Lovelace cards for enhanced face management:

### WhoRang Known Persons Card
```yaml
type: custom:whorang-known-persons-card
entity: sensor.whorang_known_persons
title: "Known Persons"
show_avatars: true
max_persons: 10
columns: 3
show_face_count: true
```

### WhoRang Face Manager Card
```yaml
type: custom:whorang-face-manager
entity: sensor.whorang_unknown_faces
title: "Face Management"
show_similarity: true
batch_mode: true
quality_threshold: 0.7
```

### WhoRang Face Manager Simple
```yaml
type: custom:whorang-face-manager-simple
entity: sensor.whorang_unknown_faces
title: "Quick Face Labeling"
auto_refresh: true
```

---

## 🔧 Service Calls

### Face Management Services
```yaml
# Label a face with a person name
service: whorang.label_face
data:
  face_id: 123
  person_name: "John Doe"

# Batch label multiple faces
service: whorang.batch_label_faces
data:
  face_ids: [123, 124, 125]
  person_name: "Jane Smith"
  create_person: true

# Create person from face
service: whorang.create_person_from_face
data:
  face_id: 126
  person_name: "Bob Wilson"
  description: "Neighbor"
```

### Analysis Services
```yaml
# Trigger manual analysis
service: whorang.trigger_analysis
data:
  visitor_id: "latest"

# Process doorbell event
service: whorang.process_doorbell_event
data:
  image_url: "http://camera.local/snapshot.jpg"
  ai_message: "Person detected at front door"
  weather_temp: "{{ states('sensor.temperature') }}"
  weather_condition: "{{ states('weather.home') }}"
```

### AI Provider Services
```yaml
# Set AI provider
service: whorang.set_ai_provider
data:
  provider: "openai"

# Set AI model
service: whorang.set_ai_model
data:
  model: "gpt-4o"

# Get available models
service: whorang.get_available_models
data:
  provider: "local"
```

---

## 🤖 Automation Examples

### Doorbell Face Detection Automation
```yaml
automation:
  - alias: "Process Doorbell Ring"
    trigger:
      - platform: state
        entity_id: binary_sensor.doorbell
        to: "on"
    action:
      - service: whorang.process_doorbell_event
        data:
          image_url: "{{ states.camera.doorbell.attributes.entity_picture }}"
          ai_message: "Doorbell pressed"
          weather_temp: "{{ states('sensor.outdoor_temperature') }}"
          weather_condition: "{{ states('weather.home') }}"
```

### Unknown Face Alert
```yaml
automation:
  - alias: "Unknown Face Detected"
    trigger:
      - platform: event
        event_type: whorang_unknown_face_detected
    action:
      - service: notify.mobile_app
        data:
          title: "Unknown Person at Door"
          message: "{{ trigger.event.data.unknown_faces_count }} unknown faces detected"
          data:
            image: "{{ trigger.event.data.faces[0].image_url }}"
```

### Daily Cost Report
```yaml
automation:
  - alias: "Daily AI Cost Report"
    trigger:
      - platform: time
        at: "23:59:00"
    action:
      - service: notify.family
        data:
          title: "Daily AI Usage Report"
          message: "Today's AI cost: ${{ states('sensor.whorang_ai_cost_today') }}"
```

---

## 📚 Documentation

- **[Installation Guide](https://github.com/Beast12/whorang-integration/blob/main/docs/installation/hacs-installation.md)**: Detailed setup instructions
- **[Configuration Guide](https://github.com/Beast12/whorang-integration/blob/main/docs/configuration/initial-setup.md)**: Complete configuration options
- **[Dashboard Examples](https://github.com/Beast12/whorang-integration/blob/main/docs/usage/dashboard-examples.md)**: Lovelace card configurations
- **[Face Management Guide](https://github.com/Beast12/whorang-integration/blob/main/docs/usage/face-management-guide.md)**: Person and face management
- **[Automation Examples](https://github.com/Beast12/whorang-integration/blob/main/docs/automation/basic-automations.md)**: Home Assistant automations
- **[Troubleshooting Guide](https://github.com/Beast12/whorang-integration/blob/main/docs/troubleshooting/common-issues.md)**: Common issues and solutions

---

## 🔗 Related Projects

- **[WhoRang Backend](https://github.com/Beast12/whorang-addon)**: AI processing backend system
- **[Docker Images](https://ghcr.io/beast12/whorang-backend)**: Ready-to-use containers
- **[Complete Documentation](https://github.com/Beast12/whorang-integration/tree/main/docs)**: Comprehensive guides and examples

---

## 🛠️ Requirements

### Backend Requirements
- **WhoRang Backend**: v1.0.0 or later
- **Network Access**: Home Assistant must reach WhoRang backend
- **API Endpoint**: Backend accessible on configured port (default: 3001)

### Home Assistant Requirements
- **Home Assistant**: 2023.1.0 or later
- **HACS**: For easy installation and updates
- **Custom Cards**: Manual registration required for Lovelace cards

---

## 🐛 Issues & Support

- **[Report Issues](https://github.com/Beast12/whorang-integration/issues)**: Bug reports and feature requests
- **[Community Discussions](https://github.com/Beast12/whorang-integration/discussions)**: Community support and questions
- **[HACS Support](https://hacs.xyz/)**: Home Assistant Community Store documentation

---

## 📋 What's New in v1.0.0

### 🎉 Initial Release Features
- Complete Home Assistant integration with 19+ entities
- Custom Lovelace cards for face management
- Comprehensive service calls for automation
- Real-time WebSocket updates
- AI cost tracking and analytics
- HACS compatibility and validation
- Extensive documentation and examples

### 🔧 Technical Improvements
- Robust error handling and logging
- Efficient data synchronization
- Configurable update intervals
- WebSocket reconnection logic
- Comprehensive entity state management

### 📚 Documentation & Examples
- Complete installation and configuration guides
- Dashboard configuration examples
- Automation templates and examples
- Troubleshooting guides
- API reference documentation

---

## 🙏 Acknowledgments

Special thanks to the Home Assistant community and HACS for making custom integrations accessible to everyone. This integration builds upon the excellent foundation provided by the Home Assistant development team.

---

**Transform your doorbell into an intelligent AI-powered security system with seamless Home Assistant integration!**

🏠 **Easy Installation** • 🤖 **AI-Powered** • 📊 **Comprehensive Monitoring** • 🎯 **Automation Ready**
