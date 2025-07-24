# WhoRang AI Doorbell

**Complete AI-powered doorbell solution with face recognition, multi-provider AI analysis, and seamless Home Assistant integration.**

[![Version](https://img.shields.io/badge/version-2.0.8-blue.svg)](https://github.com/Beast12/whorang-addon/releases)
[![Home Assistant](https://img.shields.io/badge/Home%20Assistant-Compatible-green.svg)](https://www.home-assistant.io/)
[![Docker](https://img.shields.io/badge/Docker-Supported-blue.svg)](https://hub.docker.com/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## About

WhoRang transforms your doorbell into an intelligent AI-powered security system. Get instant notifications with AI-generated descriptions of visitors, automatic face recognition, and seamless Home Assistant integration.

### Key Features

🤖 **Multi-Provider AI Analysis** - OpenAI GPT-4o, Local Ollama, Google Gemini, Claude, Google Cloud Vision  
👤 **Advanced Face Recognition** - Automatic face detection and person identification  
🏠 **Native HA Integration** - 19+ entities, custom cards, and rich automation support  
🔄 **Real-time Updates** - WebSocket-based instant notifications  
🎨 **Beautiful Interface** - Custom dashboard cards and face management tools  
🔒 **Privacy-First** - Local processing options with Ollama  
📊 **Cost Tracking** - Monitor AI usage and optimize costs  
🛡️ **Security-Focused** - SSL support, AppArmor profile, and secure API handling

## Quick Start

### 1. Install Add-on

```
Settings → Add-ons → Add-on Store → ⋮ → Repositories
Add: https://github.com/Beast12/whorang-addon
```

Find "WhoRang AI Doorbell" → Install → Configure → Start

### 2. Integration Setup

The integration appears automatically in Home Assistant:
- Go to Settings → Devices & Services
- Configure WhoRang integration
- Add your AI API keys (optional for local Ollama)

### 3. Start Using

- **Trigger Analysis**: Use `whorang.trigger_analysis` service with camera snapshots
- **View Visitors**: Check the 19+ new entities in your dashboard
- **Manage Faces**: Use custom cards for face labeling and person management
- **Create Automations**: Build smart doorbell automations with rich entity data

## What You Get

### Entities Created (19+)
- **9 Sensors**: Visitor counts, AI costs, response times, system status
- **5 Binary Sensors**: Doorbell, motion, known visitor, system online, AI processing
- **5 Controls**: Analysis triggers, AI provider/model selection, data refresh
- **1 Camera**: Latest doorbell image

### Custom Dashboard Cards
- **Face Manager**: Complete face labeling interface
- **Face Manager Simple**: Quick face management
- **Known Persons**: Person gallery with statistics

### Services Available (20+)
- Core analysis and processing services
- Face management and labeling
- Person creation and management
- AI provider configuration

## AI Provider Options

| Provider | Cost | Privacy | Accuracy | Speed |
|----------|------|---------|----------|-------|
| **Local Ollama** | Free | 🟢 Complete | Good | Fast |
| **OpenAI GPT-4o** | $$ | 🟡 Cloud | Excellent | Fast |
| **Google Gemini** | $ | 🟡 Cloud | Very Good | Very Fast |
| **Claude** | $$$ | 🟡 Cloud | Excellent | Good |
| **Google Cloud** | $$ | 🟡 Cloud | Good | Good |

## Installation Options

### Home Assistant OS/Supervised (Recommended)
- **One-click installation** via add-on store
- **Automatic integration** discovery
- **Zero configuration** required

### Home Assistant Container/Core
- **Docker deployment** with integration files
- **Manual integration** setup
- **Full feature support**

### Docker Compose
- **Standalone deployment** option
- **Custom network** configuration
- **Production-ready** setup

## Example Automation

```yaml
automation:
  - alias: "Smart Doorbell Notification"
    trigger:
      - platform: state
        entity_id: binary_sensor.whorang_doorbell
        to: "on"
    action:
      - service: notify.mobile_app
        data:
          title: "🔔 Visitor at Door"
          message: "{{ states('sensor.whorang_latest_visitor') }}"
          data:
            image: "{{ state_attr('camera.whorang_latest_image', 'entity_picture') }}"
            actions:
              - action: "LABEL_FACE"
                title: "Label Face"
```

## Documentation

📚 **[Complete Documentation](whorang/DOCS.md)** - Detailed configuration, API reference, and troubleshooting  
🚀 **[Installation Guide](docs/INSTALLATION.md)** - Step-by-step setup for all HA types  
⚙️ **[Configuration Guide](docs/CONFIGURATION.md)** - AI providers, settings, and optimization  
🎨 **[Dashboard Examples](docs/DASHBOARD_EXAMPLES.md)** - Beautiful dashboard configurations  
🔧 **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues and solutions  
📖 **[API Reference](docs/API_REFERENCE.md)** - Complete REST API documentation

## Requirements

- **Home Assistant**: 2023.1.0 or later
- **Memory**: 2GB RAM minimum (4GB recommended)
- **Storage**: 1GB free space
- **Network**: Internet connection (for cloud AI providers)

## Support

- 🐛 **[Report Issues](https://github.com/Beast12/whorang-addon/issues)** - Bug reports and feature requests
- 💬 **[Community Discussion](https://github.com/Beast12/whorang-addon/discussions)** - Questions and support
- 📖 **[Documentation](docs/)** - Complete setup guides

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Made with ❤️ for the Home Assistant community**

*Transform your doorbell into an intelligent AI-powered security system!*
