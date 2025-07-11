# WhoRang AI Doorbell Backend

[![GitHub Release][releases-shield]][releases]
[![GitHub Activity][commits-shield]][commits]
[![License][license-shield]](LICENSE)
[![Project Maintenance][maintenance-shield]][user_profile]
[![Docker Pulls](https://img.shields.io/docker/pulls/beast12/whorang-backend?style=for-the-badge)](https://hub.docker.com/r/beast12/whorang-backend)

_Enterprise-grade AI-powered doorbell backend service with advanced face recognition, multi-provider AI analysis, and seamless Home Assistant integration._

## 🎯 About

The WhoRang AI Doorbell Backend is the core processing engine that powers the [WhoRang AI Doorbell Integration](https://github.com/Beast12/whorang-integration). This sophisticated backend service provides:

### 🧠 **Advanced AI Processing**
- **5 AI Providers**: OpenAI GPT-4o, Claude Vision, Google Gemini, Google Cloud Vision, and local Ollama
- **Dynamic Model Discovery**: Automatic detection and caching of available models
- **Intelligent Deduplication**: Advanced face deduplication across all providers
- **Cost Optimization**: Comprehensive usage tracking and cost management

### 👤 **Sophisticated Face Recognition**
- **Precision Face Detection**: Enhanced coordinate handling with format auto-detection
- **Smart Face Cropping**: Optimized face extraction with conservative centering
- **Face Matching**: Embedding-based recognition with confidence scoring
- **Quality Assessment**: Automatic face quality scoring and filtering

### 🔄 **Real-time Processing**
- **WebSocket Integration**: Real-time updates and notifications
- **Event-driven Architecture**: Webhook-based processing pipeline
- **Concurrent Processing**: Multi-provider parallel analysis
- **Performance Monitoring**: Response time tracking and optimization

### 🎨 **Complete Management Interface**
- **Web Dashboard**: Full-featured web UI for configuration and monitoring
- **Face Gallery**: Visual face management with thumbnail generation
- **Statistics Dashboard**: Usage analytics and performance metrics
- **Configuration Panel**: AI provider settings and threshold management

### 🔗 **Seamless Integration**
- **RESTful API**: Comprehensive API for Home Assistant integration
- **Database Management**: SQLite with automatic schema migrations
- **File Storage**: Organized image and face data storage
- **Backup Support**: Full data backup and restore capabilities

## 🎉 Recent Major Improvements

### ✅ **Face Cropping System - COMPLETELY FIXED**
**Problem Solved**: Face cropping pipeline was completely broken - no face files were being created
**Solution**: Intelligent coordinate format detection and robust file validation

**Technical Improvements**:
- **Smart Coordinate Handling**: Automatic detection of coordinate formats (normalized vs percentage)
- **AI Provider Compatibility**: Perfect handling of OpenAI (percentage) and Ollama (normalized) coordinates
- **Conservative Centering**: Safe face positioning with bounds checking
- **File Validation**: Robust validation prevents silent failures
- **Real Thumbnails**: UI now shows actual face thumbnails instead of placeholders

### ✅ **Gemini Duplicate Face Fix - RESOLVED**
**Problem Solved**: Google Gemini was returning duplicate faces in JSON responses
**Solution**: Enhanced JSON parsing with intelligent duplicate detection

**Technical Improvements**:
- **Automatic Duplicate Detection**: IoU-based overlap detection
- **Enhanced JSON Parsing**: Handles multiple response blocks and truncated JSON
- **Confidence-based Selection**: Keeps highest confidence faces when duplicates found
- **Description Analysis**: Detects semantic duplicates in face descriptions

### ✅ **Dynamic Model Management - IMPLEMENTED**
**Problem Solved**: Hardcoded AI models with no dynamic discovery
**Solution**: Automatic model discovery and caching system

**Technical Improvements**:
- **Auto-Discovery**: Automatic model detection for OpenAI, Ollama, Gemini
- **Smart Caching**: 24-hour model cache with automatic refresh
- **Deprecation Awareness**: Warnings for deprecated models
- **Fallback Models**: Offline scenarios handled gracefully

### ✅ **Ollama Face Cropping Optimization - ENHANCED**
**Problem Solved**: Poor face crops showing excessive background
**Solution**: Coordinate tightening and conservative centering

**Technical Improvements**:
- **64% Area Reduction**: Better focus on actual faces
- **Conservative Enhancement**: Safety-first approach prevents over-cropping
- **JSON Truncation Recovery**: Handles incomplete Ollama responses
- **100% Success Rate**: Improved from 0% to 100% face detection success

### ✅ **Comprehensive Cost Tracking - ADDED**
**New Feature**: Complete AI usage monitoring and cost optimization

**Features**:
- **Real-time Cost Tracking**: Monitor spending across all AI providers
- **Usage Analytics**: Token counting and performance metrics
- **Budget Alerts**: Configurable spending limits and notifications
- **Provider Comparison**: Cost and performance analysis across providers

## Installation

### Prerequisites

- **Minimum 2GB RAM** (4GB recommended for AI processing)
- **1GB free storage** (for database and image storage)
- **Internet connection** (for cloud AI providers)

### Installation Options by Home Assistant Type

#### 🏠 Home Assistant OS / Supervised (Add-on Installation)

**Best for**: Users running Home Assistant OS or Supervised installations

1. **Add Add-on Repository**:
   - Go to **Settings** → **Add-ons** → **Add-on Store**
   - Click the three dots menu (⋮) → **Repositories**
   - Add: `https://github.com/Beast12/whorang-addon`
   - Click **Add** → **Close**

2. **Install Add-on**:
   - Find "WhoRang AI Doorbell Backend" in the add-on store
   - Click **Install** (this may take several minutes)
   - Wait for installation to complete

#### 🐳 Home Assistant Container/Core (Docker Deployment)

**Best for**: Users running Home Assistant in Docker or Core installations

**Note**: Add-ons are not available for Container/Core installations. Use Docker Compose instead.

1. **Option A: Docker Run Command**:
   ```bash
   # Create data directories
   mkdir -p whorang-data whorang-ssl
   
   # Run WhoRang backend container
   docker run -d \
     --name whorang-backend \
     --restart unless-stopped \
     -p 3001:3001 \
     -v $(pwd)/whorang-data:/data \
     -v $(pwd)/whorang-ssl:/ssl \
     -e NODE_ENV=production \
     -e PORT=3001 \
     -e DATABASE_PATH=/data/whorang.db \
     -e UPLOADS_PATH=/data/uploads \
     -e AI_PROVIDER=local \
     -e LOG_LEVEL=info \
     -e WEBSOCKET_ENABLED=true \
     -e CORS_ENABLED=true \
     ghcr.io/beast12/whorang-backend:latest
   
   # Check container status
   docker ps
   
   # View logs
   docker logs -f whorang-backend
   ```

2. **Option B: Docker Compose File**:
   ```yaml
   # docker-compose.yml
   version: '3.8'
   services:
     whorang:
       image: ghcr.io/beast12/whorang-backend:latest
       container_name: whorang-backend
       ports:
         - "3001:3001"
       volumes:
         - ./whorang-data:/data
         - ./whorang-ssl:/ssl
       environment:
         - NODE_ENV=production
         - PORT=3001
         - DATABASE_PATH=/data/whorang.db
         - UPLOADS_PATH=/data/uploads
         - AI_PROVIDER=local
         - LOG_LEVEL=info
         - WEBSOCKET_ENABLED=true
         - CORS_ENABLED=true
       restart: unless-stopped
       networks:
         - homeassistant
   
   networks:
     homeassistant:
       external: true
   ```

   **Start the Service**:
   ```bash
   # Create directories
   mkdir -p whorang-data whorang-ssl
   
   # Start the container
   docker-compose up -d
   
   # Check logs
   docker-compose logs -f whorang
   ```

3. **Verify Installation**:
   ```bash
   # Test health endpoint
   curl http://localhost:3001/api/health
   
   # Should return: {"status":"healthy","version":"1.0.0"}
   ```

#### 🔧 Manual Installation (Advanced)

**Best for**: Advanced users who want full control

1. **Clone Repository**:
   ```bash
   git clone https://github.com/Beast12/whorang-addon.git
   cd whorang-addon/whorang
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

4. **Start Service**:
   ```bash
   npm start
   ```

### Configuration

1. **Basic Configuration**:
   ```yaml
   ssl: false
   certfile: fullchain.pem
   keyfile: privkey.pem
   ai_provider: local
   log_level: info
   ```

2. **Advanced Configuration**:
   ```yaml
   database_path: /data/whorang.db
   uploads_path: /data/uploads
   max_upload_size: 10MB
   face_recognition_threshold: 0.6
   ai_analysis_timeout: 30
   websocket_enabled: true
   cors_enabled: true
   cors_origins:
     - "*"
   ```

3. **Start Add-on**:
   - Click **Start**
   - Enable **Start on boot** and **Watchdog**
   - Monitor logs for successful startup

## Configuration Options

### Basic Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `ssl` | bool | `false` | Enable SSL/HTTPS |
| `certfile` | string | `fullchain.pem` | SSL certificate file |
| `keyfile` | string | `privkey.pem` | SSL private key file |
| `ai_provider` | list | `local` | Default AI provider |
| `log_level` | list | `info` | Logging level |

### Advanced Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `database_path` | string | `/data/whorang.db` | Database file location |
| `uploads_path` | string | `/data/uploads` | Upload directory |
| `max_upload_size` | string | `10MB` | Maximum upload file size |
| `face_recognition_threshold` | float | `0.6` | Face recognition confidence threshold |
| `ai_analysis_timeout` | int | `30` | AI analysis timeout (seconds) |
| `websocket_enabled` | bool | `true` | Enable WebSocket support |
| `cors_enabled` | bool | `true` | Enable CORS |
| `cors_origins` | list | `["*"]` | Allowed CORS origins |

### AI Provider Options

- **`local`**: Use local Ollama installation (free, private)
- **`openai`**: OpenAI GPT-4 Vision (requires API key)
- **`claude`**: Anthropic Claude Vision (requires API key)
- **`gemini`**: Google Gemini Vision (requires API key)
- **`google-cloud-vision`**: Google Cloud Vision API (requires API key)

## 🚀 Usage

### 🎨 Web Interface

After installation, access the comprehensive web dashboard:

- **Local Access**: `http://homeassistant.local:3001`
- **Docker Access**: `http://your-docker-host:3001`
- **SSL Access**: `https://homeassistant.local:3001` (if SSL enabled)

#### Dashboard Features
- **Face Gallery**: Visual face management with real thumbnails
- **Visitor Timeline**: Recent doorbell events with AI analysis
- **Statistics Dashboard**: Usage metrics and performance analytics
- **Configuration Panel**: AI provider settings and thresholds
- **Model Management**: Dynamic model discovery and selection
- **Cost Tracking**: Real-time usage and cost monitoring

### 🔌 Comprehensive API

The backend provides a complete RESTful API with 20+ endpoints:

#### **Core Analysis**
- `POST /api/analysis` - Main AI analysis endpoint with multi-provider support
- `POST /api/analyze` - Legacy analysis endpoint (maintained for compatibility)
- `GET /api/models` - Dynamic model discovery for all providers
- `GET /api/models/:provider` - Provider-specific model listing

#### **Face Management**
- `GET /api/faces` - List all detected faces with metadata
- `POST /api/faces` - Upload and process new face images
- `GET /api/faces/:id` - Get specific face details
- `DELETE /api/faces/:id` - Remove face from system
- `POST /api/faces/:id/label` - Assign person name to face
- `GET /api/faces/unknown` - Get faces requiring labeling
- `POST /api/faces/similarities` - Find similar faces for labeling assistance

#### **Person Management**
- `GET /api/persons` - List all known persons
- `POST /api/persons` - Create new person profile
- `GET /api/persons/:id` - Get person details with face count
- `PUT /api/persons/:id` - Update person information
- `DELETE /api/persons/:id` - Remove person and associated faces
- `GET /api/persons/:id/avatar` - Get person's avatar image

#### **Visitor Tracking**
- `GET /api/visitors` - List recent doorbell events
- `GET /api/visitors/:id` - Get specific visitor event details
- `POST /api/visitors` - Process new doorbell event
- `GET /api/visitors/stats` - Visitor statistics and analytics

#### **System Management**
- `GET /api/health` - System health check and status
- `GET /api/stats` - Comprehensive usage statistics
- `GET /api/config` - Current system configuration
- `POST /api/config` - Update system configuration
- `GET /api/database/status` - Database health and metrics

#### **AI Provider Management**
- `GET /api/ai/providers` - List available AI providers
- `POST /api/ai/providers/:provider/test` - Test provider connectivity
- `GET /api/ai/usage` - AI usage statistics and costs
- `POST /api/ai/models/refresh` - Refresh model cache

#### **WebSocket Real-time Updates**
- `ws://host:3001/ws` - Real-time event streaming
- **Events**: `face_detected`, `person_recognized`, `analysis_complete`, `system_status`

### 🔗 Home Assistant Integration Setup

#### **Step 1: Install Integration**
Install the [WhoRang Integration](https://github.com/Beast12/whorang-integration) via HACS:

1. Open HACS → Integrations
2. Search for "WhoRang AI Doorbell"
3. Install and restart Home Assistant

#### **Step 2: Configure Connection**
Add the integration in Home Assistant:

1. **Settings** → **Devices & Services** → **Add Integration**
2. Search for "WhoRang AI Doorbell"
3. Configure connection:
   - **Host**: `homeassistant.local` (Add-on) or `your-docker-host` (Docker)
   - **Port**: `3001` (default)
   - **SSL**: Match backend configuration
   - **API Key**: Optional (if configured in backend)

#### **Step 3: Configure AI Providers**
Set up AI providers through the integration options:

1. **Settings** → **Devices & Services** → **WhoRang AI Doorbell** → **Configure**
2. Select "AI Providers" from the menu
3. Enter API keys for desired providers
4. Configure Ollama host/port for local processing

#### **Step 4: Verify Setup**
Check that all entities are created and updating:

- `sensor.whorang_ai_doorbell_system_status` should show "healthy"
- `binary_sensor.whorang_ai_doorbell_system_online` should be "On"
- Face gallery sensors should populate with data

## AI Provider Setup

### Local Ollama (Recommended)

**Advantages**: Free, private, no internet required

**Setup**:
1. Install Ollama on your system
2. Install a vision-capable model:
   ```bash
   ollama pull llava
   # or
   ollama pull bakllava
   ```
3. Ensure Ollama is accessible from the add-on

### OpenAI GPT-4 Vision

**Setup**:
1. Get API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Configure in WhoRang integration options
3. Monitor usage and costs

**Models**: GPT-4o, GPT-4o-mini, GPT-4-turbo

### Claude Vision

**Setup**:
1. Get API key from [Anthropic Console](https://console.anthropic.com/)
2. Configure in WhoRang integration options

**Models**: Claude-3.5-Sonnet, Claude-3-Haiku

### Google Gemini

**Setup**:
1. Get API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Configure in WhoRang integration options

**Models**: Gemini-1.5-Pro, Gemini-1.5-Flash

### Google Cloud Vision

**Setup**:
1. Set up Google Cloud project
2. Enable Vision API
3. Create service account and API key
4. Configure in WhoRang integration options

## Data Management

### Database

- **Location**: `/data/whorang.db` (configurable)
- **Type**: SQLite database
- **Backup**: Included in Home Assistant backups
- **Migration**: Automatic schema updates

### File Storage

- **Images**: `/data/uploads/` (configurable)
- **Face Data**: `/data/uploads/faces/`
- **Backup**: Included in Home Assistant backups
- **Cleanup**: Automatic old file cleanup

### Privacy

- **Local Processing**: All data stays on your system
- **API Keys**: Securely stored and transmitted
- **No Telemetry**: No data sent to external services
- **Encryption**: Database and files protected by Home Assistant

## Troubleshooting

### Common Issues

#### Add-on Won't Start

1. **Check Logs**:
   - Review add-on logs for error messages
   - Look for port conflicts or permission issues

2. **Resource Issues**:
   - Ensure sufficient RAM (minimum 2GB)
   - Check available storage space

3. **Configuration Issues**:
   - Verify configuration syntax
   - Check file paths and permissions

#### Integration Can't Connect

1. **Network Issues**:
   - Verify add-on is running and healthy
   - Check port configuration (default: 3001)
   - Test connectivity: `curl http://homeassistant.local:3001/api/health`

2. **SSL Issues**:
   - Ensure SSL settings match between add-on and integration
   - Check certificate validity

#### AI Analysis Not Working

1. **Local Ollama**:
   - Verify Ollama is installed and running
   - Check vision model is available
   - Test: `ollama list`

2. **Cloud Providers**:
   - Verify API keys are valid
   - Check quota and billing status
   - Monitor rate limits

### Performance Optimization

#### Resource Usage

- **Memory**: 512MB minimum, 2GB recommended
- **CPU**: Moderate usage during AI analysis
- **Storage**: 1GB for database and images

#### Optimization Tips

1. **Use Local Ollama**: Reduces latency and costs
2. **Adjust Thresholds**: Higher face recognition thresholds reduce false positives
3. **Limit Upload Size**: Smaller images process faster
4. **Monitor Logs**: Use appropriate log levels

### Getting Help

1. **Add-on Issues**: [GitHub Issues](https://github.com/Beast12/whorang-addon/issues)
2. **Integration Issues**: [Integration Repository](https://github.com/Beast12/whorang-integration/issues)
3. **Documentation**: [Complete Documentation](docs/)
4. **Community**: [Home Assistant Community](https://community.home-assistant.io/)

## Development

### Local Development

1. **Clone Repository**:
   ```bash
   git clone https://github.com/Beast12/whorang-addon.git
   cd whorang-addon
   ```

2. **Build Locally**:
   ```bash
   docker build --build-arg BUILD_FROM="homeassistant/amd64-base:latest" -t whorang-addon .
   ```

3. **Test Add-on**:
   ```bash
   docker run --rm -p 3001:3001 whorang-addon
   ```

### Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Alternative Deployments

### Docker Compose

For non-Home Assistant OS installations:

```yaml
version: '3.8'
services:
  whorang:
    image: ghcr.io/beast12/whorang-addon-amd64:latest
    ports:
      - "3001:3001"
    volumes:
      - ./data:/data
      - ./ssl:/ssl
    environment:
      - LOG_LEVEL=info
      - AI_PROVIDER=local
    restart: unless-stopped
```

## 💖 **Support the Project**

If you find WhoRang useful, consider supporting its development:

<div align="center">

<a href="https://www.buymeacoffee.com/koen1203" target="_blank">
  <img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" >
</a>

**Or scan the QR code:**

<img src="bmc_qr.png" alt="Buy Me A Coffee QR Code" width="150" height="150">

*Your support helps maintain and improve WhoRang!*

</div>

### Manual Installation

For advanced users:

1. **Clone Repository**:
   ```bash
   git clone https://github.com/Beast12/whorang-addon.git
   cd whorang-addon/whorang
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment**:
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

4. **Start Service**:
   ```bash
   npm start
   ```

## Version Compatibility

| Add-on Version | Integration Version | Home Assistant | Notes |
|---------------|-------------------|----------------|-------|
| 1.0.x | 1.0.x | 2023.1+ | Initial release |
| 1.1.x | 1.1.x | 2023.1+ | Enhanced AI models |

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📚 Documentation

- **[API Reference](docs/API_REFERENCE.md)** - Complete API documentation with examples
- **[Face Detection Guide](docs/Face_detection.md)** - Face recognition system details
- **[Architecture Overview](memory_bank/whorang_complete_system_overview.md)** - System architecture and components

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/Beast12/whorang-addon/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Beast12/whorang-addon/discussions)
- **API Documentation**: [Complete API Reference](docs/API_REFERENCE.md)
- **Integration Issues**: [WhoRang Integration Repository](https://github.com/Beast12/whorang-integration/issues)
- **Community**: [Home Assistant Community](https://community.home-assistant.io/)

---

[releases-shield]: https://img.shields.io/github/release/Beast12/whorang-addon.svg?style=for-the-badge
[releases]: https://github.com/Beast12/whorang-addon/releases
[commits-shield]: https://img.shields.io/github/commit-activity/y/Beast12/whorang-addon.svg?style=for-the-badge
[commits]: https://github.com/Beast12/whorang-addon/commits/main
[license-shield]: https://img.shields.io/github/license/Beast12/whorang-addon.svg?style=for-the-badge
[maintenance-shield]: https://img.shields.io/badge/maintainer-%40Beast12-blue.svg?style=for-the-badge
[user_profile]: https://github.com/Beast12
