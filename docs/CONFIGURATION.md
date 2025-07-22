# WhoRang Configuration Guide

Complete configuration reference for the WhoRang AI Doorbell system, covering all settings and customization options.

## 📋 Table of Contents

- [Basic Configuration](#-basic-configuration)
- [AI Provider Setup](#-ai-provider-setup)
- [Integration Options](#-integration-options)
- [Advanced Settings](#-advanced-settings)
- [Security Configuration](#-security-configuration)
- [Performance Tuning](#-performance-tuning)
- [Environment Variables](#-environment-variables)

## ⚙️ Basic Configuration

### **Add-on Configuration (Home Assistant OS/Supervised)**

Access via: `Settings → Add-ons → WhoRang AI Doorbell → Configuration`

```yaml
# Basic Settings
ai_provider: local              # AI provider to use
log_level: info                 # Logging level
websocket_enabled: true         # Real-time updates
cors_enabled: true              # Cross-origin requests

# Database & Storage
database_path: /data/whorang.db # Database location
uploads_path: /data/uploads     # File storage path
max_upload_size: 10MB          # Maximum image size

# Face Recognition
face_recognition_threshold: 0.6 # Recognition sensitivity
ai_analysis_timeout: 30        # AI processing timeout (seconds)

# Network
public_url: ""                 # Custom public URL (optional)
ssl: false                     # Enable HTTPS
certfile: fullchain.pem        # SSL certificate
keyfile: privkey.pem           # SSL private key

# CORS Settings
cors_origins:
  - "*"                        # Allowed origins (use specific domains in production)
```

### **Docker Configuration**

```yaml
# docker-compose.yml
version: '3.8'
services:
  whorang:
    image: ghcr.io/beast12/whorang-backend:latest
    environment:
      # Basic Settings
      - AI_PROVIDER=local
      - LOG_LEVEL=info
      - WEBSOCKET_ENABLED=true
      - CORS_ENABLED=true
      
      # Database & Storage
      - DATABASE_PATH=/data/whorang.db
      - UPLOADS_PATH=/data/uploads
      - MAX_UPLOAD_SIZE=10MB
      
      # Face Recognition
      - FACE_RECOGNITION_THRESHOLD=0.6
      - AI_ANALYSIS_TIMEOUT=30
      
      # Network
      - PUBLIC_URL=http://192.168.1.100:3001
      - SSL_ENABLED=false
```

## 🤖 AI Provider Setup

### **Local Ollama (Recommended for Privacy)**

**Installation:**
```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull vision models
ollama pull llava-phi3          # Lightweight, fast
ollama pull llava:latest        # Full featured
ollama pull bakllava:latest     # Alternative model
```

**Configuration:**
```yaml
# Add-on Configuration
ai_provider: local
ollama_host: localhost          # Ollama server host
ollama_port: 11434             # Ollama server port
ollama_model: llava-phi3       # Model to use

# Docker Environment
- AI_PROVIDER=local
- OLLAMA_HOST=localhost
- OLLAMA_PORT=11434
- OLLAMA_MODEL=llava-phi3
```

**Model Comparison:**
| Model | Size | Speed | Accuracy | Use Case |
|-------|------|-------|----------|----------|
| `llava-phi3` | 2.9GB | Fast | Good | Recommended default |
| `llava:latest` | 4.7GB | Medium | Excellent | High accuracy needs |
| `bakllava:latest` | 4.1GB | Medium | Very Good | Alternative option |

### **OpenAI (Recommended for Accuracy)**

**Get API Key:**
1. Visit [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create new API key
3. Copy key (starts with `sk-`)

**Configuration:**
```yaml
# Add-on Configuration
ai_provider: openai
openai_api_key: "sk-your-api-key-here"
openai_model: gpt-4o           # Model to use
openai_max_tokens: 1000        # Response limit
openai_temperature: 0.1        # Creativity (0.0-1.0)

# Docker Environment
- AI_PROVIDER=openai
- OPENAI_API_KEY=sk-your-api-key-here
- OPENAI_MODEL=gpt-4o
```

**Model Options:**
| Model | Cost/1K tokens | Speed | Accuracy | Notes |
|-------|----------------|-------|----------|-------|
| `gpt-4o` | $0.005 | Fast | Excellent | Recommended |
| `gpt-4o-mini` | $0.0015 | Very Fast | Very Good | Budget option |
| `gpt-4-turbo` | $0.01 | Medium | Excellent | Legacy option |

### **Google Gemini (Fast and Affordable)**

**Get API Key:**
1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Create new API key
3. Copy key (starts with `AIza`)

**Configuration:**
```yaml
# Add-on Configuration
ai_provider: gemini
gemini_api_key: "AIza-your-api-key-here"
gemini_model: gemini-1.5-pro   # Model to use
gemini_temperature: 0.1        # Creativity level

# Docker Environment
- AI_PROVIDER=gemini
- GEMINI_API_KEY=AIza-your-api-key-here
- GEMINI_MODEL=gemini-1.5-pro
```

**Model Options:**
| Model | Cost/1K tokens | Speed | Accuracy | Notes |
|-------|----------------|-------|----------|-------|
| `gemini-1.5-pro` | $0.0025 | Fast | Excellent | Recommended |
| `gemini-1.5-flash` | $0.00075 | Very Fast | Very Good | Budget option |

### **Anthropic Claude (High Quality)**

**Get API Key:**
1. Visit [Anthropic Console](https://console.anthropic.com/)
2. Create new API key
3. Copy key (starts with `sk-ant-`)

**Configuration:**
```yaml
# Add-on Configuration
ai_provider: claude
claude_api_key: "sk-ant-your-api-key-here"
claude_model: claude-3-5-sonnet-20241022
claude_max_tokens: 1000

# Docker Environment
- AI_PROVIDER=claude
- CLAUDE_API_KEY=sk-ant-your-api-key-here
- CLAUDE_MODEL=claude-3-5-sonnet-20241022
```

### **Google Cloud Vision (Enterprise)**

**Setup:**
1. Create Google Cloud Project
2. Enable Vision API
3. Create service account key
4. Download JSON key file

**Configuration:**
```yaml
# Add-on Configuration
ai_provider: google-cloud-vision
google_cloud_key_file: /config/google-cloud-key.json

# Docker Environment
- AI_PROVIDER=google-cloud-vision
- GOOGLE_APPLICATION_CREDENTIALS=/config/google-cloud-key.json
```

## 🏠 Integration Options

### **Home Assistant Integration Configuration**

Access via: `Settings → Devices & Services → WhoRang AI Doorbell → Configure`

#### **Connection Settings**
```yaml
host: homeassistant.local      # WhoRang backend host
port: 3001                     # Backend port
ssl: false                     # Use HTTPS
api_key: ""                    # Optional API key
```

#### **Update Settings**
```yaml
update_interval: 30            # Polling interval (seconds)
websocket_enabled: true        # Real-time updates
timeout: 10                    # Request timeout (seconds)
```

#### **AI Provider Settings**
```yaml
# Configure AI providers through integration
ai_providers:
  openai:
    api_key: "sk-..."
    model: "gpt-4o"
  gemini:
    api_key: "AIza-..."
    model: "gemini-1.5-pro"
  claude:
    api_key: "sk-ant-..."
    model: "claude-3-5-sonnet-20241022"
```

#### **Feature Settings**
```yaml
enable_cost_tracking: true     # Track AI usage costs
enable_face_detection: true    # Face recognition features
enable_person_tracking: true   # Known person tracking
enable_statistics: true        # Usage statistics
```

### **Entity Customization**

#### **Sensor Names**
```yaml
# Customize entity names in Home Assistant
sensor.whorang_latest_visitor:
  friendly_name: "Latest Doorbell Visitor"
  icon: mdi:account-eye

binary_sensor.whorang_doorbell:
  friendly_name: "Doorbell Activity"
  device_class: occupancy
```

#### **Entity Categories**
```yaml
# Group entities by category
homeassistant:
  customize:
    sensor.whorang_visitor_count_today:
      category: "statistics"
    sensor.whorang_ai_cost_today:
      category: "monitoring"
```

## 🔧 Advanced Settings

### **Face Recognition Tuning**

```yaml
# Face Detection Parameters
face_detection:
  min_face_size: 30            # Minimum face size (pixels)
  max_face_size: 300           # Maximum face size (pixels)
  confidence_threshold: 0.6    # Detection confidence
  padding_percent: 20          # Face crop padding
  
# Face Recognition Parameters
face_recognition:
  similarity_threshold: 0.6    # Recognition threshold
  max_faces_per_image: 10     # Maximum faces to process
  enable_alignment: true       # Face alignment preprocessing
  embedding_model: "facenet"   # Embedding model to use
```

### **Performance Optimization**

```yaml
# Processing Settings
processing:
  max_concurrent_requests: 5   # Concurrent AI requests
  image_resize_max: 1024      # Maximum image dimension
  jpeg_quality: 85            # JPEG compression quality
  enable_caching: true        # Enable response caching
  cache_ttl: 3600            # Cache time-to-live (seconds)

# Memory Management
memory:
  max_memory_usage: 2048      # Maximum memory (MB)
  cleanup_interval: 3600      # Cleanup interval (seconds)
  max_cached_images: 100      # Maximum cached images
```

### **Database Configuration**

```yaml
# Database Settings
database:
  path: "/data/whorang.db"     # Database file path
  backup_enabled: true         # Enable automatic backups
  backup_interval: 86400       # Backup interval (seconds)
  max_backups: 7              # Maximum backup files
  vacuum_interval: 604800      # Database optimization (seconds)
  
# Data Retention
retention:
  visitor_events_days: 90      # Keep visitor events (days)
  face_images_days: 365       # Keep face images (days)
  statistics_days: 730        # Keep statistics (days)
  log_files_days: 30          # Keep log files (days)
```

## 🔒 Security Configuration

### **Authentication**

```yaml
# API Authentication
security:
  enable_api_key: false        # Require API key
  api_key: "your-secret-key"   # API key value
  enable_rate_limiting: true   # Rate limiting
  max_requests_per_minute: 60  # Request limit
  
# CORS Security
cors:
  enabled: true
  origins:
    - "https://your-domain.com"  # Specific domains only
    - "http://localhost:8123"    # Local Home Assistant
  methods: ["GET", "POST"]       # Allowed methods
  headers: ["Content-Type", "Authorization"]
```

### **SSL/TLS Configuration**

```yaml
# HTTPS Settings
ssl:
  enabled: true
  cert_file: "/ssl/fullchain.pem"
  key_file: "/ssl/privkey.pem"
  protocols: ["TLSv1.2", "TLSv1.3"]
  ciphers: "ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM:DHE+CHACHA20:!aNULL:!MD5:!DSS"
```

### **Privacy Settings**

```yaml
# Privacy Configuration
privacy:
  anonymize_faces: false       # Blur faces in logs
  disable_logging: false       # Disable face logging
  local_processing_only: false # Use only local AI
  auto_delete_unknown: false   # Auto-delete unknown faces
  retention_days: 365         # Data retention period
```

## ⚡ Performance Tuning

### **Resource Allocation**

```yaml
# Docker Resource Limits
deploy:
  resources:
    limits:
      memory: 4G               # Maximum memory
      cpus: '2.0'             # Maximum CPU cores
    reservations:
      memory: 2G               # Reserved memory
      cpus: '1.0'             # Reserved CPU cores
```

### **AI Provider Optimization**

```yaml
# Provider-Specific Settings
ai_optimization:
  openai:
    timeout: 30               # Request timeout
    max_retries: 3           # Retry attempts
    batch_size: 1            # Batch processing
    
  ollama:
    timeout: 60              # Longer timeout for local
    keep_alive: 300          # Model keep-alive time
    num_ctx: 2048           # Context window size
    
  gemini:
    timeout: 20              # Fast timeout
    safety_settings: "block_none"  # Safety level
```

### **Caching Configuration**

```yaml
# Cache Settings
cache:
  enabled: true
  type: "memory"              # memory, redis, file
  ttl: 3600                  # Time-to-live (seconds)
  max_size: 1000             # Maximum cached items
  
  # Redis Configuration (if using Redis)
  redis:
    host: "localhost"
    port: 6379
    db: 0
    password: ""
```

## 🌐 Environment Variables

### **Complete Environment Variable Reference**

```bash
# Core Settings
AI_PROVIDER=local                    # AI provider to use
LOG_LEVEL=info                      # Logging level
NODE_ENV=production                 # Environment mode

# Database & Storage
DATABASE_PATH=/data/whorang.db      # Database file path
UPLOADS_PATH=/data/uploads          # Upload directory
MAX_UPLOAD_SIZE=10MB               # Maximum file size

# Network & Security
PORT=3001                          # Server port
PUBLIC_URL=                        # Public URL override
SSL_ENABLED=false                  # Enable HTTPS
CORS_ENABLED=true                  # Enable CORS
API_KEY=                           # API authentication key

# WebSocket
WEBSOCKET_ENABLED=true             # Enable WebSocket
WEBSOCKET_PORT=3001                # WebSocket port

# AI Providers
OPENAI_API_KEY=                    # OpenAI API key
OPENAI_MODEL=gpt-4o               # OpenAI model
GEMINI_API_KEY=                    # Gemini API key
GEMINI_MODEL=gemini-1.5-pro       # Gemini model
CLAUDE_API_KEY=                    # Claude API key
CLAUDE_MODEL=claude-3-5-sonnet-20241022  # Claude model
OLLAMA_HOST=localhost              # Ollama host
OLLAMA_PORT=11434                  # Ollama port
OLLAMA_MODEL=llava-phi3           # Ollama model

# Face Recognition
FACE_RECOGNITION_THRESHOLD=0.6     # Recognition threshold
AI_ANALYSIS_TIMEOUT=30             # AI timeout (seconds)
MIN_FACE_SIZE=30                   # Minimum face size
MAX_FACE_SIZE=300                  # Maximum face size

# Performance
MAX_CONCURRENT_REQUESTS=5          # Concurrent requests
IMAGE_RESIZE_MAX=1024             # Image resize limit
JPEG_QUALITY=85                   # JPEG quality
ENABLE_CACHING=true               # Enable caching
CACHE_TTL=3600                    # Cache TTL

# Monitoring
ENABLE_METRICS=true               # Enable metrics
METRICS_PORT=9090                 # Metrics port
HEALTH_CHECK_INTERVAL=30          # Health check interval
```

### **Docker Compose Example**

```yaml
version: '3.8'
services:
  whorang:
    image: ghcr.io/beast12/whorang-backend:latest
    environment:
      # Core
      - AI_PROVIDER=openai
      - LOG_LEVEL=info
      - NODE_ENV=production
      
      # Database
      - DATABASE_PATH=/data/whorang.db
      - UPLOADS_PATH=/data/uploads
      
      # AI Providers
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - OPENAI_MODEL=gpt-4o
      - OLLAMA_HOST=ollama
      - OLLAMA_PORT=11434
      
      # Performance
      - MAX_CONCURRENT_REQUESTS=3
      - ENABLE_CACHING=true
      - CACHE_TTL=1800
      
      # Security
      - CORS_ENABLED=true
      - API_KEY=${WHORANG_API_KEY}
    volumes:
      - ./whorang-data:/data
      - ./config/custom_components:/config/custom_components
    ports:
      - "3001:3001"
    restart: unless-stopped
```

## 🔄 Configuration Validation

### **Test Configuration**

```bash
# Test API connectivity
curl http://localhost:3001/health

# Test AI provider
curl -X POST http://localhost:3001/api/test-ai \
  -H "Content-Type: application/json" \
  -d '{"provider": "openai"}'

# Test face detection
curl -X POST http://localhost:3001/api/test-face-detection \
  -F "image=@test-image.jpg"
```

### **Configuration Checklist**

- [ ] **AI Provider**: Configured and tested
- [ ] **Database**: Path accessible and writable
- [ ] **Storage**: Upload directory exists and writable
- [ ] **Network**: Port 3001 accessible
- [ ] **SSL**: Certificates valid (if enabled)
- [ ] **Integration**: Home Assistant can connect
- [ ] **Entities**: All 19+ entities created
- [ ] **Face Detection**: Test image processing works
- [ ] **WebSocket**: Real-time updates functioning
- [ ] **Logs**: No error messages in logs

---

**Configuration complete!** Your WhoRang system is now optimized for your specific needs and environment.
