# WhoRang AI Doorbell - Complete Solution

**Complete AI-powered doorbell solution with face recognition, multi-provider AI analysis, and seamless Home Assistant integration.**

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/Beast12/whorang-addon/releases)
[![Home Assistant](https://img.shields.io/badge/Home%20Assistant-Compatible-green.svg)](https://www.home-assistant.io/)
[![Docker](https://img.shields.io/badge/Docker-Supported-blue.svg)](https://hub.docker.com/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

## 🎯 What's New in v2.0.0 - Consolidated Solution

**WhoRang is now a complete, unified solution!** This repository contains both the AI backend and Home Assistant integration in one package, making installation and maintenance dramatically simpler.

### ✨ Key Benefits of Consolidation
- **🚀 One-Click Installation**: Install addon → integration appears automatically
- **🔄 Synchronized Updates**: Backend and integration always compatible
- **📚 Unified Documentation**: Everything in one place
- **🛠️ Simplified Maintenance**: Single repository, single CI/CD pipeline

## 📋 Table of Contents

- [Features](#-features)
- [Installation](#-installation)
  - [Home Assistant OS/Supervised (Recommended)](#home-assistant-ossupervised-recommended)
  - [Home Assistant Container/Core](#home-assistant-containercore)
  - [Docker Compose](#docker-compose)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [API Reference](#-api-reference)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)

## 🌟 Features

### 🤖 Advanced AI Integration
- **Multiple AI Providers**: OpenAI GPT-4o, Local Ollama, Google Gemini, Claude, Google Cloud Vision
- **Intelligent Face Detection**: Precise coordinate handling with automatic format detection
- **Face Recognition**: Advanced embedding-based face matching
- **Smart Deduplication**: Eliminates duplicate faces across all AI providers
- **Cost Optimization**: Automatic cost tracking and budget management

### 🏠 Home Assistant Integration
- **19+ Entities**: Comprehensive sensor coverage across 6 platforms
- **Real-time Updates**: WebSocket-based instant entity updates
- **Custom Cards**: 3 beautiful dashboard cards for face management
- **Automation Ready**: Rich events and services for advanced automations
- **Zero Configuration**: Auto-discovery of addon backend

### 🎨 User Interface
- **Face Gallery**: Visual face management with thumbnails
- **Person Management**: Create and manage known persons
- **Statistics Dashboard**: Usage metrics and AI performance
- **Configuration Panel**: Easy AI provider and model selection

### 🔧 Technical Excellence
- **Production Ready**: Robust error handling and fallback mechanisms
- **Multi-Architecture**: Supports ARM64, AMD64, ARMv7
- **Security First**: SSL support, API key encryption, input validation
- **Performance Optimized**: Caching, deduplication, intelligent processing

## 🚀 Installation

### Home Assistant OS/Supervised (Recommended)

This is the easiest installation method - the integration appears automatically!

1. **Add Repository**:
   ```
   Settings → Add-ons → Add-on Store → ⋮ → Repositories
   Add: https://github.com/Beast12/whorang-addon
   ```

2. **Install Addon**:
   - Find "WhoRang AI Doorbell" in the addon store
   - Click Install
   - Configure your AI provider settings
   - Start the addon

3. **Integration Auto-Discovery**:
   - The integration automatically appears in Home Assistant
   - Go to Settings → Devices & Services
   - Configure your AI API keys (optional)
   - Enjoy your 19+ new entities!

### Home Assistant Container/Core

For Container and Core installations, use Docker with the integration files:

1. **Deploy Backend**:
   ```bash
   docker run -d \
     --name whorang-backend \
     --restart unless-stopped \
     -p 3001:3001 \
     -v $(pwd)/whorang-data:/data \
     -v $(pwd)/config/custom_components:/config/custom_components \
     -e AI_PROVIDER=local \
     -e LOG_LEVEL=info \
     ghcr.io/beast12/whorang-backend:latest
   ```

2. **Install Integration**:
   - The integration files are automatically copied to `/config/custom_components/`
   - Restart Home Assistant
   - Add the WhoRang integration via Settings → Devices & Services

### Docker Compose

```yaml
version: '3.8'
services:
  whorang:
    image: ghcr.io/beast12/whorang-backend:latest
    container_name: whorang-backend
    restart: unless-stopped
    ports:
      - "3001:3001"
    volumes:
      - ./whorang-data:/data
      - ./config/custom_components:/config/custom_components
    environment:
      - AI_PROVIDER=local
      - LOG_LEVEL=info
      - DATABASE_PATH=/data/whorang.db
      - UPLOADS_PATH=/data/uploads

  homeassistant:
    image: homeassistant/home-assistant:stable
    container_name: homeassistant
    restart: unless-stopped
    volumes:
      - ./config:/config
      - ./config/custom_components:/config/custom_components:ro
    depends_on:
      - whorang
    ports:
      - "8123:8123"
```

## ⚙️ Configuration

### AI Provider Setup

Configure your preferred AI providers through the Home Assistant integration options:

#### OpenAI (Recommended for accuracy)
```yaml
# Get API key from: https://platform.openai.com/api-keys
openai_api_key: "sk-..."
```

#### Local Ollama (Free, private)
```yaml
# Install Ollama and pull a vision model:
# ollama pull llava-phi3
ollama_host: "localhost"  # or IP address
ollama_port: 11434
```

#### Google Gemini (Fast and affordable)
```yaml
# Get API key from: https://aistudio.google.com/app/apikey
gemini_api_key: "AIza..."
```

### Integration Configuration

The integration provides comprehensive configuration options:

- **Update Interval**: How often to poll for updates (10-300 seconds)
- **WebSocket**: Enable real-time updates (recommended)
- **Cost Tracking**: Monitor AI usage and costs
- **AI Templates**: Choose response style (professional, friendly, sarcastic, detailed)

## 📊 Usage

### Entities Created

WhoRang creates 19+ entities across 6 platforms:

#### Sensors (9 entities)
- `sensor.whorang_latest_visitor` - Latest visitor analysis
- `sensor.whorang_visitor_count_today` - Daily visitor count
- `sensor.whorang_visitor_count_week` - Weekly visitor count
- `sensor.whorang_visitor_count_month` - Monthly visitor count
- `sensor.whorang_ai_response_time` - AI processing time
- `sensor.whorang_ai_cost_today` - Daily AI costs
- `sensor.whorang_ai_cost_month` - Monthly AI costs
- `sensor.whorang_system_status` - System health
- `sensor.whorang_last_analysis_time` - Last analysis timestamp

#### Binary Sensors (5 entities)
- `binary_sensor.whorang_doorbell` - Doorbell ring detection
- `binary_sensor.whorang_motion` - Motion detection
- `binary_sensor.whorang_known_visitor` - Known visitor presence
- `binary_sensor.whorang_system_online` - System connectivity
- `binary_sensor.whorang_ai_processing` - AI processing status

#### Controls (5 entities)
- `button.whorang_trigger_analysis` - Manual analysis trigger
- `button.whorang_refresh_data` - Refresh all data
- `button.whorang_test_webhook` - Test webhook connectivity
- `select.whorang_ai_provider` - AI provider selection
- `select.whorang_ai_model` - AI model selection

#### Camera (1 entity)
- `camera.whorang_latest_image` - Latest doorbell image

### Services Available

WhoRang provides 20+ services for automation:

#### Core Services
- `whorang.trigger_analysis` - Trigger AI analysis
- `whorang.process_doorbell_event` - Process complete doorbell event
- `whorang.set_ai_provider` - Change AI provider
- `whorang.set_ai_model` - Change AI model

#### Face Management
- `whorang.label_face` - Label a face with person name
- `whorang.batch_label_faces` - Label multiple faces
- `whorang.create_person_from_face` - Create new person
- `whorang.get_unknown_faces` - Get faces needing labels
- `whorang.delete_face` - Remove a face

### Custom Dashboard Cards

Three beautiful cards for your dashboard:

1. **Face Manager Card** - Complete face labeling interface
2. **Face Manager Simple Card** - Streamlined face management
3. **Known Persons Card** - Person gallery with avatars

## 📚 API Reference

### REST API Endpoints

The backend provides a comprehensive REST API:

#### Analysis
- `POST /api/analyze` - Analyze doorbell image
- `GET /api/stats` - Get visitor statistics
- `GET /api/visitors` - List visitors with pagination

#### Face Management
- `GET /api/faces/gallery` - Get face gallery data
- `POST /api/faces/{id}/label` - Label a face
- `DELETE /api/faces/{id}` - Delete a face
- `GET /api/faces/persons` - List known persons

#### Configuration
- `GET /api/config` - Get system configuration
- `POST /api/config` - Update configuration
- `GET /api/models` - Get available AI models

#### AI Providers
- `GET /api/openai/models` - Get OpenAI models
- `POST /api/openai/provider` - Set AI provider
- `GET /api/ai/usage` - Get usage statistics

### WebSocket Events

Real-time updates via WebSocket:

- `visitor_update` - New visitor detected
- `face_detection_complete` - Face processing finished
- `system_status` - System health changes
- `ai_analysis_complete` - AI analysis finished

## 🔧 Troubleshooting

### Common Issues

#### Integration Not Appearing
```bash
# Check if addon is running
docker ps | grep whorang

# Check Home Assistant logs
tail -f /config/home-assistant.log | grep whorang

# Verify integration files
ls -la /config/custom_components/whorang/
```

#### Face Detection Not Working
1. **Check AI Provider**: Ensure API keys are valid
2. **Verify Image Access**: Check image URLs are accessible
3. **Review Logs**: Look for coordinate format issues
4. **Test Manually**: Use the trigger analysis button

#### Performance Issues
1. **Optimize AI Provider**: Local Ollama for speed, OpenAI for accuracy
2. **Adjust Update Interval**: Increase to reduce API calls
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

### Support Channels

- **GitHub Issues**: [Report bugs and feature requests](https://github.com/Beast12/whorang-addon/issues)
- **Discussions**: [Community support and questions](https://github.com/Beast12/whorang-addon/discussions)
- **Documentation**: [Complete setup guides](docs/)

## 📚 Complete Documentation

### **Getting Started**
- **[Installation Guide](docs/INSTALLATION.md)** - Complete installation for all Home Assistant types
- **[Configuration Guide](docs/CONFIGURATION.md)** - AI providers, settings, and optimization
- **[Dashboard Examples](docs/DASHBOARD_EXAMPLES.md)** - Beautiful dashboard configurations

### **User Guides**
- **[Troubleshooting Guide](docs/TROUBLESHOOTING.md)** - Common issues and solutions
- **[API Reference](docs/API_REFERENCE.md)** - Complete REST API documentation
- **[Face Management](docs/Face_detection.md)** - Face detection and recognition system

### **Technical Documentation**
- **[Gemini Duplicate Detection](docs/gemini_dups.md)** - Gemini AI provider optimization
- **[Image URL Configuration](docs/HOME_ASSISTANT_IMAGE_URL_CONFIGURATION.md)** - Image loading setup

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

1. **Clone Repository**:
   ```bash
   git clone https://github.com/Beast12/whorang-addon.git
   cd whorang-addon
   ```

2. **Install Dependencies**:
   ```bash
   cd whorang
   npm install
   ```

3. **Run Development Server**:
   ```bash
   npm run dev
   ```

4. **Test Integration**:
   ```bash
   # Copy integration to HA config
   cp -r custom_components/whorang /config/custom_components/
   ```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Home Assistant Community** - For the amazing platform and support
- **AI Providers** - OpenAI, Google, Anthropic, and Ollama teams
- **Contributors** - Everyone who helped make this project better
- **Users** - For feedback, bug reports, and feature requests

---

**Made with ❤️ for the Home Assistant community**

*Transform your doorbell into an intelligent AI-powered security system with WhoRang!*
