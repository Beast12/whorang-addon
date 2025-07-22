# WhoRang AI Doorbell Add-on

![Supports aarch64 Architecture][aarch64-shield]
![Supports amd64 Architecture][amd64-shield]
![Supports armhf Architecture][armhf-shield]
![Supports armv7 Architecture][armv7-shield]
![Supports i386 Architecture][i386-shield]

_Complete AI-powered doorbell solution with face recognition, multi-provider AI analysis, and Home Assistant integration._

## About

WhoRang is a comprehensive AI-powered doorbell solution that brings intelligent visitor recognition to your Home Assistant setup. Using advanced AI providers like OpenAI, Ollama, Gemini, Claude, and Google Cloud Vision, it can identify visitors, recognize faces, and provide detailed analytics about who's at your door.

## Features

- **Multi-AI Provider Support**: Choose from OpenAI GPT-4o, Ollama (local), Google Gemini, Claude Vision, or Google Cloud Vision
- **Face Recognition**: Advanced face detection and recognition with visitor management
- **Real-time Updates**: WebSocket-powered instant notifications and status updates
- **Professional Web Interface**: Modern, responsive web-based management dashboard
- **Visitor Analytics**: Comprehensive visitor statistics and pattern analysis
- **Zero Configuration**: Auto-discovery and seamless Home Assistant integration
- **19+ Home Assistant Entities**: Sensors, cameras, buttons, and automation services
- **Multi-Architecture Support**: Works on amd64, arm64, armv7, armhf, and i386

## Installation

1. Navigate in your Home Assistant frontend to **Settings** → **Add-ons** → **Add-on Store**.
2. Click the 3-dots menu at upper right **...** → **Repositories** and add this repository's URL.
3. Find the "WhoRang AI Doorbell" add-on and click it.
4. Click on the "INSTALL" button.

## How to use

1. Start the add-on.
2. Check the add-on log output to see the result.
3. Access the web interface through the "OPEN WEB UI" button or via the Home Assistant sidebar.
4. Configure your AI provider in the Settings page.
5. Set up your doorbell camera integration in Home Assistant.
6. The add-on will automatically create entities and services for automation.

## Configuration

### Add-on Configuration

The add-on can be configured through the Home Assistant UI. Here are the available options:

**AI Provider Options:**
- `ai_provider`: Choose your AI provider (local, openai, claude, gemini, google-cloud-vision)
- `face_recognition_threshold`: Similarity threshold for face recognition (0.1-1.0)
- `ai_analysis_timeout`: Timeout for AI analysis in seconds (10-120)

**Storage Options:**
- `database_path`: Path to store the SQLite database (default: /data/whorang.db)
- `uploads_path`: Path to store uploaded face images (default: /data/uploads)
- `max_upload_size`: Maximum file size for uploads (default: 10MB)

**Network Options:**
- `public_url`: Public URL for image access (auto-detected if empty)
- `cors_enabled`: Enable CORS for web interface (default: true)
- `cors_origins`: Allowed CORS origins (default: ["*"])

**System Options:**
- `log_level`: Logging level (debug, info, warn, error)
- `websocket_enabled`: Enable WebSocket for real-time updates (default: true)

### Example Configuration

```yaml
ai_provider: openai
log_level: info
database_path: /homeassistant/whorang/whorang.db
uploads_path: /homeassistant/whorang/uploads
face_recognition_threshold: 0.6
ai_analysis_timeout: 30
public_url: ""
websocket_enabled: true
cors_enabled: true
cors_origins:
  - "*"
```

## AI Provider Setup

### OpenAI (Recommended)
1. Get an API key from [OpenAI](https://platform.openai.com/api-keys)
2. Set the `OPENAI_API_KEY` environment variable or configure in the web interface
3. Uses GPT-4o with vision capabilities for excellent accuracy

### Ollama (Local/Free)
1. Install Ollama on your system or use the Ollama Home Assistant add-on
2. Pull a vision-capable model like `llava` or `bakllava`
3. Configure the Ollama endpoint in the web interface
4. Completely free and runs locally

### Google Gemini
1. Get an API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Configure the API key in the web interface
3. Uses Gemini Pro Vision for fast and accurate analysis

### Claude Vision
1. Get an API key from [Anthropic](https://console.anthropic.com/)
2. Configure the API key in the web interface
3. Uses Claude 3 with vision capabilities

### Google Cloud Vision
1. Set up a Google Cloud project with Vision API enabled
2. Create a service account and download the JSON key
3. Configure the credentials in the web interface

## Home Assistant Integration

The add-on automatically creates the following entities:

**Sensors:**
- `sensor.whorang_last_visitor` - Information about the last detected visitor
- `sensor.whorang_daily_visitors` - Count of daily visitors
- `sensor.whorang_weekly_visitors` - Count of weekly visitors
- `sensor.whorang_monthly_visitors` - Count of monthly visitors

**Binary Sensors:**
- `binary_sensor.whorang_motion_detected` - Motion detection status
- `binary_sensor.whorang_person_detected` - Person detection status

**Cameras:**
- `camera.whorang_last_detection` - Last detection image
- `camera.whorang_live_feed` - Live camera feed (if configured)

**Buttons:**
- `button.whorang_analyze_last_image` - Manually trigger analysis
- `button.whorang_clear_visitors` - Clear visitor history

**Services:**
- `whorang.analyze_image` - Analyze a specific image
- `whorang.add_known_person` - Add a person to the known persons list
- `whorang.remove_known_person` - Remove a person from known persons

## Debugging and Troubleshooting

### Debug Files Access

The add-on provides access to internal files for debugging through the `/addon_config/` directory:

- **Logs**: `/addon_config/logs/` - Nginx and application logs
- **Database**: `/addon_config/database/` - Direct access to SQLite database
- **Debug Info**: `/addon_config/debug/` - System information and diagnostics

### Common Issues

1. **Add-on won't start**: Check the logs for permission errors or configuration issues
2. **Face images not loading**: Verify the `public_url` setting and network configuration
3. **AI analysis failing**: Check your API keys and provider configuration
4. **Database issues**: Ensure the data directory is writable and has sufficient space

### Debug Endpoints

- `GET /api/debug/config` - Configuration status and validation
- `GET /api/debug/directories` - Directory and path status
- `GET /health` - Health check endpoint

## Support

For support and documentation:
- [GitHub Repository](https://github.com/Beast12/whorang-addon)
- [Documentation](https://github.com/Beast12/whorang-addon/blob/main/docs/)
- [Issue Tracker](https://github.com/Beast12/whorang-addon/issues)

## Authors & Contributors

The original setup of this repository is by [Beast12](https://github.com/Beast12).

## License

MIT License

Copyright (c) 2025 Beast12

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

[aarch64-shield]: https://img.shields.io/badge/aarch64-yes-green.svg
[amd64-shield]: https://img.shields.io/badge/amd64-yes-green.svg
[armhf-shield]: https://img.shields.io/badge/armhf-yes-green.svg
[armv7-shield]: https://img.shields.io/badge/armv7-yes-green.svg
[i386-shield]: https://img.shields.io/badge/i386-yes-green.svg
