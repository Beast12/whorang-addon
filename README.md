# WhoRang AI Doorbell Add-on

[![GitHub Release][releases-shield]][releases]
[![GitHub Activity][commits-shield]][commits]
[![License][license-shield]](LICENSE)
[![Project Maintenance][maintenance-shield]][user_profile]

_AI-powered doorbell backend service for Home Assistant with face recognition and multi-provider AI analysis._

## About

The WhoRang AI Doorbell Add-on provides the backend service for the [WhoRang AI Doorbell Integration](https://github.com/Beast12/whorang-integration). This add-on runs the complete WhoRang backend service within Home Assistant, providing:

- **AI-Powered Analysis**: Support for OpenAI, Claude, Gemini, Google Cloud Vision, and local Ollama
- **Face Recognition**: Advanced face detection and recognition with confidence scoring
- **Real-time Processing**: WebSocket-based real-time updates and notifications
- **Web Interface**: Complete web UI for configuration and monitoring
- **Data Management**: Visitor tracking, statistics, and analytics
- **API Integration**: RESTful API for Home Assistant integration

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

1. **Create Docker Compose File**:
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

2. **Start the Service**:
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

## Usage

### Web Interface

After installation, access the web interface:

- **Local Access**: `http://homeassistant.local:3001`
- **Ingress**: Available through Home Assistant sidebar
- **SSL**: `https://homeassistant.local:3001` (if SSL enabled)

### API Endpoints

The add-on provides a complete REST API:

- **Health Check**: `GET /api/health`
- **Visitor Data**: `GET /api/visitors`
- **Face Management**: `GET/POST /api/faces`
- **AI Analysis**: `POST /api/analysis`
- **Statistics**: `GET /api/stats`
- **WebSocket**: `ws://host:3001/ws`

### Integration Setup

1. **Install Integration**:
   - Install [WhoRang Integration](https://github.com/Beast12/whorang-integration) via HACS

2. **Configure Integration**:
   - Host: `homeassistant.local` or `localhost`
   - Port: `3001`
   - SSL: Match add-on configuration

3. **Configure AI Providers**:
   - Use integration options to set API keys
   - Switch providers as needed

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

## Support

- **Issues**: [GitHub Issues](https://github.com/Beast12/whorang-addon/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Beast12/whorang-addon/discussions)
- **Documentation**: [Complete Documentation](docs/)
- **Community**: [Home Assistant Community](https://community.home-assistant.io/)

---

[releases-shield]: https://img.shields.io/github/release/Beast12/whorang-addon.svg?style=for-the-badge
[releases]: https://github.com/Beast12/whorang-addon/releases
[commits-shield]: https://img.shields.io/github/commit-activity/y/Beast12/whorang-addon.svg?style=for-the-badge
[commits]: https://github.com/Beast12/whorang-addon/commits/main
[license-shield]: https://img.shields.io/github/license/Beast12/whorang-addon.svg?style=for-the-badge
[maintenance-shield]: https://img.shields.io/badge/maintainer-%40Beast12-blue.svg?style=for-the-badge
[user_profile]: https://github.com/Beast12
