# Changelog

All notable changes to the WhoRang AI Doorbell Add-on will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Multi-architecture Docker image support (amd64, arm64, arm/v7)
- Automated Docker image building and publishing to GitHub Container Registry
- Comprehensive GitHub Actions workflow for CI/CD
- Security scanning with Trivy vulnerability scanner
- Automated testing of Docker images
- Support for Home Assistant Container and Core installations via Docker

### Changed
- Enhanced README with clear installation options for all Home Assistant types
- Improved Docker Compose configuration examples
- Updated documentation with Docker deployment instructions

### Security
- Added automated vulnerability scanning for Docker images
- Implemented security best practices in Docker builds

## [1.0.0] - 2024-01-01

### Added
- Initial release of WhoRang AI Doorbell Add-on
- Support for Home Assistant OS and Supervised installations
- AI-powered visitor analysis with multiple provider support:
  - OpenAI GPT-4 Vision
  - Anthropic Claude Vision
  - Google Gemini Vision
  - Google Cloud Vision API
  - Local Ollama support
- Advanced face recognition and visitor tracking
- Real-time WebSocket communication
- Comprehensive web interface for configuration and monitoring
- RESTful API for Home Assistant integration
- SQLite database for visitor data storage
- Automatic image cleanup and data management
- SSL/TLS support with certificate management
- Multi-language support (English)
- Comprehensive logging and debugging capabilities

### Features
- **AI Analysis**: Multi-provider AI analysis with cost tracking
- **Face Recognition**: Advanced face detection and recognition
- **Real-time Updates**: WebSocket-based live notifications
- **Web Interface**: Complete web UI for management
- **API Integration**: Full REST API for Home Assistant
- **Data Management**: Visitor tracking and analytics
- **Security**: SSL support and secure API key storage
- **Performance**: Optimized for resource-constrained environments

### Configuration Options
- AI provider selection and configuration
- Database and upload path customization
- SSL/TLS certificate management
- CORS and WebSocket configuration
- Logging level and debugging options
- Face recognition threshold tuning
- Upload size limits and timeouts

### Supported Platforms
- Home Assistant OS (all architectures)
- Home Assistant Supervised (all architectures)
- Docker deployment (amd64, arm64, arm/v7)
- Manual installation (advanced users)

### Requirements
- Home Assistant 2023.1.0 or later
- Minimum 2GB RAM (4GB recommended)
- 1GB free storage space
- Internet connection (for cloud AI providers)

### Documentation
- Complete installation guide
- Configuration reference
- Troubleshooting guide
- API documentation
- Docker deployment instructions

---

## Release Notes

### Version 1.0.0 - Initial Release

This is the first stable release of the WhoRang AI Doorbell Add-on, providing a complete AI-powered doorbell solution for Home Assistant users.

**Key Highlights:**
- 🤖 **Multi-Provider AI**: Support for 5 different AI providers
- 👤 **Face Recognition**: Advanced visitor identification
- 🔄 **Real-time Updates**: Instant notifications via WebSocket
- 🌐 **Web Interface**: Complete management interface
- 🔒 **Privacy-First**: Local processing options available
- 📊 **Analytics**: Comprehensive visitor tracking and statistics

**Installation:**
- Add-on Store: Add repository and install via Home Assistant
- Docker: Use provided Docker Compose configuration
- Manual: Build from source for custom deployments

**Next Steps:**
- Install the companion [WhoRang Integration](https://github.com/Beast12/whorang-integration)
- Configure your preferred AI provider
- Set up automations for visitor notifications
- Customize face recognition settings

For detailed installation and configuration instructions, see the [README](README.md).

---

## Development

### Contributing
Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Versioning
This project uses [Semantic Versioning](https://semver.org/):
- **MAJOR**: Incompatible API changes
- **MINOR**: New functionality in a backwards compatible manner
- **PATCH**: Backwards compatible bug fixes

### Release Process
1. Update version in relevant files
2. Update CHANGELOG.md with new version
3. Create and push version tag
4. GitHub Actions automatically builds and publishes Docker images
5. Create GitHub release with automated release notes

### Docker Images
Docker images are automatically built and published to:
- `ghcr.io/beast12/whorang-backend:latest`
- `ghcr.io/beast12/whorang-backend:v1.0.0`

Supported architectures:
- linux/amd64 (x86_64)
- linux/arm64 (ARM 64-bit)
- linux/arm/v7 (ARM 32-bit)
