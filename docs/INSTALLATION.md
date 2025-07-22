# WhoRang Installation Guide

Complete installation guide for the WhoRang AI Doorbell system across all Home Assistant deployment types.

## 📋 Table of Contents

- [Prerequisites](#-prerequisites)
- [Home Assistant OS/Supervised (Recommended)](#-home-assistant-ossupervised-recommended)
- [Home Assistant Container/Core](#-home-assistant-containercore)
- [Docker Compose](#-docker-compose)
- [Manual Installation](#-manual-installation)
- [Post-Installation Setup](#-post-installation-setup)
- [Troubleshooting](#-troubleshooting)

## 🔧 Prerequisites

### **System Requirements**
- **Home Assistant**: 2023.1.0 or later
- **Memory**: Minimum 2GB RAM (4GB recommended)
- **Storage**: 1GB free space for face data and images
- **Network**: Internet connection for cloud AI providers (optional for local Ollama)

### **Supported Architectures**
- **linux/amd64** - Intel/AMD 64-bit systems
- **linux/arm64** - ARM 64-bit (Raspberry Pi 4, Apple M1/M2)
- **linux/arm/v7** - ARM 32-bit (Raspberry Pi 3)

## 🏠 Home Assistant OS/Supervised (Recommended)

This is the easiest installation method with automatic integration deployment.

### **Step 1: Add Repository**

1. **Navigate to Add-ons**:
   ```
   Settings → Add-ons → Add-on Store → ⋮ (three dots) → Repositories
   ```

2. **Add WhoRang Repository**:
   ```
   https://github.com/Beast12/whorang-addon
   ```

3. **Reload Add-on Store**:
   - Click "Reload" or refresh the page
   - Wait for the repository to load

### **Step 2: Install Add-on**

1. **Find WhoRang Add-on**:
   - Look for "WhoRang AI Doorbell" in the add-on store
   - Click on the add-on tile

2. **Install**:
   - Click "Install"
   - Wait for installation to complete (5-10 minutes)

3. **Configure Add-on**:
   ```yaml
   # Basic Configuration
   ai_provider: local          # Start with local Ollama
   log_level: info
   websocket_enabled: true
   cors_enabled: true
   
   # Optional: AI Provider API Keys
   openai_api_key: ""         # Add your OpenAI key
   gemini_api_key: ""         # Add your Gemini key
   claude_api_key: ""         # Add your Claude key
   ```

4. **Start Add-on**:
   - Click "Start"
   - Check logs for successful startup

### **Step 3: Integration Auto-Discovery**

1. **Check for Integration**:
   - Go to `Settings → Devices & Services`
   - Look for "WhoRang AI Doorbell" in discovered integrations

2. **Configure Integration**:
   - Click "Configure" on the discovered integration
   - The integration should auto-detect the add-on at `localhost:3001`
   - Enter AI API keys if desired (optional)

3. **Verify Entities**:
   - Check that 19+ entities are created
   - All entities should show as "Available"

## 🐳 Home Assistant Container/Core

For Container and Core installations, use Docker deployment with manual integration setup.

### **Step 1: Deploy Backend Container**

```bash
# Create data directory
mkdir -p ./whorang-data
mkdir -p ./config/custom_components

# Run WhoRang container
docker run -d \
  --name whorang-backend \
  --restart unless-stopped \
  -p 3001:3001 \
  -v $(pwd)/whorang-data:/data \
  -v $(pwd)/config/custom_components:/config/custom_components \
  -e AI_PROVIDER=local \
  -e LOG_LEVEL=info \
  -e DATABASE_PATH=/data/whorang.db \
  -e UPLOADS_PATH=/data/uploads \
  ghcr.io/beast12/whorang-backend:latest
```

### **Step 2: Verify Container**

```bash
# Check container status
docker ps | grep whorang

# Check logs
docker logs whorang-backend

# Test API
curl http://localhost:3001/health
```

### **Step 3: Install Integration**

1. **Integration Files**:
   - The container automatically copies integration files to `/config/custom_components/`
   - Verify files exist: `ls -la config/custom_components/whorang/`

2. **Restart Home Assistant**:
   ```bash
   # For Docker
   docker restart homeassistant
   
   # For systemd
   sudo systemctl restart home-assistant@homeassistant
   ```

3. **Add Integration**:
   - Go to `Settings → Devices & Services → Add Integration`
   - Search for "WhoRang AI Doorbell"
   - Configure with `localhost:3001`

## 🐙 Docker Compose

Complete stack deployment with Home Assistant and WhoRang.

### **Step 1: Create Docker Compose File**

```yaml
# docker-compose.yml
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
      - WEBSOCKET_ENABLED=true
      - CORS_ENABLED=true
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  homeassistant:
    image: homeassistant/home-assistant:stable
    container_name: homeassistant
    restart: unless-stopped
    privileged: true
    network_mode: host
    volumes:
      - ./config:/config
      - ./config/custom_components:/config/custom_components:ro
      - /etc/localtime:/etc/localtime:ro
    depends_on:
      whorang:
        condition: service_healthy
    environment:
      - TZ=Europe/Brussels  # Set your timezone
```

### **Step 2: Deploy Stack**

```bash
# Create directories
mkdir -p config/custom_components
mkdir -p whorang-data

# Deploy stack
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs whorang
```

### **Step 3: Configure Integration**

1. **Access Home Assistant**: `http://localhost:8123`
2. **Complete HA setup** if first time
3. **Add WhoRang integration** with host `whorang:3001`

## 🔧 Manual Installation

For advanced users who want to build from source.

### **Step 1: Clone Repository**

```bash
git clone https://github.com/Beast12/whorang-addon.git
cd whorang-addon
```

### **Step 2: Build Backend**

```bash
cd whorang

# Install dependencies
npm install

# Configure environment
cp config.yaml.example config.yaml
# Edit config.yaml with your settings

# Start development server
npm run dev
```

### **Step 3: Install Integration**

```bash
# Copy integration files
cp -r ../custom_components/whorang /config/custom_components/

# Restart Home Assistant
# Add integration manually
```

## ⚙️ Post-Installation Setup

### **Step 1: Verify Installation**

1. **Check Add-on/Container Status**:
   - Add-on should show "Running"
   - Container should be healthy
   - API should respond at port 3001

2. **Check Integration**:
   - 19+ entities should be created
   - All entities should be "Available"
   - No error messages in logs

3. **Test Basic Functionality**:
   - Trigger manual analysis: `button.whorang_trigger_analysis`
   - Check system status: `sensor.whorang_system_status`

### **Step 2: Configure AI Providers**

#### **Local Ollama (Recommended for Privacy)**

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull vision model
ollama pull llava-phi3

# Configure in WhoRang
ai_provider: local
ollama_host: localhost
ollama_port: 11434
```

#### **OpenAI (Recommended for Accuracy)**

```yaml
# Add to configuration
openai_api_key: "sk-your-api-key-here"
ai_provider: openai
```

#### **Google Gemini (Fast and Affordable)**

```yaml
# Add to configuration
gemini_api_key: "AIza-your-api-key-here"
ai_provider: gemini
```

### **Step 3: Test Face Detection**

1. **Upload Test Image**:
   - Use the web interface at `http://your-ip:3001`
   - Upload a photo with faces
   - Verify faces are detected and cropped

2. **Check Face Gallery**:
   - Go to Face Manager in web interface
   - Verify face thumbnails load correctly
   - Test face labeling functionality

## 🚨 Troubleshooting

### **Add-on Won't Start**

```bash
# Check add-on logs
# Look for error messages

# Common issues:
# 1. Insufficient memory - increase to 2GB+
# 2. Port conflict - ensure 3001 is available
# 3. Permission issues - check /data directory
```

### **Integration Not Discovered**

```bash
# Check if add-on is running
curl http://localhost:3001/health

# Check Home Assistant logs
grep -i whorang /config/home-assistant.log

# Manual integration setup:
# Settings → Devices & Services → Add Integration
# Search: WhoRang AI Doorbell
# Host: localhost, Port: 3001
```

### **Entities Not Updating**

```bash
# Check WebSocket connection
# Integration options → Enable WebSocket

# Check API connectivity
curl http://localhost:3001/api/stats

# Restart integration
# Settings → Devices & Services → WhoRang → Reload
```

### **Face Detection Not Working**

```bash
# Check AI provider configuration
# Verify API keys are correct
# Test with local Ollama first

# Check logs for errors
docker logs whorang-backend | grep -i error

# Verify image upload paths
ls -la /data/uploads/faces/
```

### **Performance Issues**

```bash
# Increase memory allocation
# Docker: --memory=4g
# Add-on: Increase memory limit in supervisor

# Check disk space
df -h

# Monitor resource usage
docker stats whorang-backend
```

### **Network Issues**

```bash
# Check port accessibility
netstat -tlnp | grep 3001

# Test from different device
curl http://your-ha-ip:3001/health

# Check firewall settings
# Ensure port 3001 is open
```

## 📞 Getting Help

### **Log Collection**

```bash
# Add-on logs
# Settings → Add-ons → WhoRang → Logs

# Container logs
docker logs whorang-backend > whorang.log

# Home Assistant logs
grep -i whorang /config/home-assistant.log
```

### **Support Channels**

- **GitHub Issues**: [Report bugs](https://github.com/Beast12/whorang-addon/issues)
- **Discussions**: [Community support](https://github.com/Beast12/whorang-addon/discussions)
- **Documentation**: [Complete guides](https://github.com/Beast12/whorang-addon/tree/main/docs)

### **Before Reporting Issues**

1. **Check logs** for error messages
2. **Verify system requirements** are met
3. **Test with local Ollama** to isolate AI provider issues
4. **Include system information** (HA version, architecture, deployment type)
5. **Provide relevant logs** and configuration (remove API keys)

---

**Installation complete!** Your WhoRang AI doorbell system is now ready to transform your home security with intelligent visitor recognition.
