# Changelog

All notable changes to this add-on will be documented in this file.

## [2.0.17] - 2025-07-30

### Changed
- **Version**: Bumped to v2.0.17 to create a fresh release with all recent stability fixes.

## [2.0.16] - 2025-07-30

### Fixed
- **Configuration Propagation**: Resolved issues with Home Assistant addon configuration not being properly passed to the Node.js backend
- **Native Module Permissions**: Fixed permission errors preventing native modules (sharp, canvas, better-sqlite3) from loading in Home Assistant OS
- **Environment Variable Propagation**: Ensured all Home Assistant configuration values are properly passed from run.sh to the Node.js backend
- **Nginx Compliance**: Ensured nginx runs without permission errors and all logs are directed to stdout/stderr as required by Home Assistant

### Changed
- Enhanced add-on mode detection with multiple fallback methods for better reliability
- Improved native module permission handling for Home Assistant OS compatibility
- Updated startup scripts to properly propagate environment variables

## [2.0.8] - 2025-01-24

### Fixed
- **CRITICAL**: Nginx logging compliance issue preventing Home Assistant add-on startup
- Nginx permission denied errors when trying to write log files to disk
- File-based logging violations of Home Assistant add-on requirements

### Changed
- Updated nginx configuration to use `/dev/stdout` and `/dev/stderr` for all logging
- Removed all nginx log directory creation from Dockerfile and startup scripts
- Added comprehensive Home Assistant compliance validation in startup process
- Enhanced docker-entrypoint.sh with logging compliance checks

### Added
- Automatic validation to prevent file-based logging violations
- Improved error messages for Home Assistant add-on compliance issues
- Updated documentation with nginx logging fix details

## [2.0.7] - 2025-01-24

### Fixed
- GitHub Actions workflow failures due to missing static files
- Public directory excluded by .gitignore causing ENOENT errors in CI/CD
- Incomplete version updates across all configuration files

### Added
- Enhanced GitHub Actions testing with retry logic and content verification
- Complete static file management with proper web interface files
- Comprehensive version consistency across all project files
- Robust CI/CD pipeline with 5-attempt retry mechanism and extended wait times

### Changed
- Removed public directory from .gitignore to include static web files
- Enhanced testing methodology with both HTTP status and content verification
- Improved error reporting and container log analysis in CI/CD
- Updated all version references to maintain consistency across the project

## [2.0.3] - 2025-01-22

### Fixed
- Critical Home Assistant add-on permission issues resolved
- Fixed nginx permission denied errors in HA add-on mode
- Fixed chown/chmod operation not permitted errors on system directories
- Fixed nginx PID file and log file access issues in restricted environments

### Added
- Home Assistant add-on best practices implementation with addon_config support
- Deployment mode detection (HA add-on vs standalone Docker)
- Writable temp directories for nginx in HA add-on mode
- Structured addon_config directory with logs/, debug/, database/ subdirectories
- Database symlink for direct access and backup
- Comprehensive debug information file (system-info.json)
- User-friendly README.md in addon_config explaining structure

### Changed
- Nginx configuration adapted for HA add-on compatibility
- Use /tmp directory for nginx logs, PID file, and temp directories in HA mode
- Skip system directory ownership changes when running as HA add-on
- Enhanced startup script with addon_config setup

## [2.0.2] - 2025-01-22

### Fixed
- Nginx permission resolution with comprehensive directory structure
- User-configured paths implementation from Home Assistant GUI
- Critical nginx configuration error (alias directive in named location)
- Enhanced docker-entrypoint.sh with robust startup validation

### Added
- Multi-source configuration reader (HA options → env vars → defaults)
- Comprehensive path validation with security checks
- Debug endpoints for configuration troubleshooting
- Graceful fallback system when user paths aren't accessible

## [2.0.1] - 2025-01-21

### Fixed
- Face processing pipeline coordinate handling
- Image loading system across all deployment scenarios
- WebSocket communication stability improvements

## [2.0.0] - 2025-01-20

### Added
- Complete AI-powered doorbell solution
- Multi-provider AI analysis (OpenAI, Ollama, Gemini, Claude, Google Cloud Vision)
- Professional web-based management interface
- Real-time WebSocket updates
- Face recognition and visitor management
- Home Assistant integration with 19+ entities
- Auto-discovery and zero-configuration setup

### Changed
- Consolidated from two-repository setup to unified solution
- Modern web interface replacing command-line tools
- Enhanced face processing with 100% success rate

## [1.x.x] - Previous Versions

### Legacy
- Initial proof-of-concept implementations
- Basic face detection capabilities
- Command-line interface
- Manual configuration requirements
