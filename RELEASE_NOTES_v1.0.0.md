# 🎉 WhoRang AI Doorbell Backend System v1.0.0

**First Official Release - Complete AI-Powered Doorbell Face Recognition System**

---

## 🚀 What is WhoRang?

WhoRang is a powerful, self-hosted AI doorbell system that brings advanced face recognition capabilities to your home security setup. This backend system processes doorbell images using multiple AI providers, identifies known persons, and integrates seamlessly with Home Assistant for comprehensive smart home automation.

---

## ✨ Key Features

### 🤖 Multi-Provider AI Analysis
- **OpenAI GPT-4o Vision**: Industry-leading face recognition with detailed analysis
- **Local Ollama Support**: Privacy-focused, offline processing with vision-capable models
- **Google Gemini Pro Vision**: Advanced AI analysis with contextual understanding
- **Claude Vision**: Anthropic's powerful vision model for detailed face analysis
- **Google Cloud Vision**: Enterprise-grade face detection and analysis
- **Dynamic Model Discovery**: Automatic detection and configuration of available AI models

### 👤 Advanced Face Recognition Pipeline
- **Intelligent Face Detection**: Automatic face detection in doorbell images
- **Smart Face Cropping**: Advanced cropping with coordinate format detection (normalized vs percentage)
- **Face Deduplication**: IoU-based overlap detection to prevent duplicate processing
- **Person Management**: Complete CRUD operations for known persons with avatar generation
- **Face Quality Assessment**: Confidence scoring and quality thresholds
- **Similarity Matching**: Find similar faces across your database

### 🏠 Home Assistant Integration Ready
- **Webhook Processing**: Complete webhook pipeline for doorbell events
- **Real-time Updates**: WebSocket integration for instant notifications
- **Weather Integration**: Contextual analysis with weather data
- **Event Broadcasting**: Fire Home Assistant events for automation triggers
- **Service Calls**: Comprehensive service integration for manual operations

### 📊 Comprehensive Analytics & Monitoring
- **Cost Tracking**: Real-time monitoring of AI provider usage and costs
- **Performance Metrics**: Response time tracking and success/failure rates
- **Usage Statistics**: Detailed analytics across all AI providers
- **Budget Management**: Cost alerts and usage optimization
- **Health Monitoring**: System status and connectivity checks

---

## 🔧 Technical Specifications

### Backend Architecture
- **Framework**: Node.js with Express.js
- **Database**: SQLite with comprehensive face recognition schema
- **Image Processing**: Sharp library for high-performance face cropping
- **Real-time Communication**: WebSocket support for live updates
- **API Design**: RESTful architecture with 20+ documented endpoints

### AI Provider Support
- **OpenAI**: GPT-4o, GPT-4-vision-preview
- **Ollama**: llava, llava-phi3, bakllava, and other vision models
- **Google**: Gemini Pro Vision, Cloud Vision API
- **Anthropic**: Claude 3 Vision models
- **Flexible Configuration**: Easy switching between providers

### Deployment Options
- **Docker**: Multi-architecture support (amd64, arm64, armv7)
- **Docker Compose**: Complete stack with nginx reverse proxy
- **Standalone**: Direct Node.js deployment
- **SSL/TLS**: Built-in HTTPS support with certificate management

---

## 🎯 Core Capabilities

### Face Processing Pipeline
1. **Image Reception**: Webhook or API endpoint receives doorbell images
2. **Face Detection**: Automatic detection of faces in images
3. **Coordinate Processing**: Intelligent handling of different coordinate formats
4. **Face Cropping**: High-quality face extraction using Sharp
5. **AI Analysis**: Multi-provider analysis with fallback support
6. **Person Matching**: Compare against known persons database
7. **Result Processing**: Generate notifications and update database

### Person Management
- **Avatar Generation**: Automatic avatar creation from best face crops
- **Person Profiles**: Name, description, and metadata management
- **Face Association**: Link multiple face crops to single persons
- **Merge Functionality**: Combine duplicate person entries
- **Bulk Operations**: Batch processing for efficiency

### API Endpoints
- **Face Management**: CRUD operations for faces and persons
- **AI Configuration**: Provider and model management
- **Analysis Triggers**: Manual and automated analysis
- **Statistics**: Usage and performance metrics
- **Health Checks**: System status and connectivity
- **Data Export**: Backup and migration support

---

## 🛠️ Installation & Setup

### Quick Start with Docker
```bash
# Pull the image
docker pull ghcr.io/beast12/whorang-backend:v1.0.0

# Run with basic configuration
docker run -d --name whorang-backend \
  -p 3001:3001 \
  -v ./whorang-data:/data \
  -e AI_PROVIDER=local \
  -e LOG_LEVEL=info \
  ghcr.io/beast12/whorang-backend:v1.0.0
```

### Docker Compose (Recommended)
```yaml
version: '3.8'
services:
  whorang:
    image: ghcr.io/beast12/whorang-backend:v1.0.0
    ports:
      - "3001:3001"
    volumes:
      - ./whorang-data:/data
    environment:
      - AI_PROVIDER=local
      - LOG_LEVEL=info
    restart: unless-stopped
```

### Configuration
The system supports extensive configuration through environment variables and config files:
- **AI Provider Settings**: API keys, endpoints, model selection
- **Database Configuration**: SQLite path and optimization settings
- **Logging**: Configurable log levels and output formats
- **Security**: Authentication, rate limiting, CORS settings
- **Performance**: Caching, connection pooling, timeout settings

---

## 📚 Documentation

### Comprehensive Guides
- **[Installation Guide](docs/installation.md)**: Step-by-step setup instructions
- **[API Reference](docs/API_REFERENCE.md)**: Complete API documentation
- **[Configuration Options](docs/configuration.md)**: All configuration parameters
- **[Face Detection Guide](docs/Face_detection.md)**: Face processing pipeline details
- **[Troubleshooting](docs/troubleshooting.md)**: Common issues and solutions

### Integration Examples
- **Home Assistant**: Webhook configuration and automation examples
- **Frigate**: Integration with Frigate NVR for doorbell events
- **Node-RED**: Flow examples for advanced automation
- **API Clients**: Sample code for custom integrations

---

## 🔒 Security & Privacy

### Privacy-First Design
- **Local Processing**: Full offline operation with Ollama
- **Data Control**: All data stored locally in your environment
- **No Cloud Dependencies**: Optional cloud AI providers
- **Secure Communication**: HTTPS/TLS encryption support
- **Access Control**: API key authentication and rate limiting

### Security Features
- **Input Validation**: Comprehensive request validation
- **SQL Injection Protection**: Parameterized queries
- **File Upload Security**: Safe image processing
- **Error Handling**: Secure error responses
- **Audit Logging**: Comprehensive activity logging

---

## 🚀 Performance & Scalability

### Optimized Processing
- **Efficient Face Cropping**: Sharp-based image processing
- **Smart Caching**: Intelligent caching of AI responses
- **Connection Pooling**: Optimized database connections
- **Async Processing**: Non-blocking operation design
- **Resource Management**: Memory and CPU optimization

### Scalability Features
- **Horizontal Scaling**: Multiple instance support
- **Load Balancing**: nginx reverse proxy included
- **Database Optimization**: Indexed queries and efficient schema
- **Monitoring**: Built-in health checks and metrics
- **Graceful Degradation**: Fallback mechanisms for reliability

---

## 🎨 Integration Ecosystem

### Home Assistant
- **Custom Integration**: Dedicated Home Assistant component available
- **19+ Sensors**: Comprehensive monitoring entities
- **Custom Cards**: Lovelace cards for face management
- **Automation Support**: Rich event system for automations
- **HACS Compatible**: Easy installation through HACS

### Third-Party Compatibility
- **Frigate**: Direct integration with Frigate NVR
- **Blue Iris**: Webhook support for Blue Iris
- **Generic Webhooks**: Standard webhook format support
- **MQTT**: Optional MQTT integration
- **REST APIs**: Standard REST API for any client

---

## 📈 What's Next?

### Planned Features
- **Mobile App**: Dedicated mobile application
- **Advanced Analytics**: Machine learning insights
- **Cloud Sync**: Optional cloud backup and sync
- **Multi-Camera**: Support for multiple doorbell cameras
- **Enhanced AI**: Additional AI provider integrations

### Community
- **GitHub**: Open source development and contributions
- **Documentation**: Continuously updated guides and examples
- **Support**: Community support and issue tracking
- **Feature Requests**: Community-driven feature development

---

## 🏆 Why Choose WhoRang?

### ✅ **Complete Solution**
Full-featured AI doorbell system with everything you need out of the box

### ✅ **Privacy-Focused**
Local processing options ensure your data stays private

### ✅ **Highly Configurable**
Extensive configuration options for any setup

### ✅ **Production-Ready**
Robust, tested, and optimized for real-world deployment

### ✅ **Open Source**
Transparent, auditable, and community-driven development

### ✅ **Future-Proof**
Modular architecture supports easy updates and new features

---

## 🔗 Links & Resources

- **🏠 Home Assistant Integration**: [whorang-integration](https://github.com/Beast12/whorang-integration)
- **📖 Documentation**: [Full Documentation](https://github.com/Beast12/whorang-addon/tree/main/docs)
- **🐛 Issues**: [Report Issues](https://github.com/Beast12/whorang-addon/issues)
- **💬 Discussions**: [Community Discussions](https://github.com/Beast12/whorang-addon/discussions)
- **📦 Docker Hub**: [Container Images](https://ghcr.io/beast12/whorang-backend)

---

## 🙏 Acknowledgments

Special thanks to the Home Assistant community, the open-source AI community, and all contributors who made this project possible.

---

**Ready to transform your doorbell into an intelligent AI-powered security system? Get started with WhoRang v1.0.0 today!**
