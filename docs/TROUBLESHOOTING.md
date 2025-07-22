# WhoRang Troubleshooting Guide

Comprehensive troubleshooting guide for the WhoRang AI Doorbell system, covering common issues and their solutions.

## 📋 Table of Contents

- [Quick Diagnostics](#-quick-diagnostics)
- [Installation Issues](#-installation-issues)
- [Integration Problems](#-integration-problems)
- [Face Detection Issues](#-face-detection-issues)
- [Performance Problems](#-performance-problems)
- [Network and Connectivity](#-network-and-connectivity)
- [AI Provider Issues](#-ai-provider-issues)
- [Database Problems](#-database-problems)
- [Log Analysis](#-log-analysis)
- [Getting Help](#-getting-help)

## 🔍 Quick Diagnostics

### **System Health Check**

```bash
# Check if WhoRang is running
curl http://localhost:3001/health

# Expected response:
{
  "status": "healthy",
  "version": "2.0.0",
  "uptime": 86400,
  "database": {"status": "connected"},
  "ai_providers": {"ollama": "connected"}
}
```

### **Integration Status Check**

1. **Home Assistant**: `Settings → Devices & Services → WhoRang AI Doorbell`
2. **Entity Count**: Should show 19+ entities
3. **Entity Status**: All should be "Available" (not "Unavailable")
4. **Last Update**: Should be recent (within update interval)

### **Common Status Indicators**

| Symptom | Likely Cause | Quick Fix |
|---------|--------------|-----------|
| Add-on won't start | Memory/port issue | Check logs, increase memory |
| Integration not found | Add-on not running | Start add-on, restart HA |
| Entities unavailable | Connection issue | Check network, restart integration |
| Face detection fails | AI provider issue | Check API keys, try local Ollama |
| Images not loading | URL configuration | Set `public_url` in config |

## 🚀 Installation Issues

### **Add-on Won't Install**

**Symptoms:**
- Installation fails with error message
- Add-on store shows "Failed to install"
- Long installation times (>20 minutes)

**Solutions:**

1. **Check System Resources:**
   ```bash
   # Check available memory
   free -h
   
   # Check disk space
   df -h
   
   # Ensure at least 2GB RAM and 1GB storage available
   ```

2. **Clear Add-on Cache:**
   ```bash
   # Restart Home Assistant
   ha core restart
   
   # Or reload add-on store
   ha addons reload
   ```

3. **Manual Repository Addition:**
   ```
   Settings → Add-ons → Add-on Store → ⋮ → Repositories
   Add: https://github.com/Beast12/whorang-addon
   ```

### **Add-on Won't Start**

**Symptoms:**
- Add-on shows "Stopped" status
- Error messages in add-on logs
- Immediate crash after start

**Common Causes & Solutions:**

#### **Port Conflict (Port 3001 in use)**
```bash
# Check what's using port 3001
netstat -tlnp | grep 3001
lsof -i :3001

# Solution: Stop conflicting service or change port
```

#### **Insufficient Memory**
```yaml
# Increase memory limit in add-on configuration
# Or in Home Assistant Supervisor:
# Settings → System → Host → Hardware
```

#### **Permission Issues**
```bash
# Check data directory permissions
ls -la /data/

# Fix permissions if needed
chown -R root:root /data/
chmod -R 755 /data/
```

#### **Database Lock**
```bash
# Remove database lock file
rm -f /data/whorang.db-wal
rm -f /data/whorang.db-shm

# Restart add-on
```

### **Docker Installation Issues**

**Container Won't Start:**
```bash
# Check container logs
docker logs whorang-backend

# Check if port is available
docker run --rm -p 3001:3001 alpine:latest sleep 5

# Check volume permissions
ls -la ./whorang-data/
sudo chown -R 1000:1000 ./whorang-data/
```

**Integration Files Not Copied:**
```bash
# Verify volume mapping
docker inspect whorang-backend | grep -A 10 Mounts

# Manual copy if needed
docker cp whorang-backend:/app/custom_components ./config/
```

## 🏠 Integration Problems

### **Integration Not Discovered**

**Symptoms:**
- No "WhoRang AI Doorbell" in discovered integrations
- Manual integration setup required

**Solutions:**

1. **Verify Add-on is Running:**
   ```bash
   curl http://localhost:3001/health
   # Should return JSON response
   ```

2. **Check Integration Files:**
   ```bash
   ls -la /config/custom_components/whorang/
   # Should contain Python files and manifest.json
   ```

3. **Restart Home Assistant:**
   ```bash
   ha core restart
   # Or use UI: Settings → System → Restart
   ```

4. **Manual Integration Setup:**
   ```
   Settings → Devices & Services → Add Integration
   Search: "WhoRang AI Doorbell"
   Host: localhost, Port: 3001
   ```

### **Entities Not Created**

**Symptoms:**
- Integration shows "Connected" but no entities
- Missing sensors, buttons, or camera
- Entity count less than 19

**Solutions:**

1. **Check Integration Configuration:**
   ```
   Settings → Devices & Services → WhoRang → Configure
   Verify host, port, and connection settings
   ```

2. **Reload Integration:**
   ```
   Settings → Devices & Services → WhoRang → ⋮ → Reload
   ```

3. **Check Backend API:**
   ```bash
   curl http://localhost:3001/api/stats
   # Should return statistics data
   ```

4. **Enable Debug Logging:**
   ```yaml
   # configuration.yaml
   logger:
     default: info
     logs:
       custom_components.whorang: debug
   ```

### **Entities Show "Unavailable"**

**Symptoms:**
- Entities exist but show "Unavailable" status
- No data updates from backend

**Solutions:**

1. **Check WebSocket Connection:**
   ```yaml
   # Integration options
   websocket_enabled: true
   ```

2. **Verify API Connectivity:**
   ```bash
   curl http://localhost:3001/api/health
   curl http://localhost:3001/api/stats
   ```

3. **Check Network Configuration:**
   ```yaml
   # Add-on configuration
   cors_enabled: true
   cors_origins:
     - "*"
   ```

4. **Restart Both Services:**
   ```bash
   # Restart add-on first, then integration
   ha addons restart whorang
   # Then reload integration in UI
   ```

## 👤 Face Detection Issues

### **No Faces Detected**

**Symptoms:**
- AI analysis completes but finds no faces
- Face gallery remains empty
- "0 faces detected" in logs

**Solutions:**

1. **Check Image Quality:**
   - Ensure faces are clearly visible
   - Minimum face size: 30x30 pixels
   - Good lighting conditions
   - Not too blurry or pixelated

2. **Adjust Detection Threshold:**
   ```yaml
   # Lower threshold for more sensitive detection
   face_recognition_threshold: 0.4
   ```

3. **Test with Different AI Provider:**
   ```yaml
   # Try OpenAI for better accuracy
   ai_provider: openai
   openai_api_key: "sk-your-key"
   ```

4. **Check AI Provider Logs:**
   ```bash
   # Look for AI provider errors
   docker logs whorang-backend | grep -i "ai\|face\|detection"
   ```

### **Face Images Not Loading**

**Symptoms:**
- Face detection works but images show as "?"
- Broken image icons in Face Manager
- 404 errors for face image URLs

**Solutions:**

1. **Configure Public URL:**
   ```yaml
   # Add-on configuration
   public_url: "http://192.168.1.100:3001"
   ```

2. **Check Image Paths:**
   ```bash
   # Verify face images exist
   ls -la /data/uploads/faces/
   
   # Check permissions
   chmod 755 /data/uploads/faces/
   ```

3. **Test Image URLs:**
   ```bash
   # Test direct image access
   curl -I http://localhost:3001/uploads/faces/face_123.jpg
   ```

4. **Clear Browser Cache:**
   - Hard refresh (Ctrl+F5)
   - Clear browser cache
   - Try incognito/private mode

### **Poor Face Recognition Accuracy**

**Symptoms:**
- Same person not recognized consistently
- False positives/negatives
- Low confidence scores

**Solutions:**

1. **Improve Training Data:**
   - Label more face examples per person
   - Use high-quality, well-lit images
   - Include different angles and expressions

2. **Adjust Recognition Threshold:**
   ```yaml
   # Lower for more matches, higher for fewer false positives
   face_recognition_threshold: 0.7  # Default: 0.6
   ```

3. **Use Better AI Provider:**
   ```yaml
   # OpenAI generally has better accuracy
   ai_provider: openai
   ```

4. **Check Face Quality:**
   - Minimum 100x100 pixels
   - Clear, unobstructed faces
   - Good contrast and lighting

## ⚡ Performance Problems

### **Slow Face Detection**

**Symptoms:**
- AI analysis takes >30 seconds
- Timeout errors in logs
- Poor system responsiveness

**Solutions:**

1. **Increase Timeout:**
   ```yaml
   ai_analysis_timeout: 60  # Increase from default 30
   ```

2. **Optimize AI Provider:**
   ```yaml
   # Use faster models
   openai_model: gpt-4o-mini    # Faster than gpt-4o
   gemini_model: gemini-1.5-flash  # Faster than gemini-1.5-pro
   ```

3. **Reduce Image Size:**
   ```yaml
   # Resize images before processing
   image_resize_max: 800  # Default: 1024
   jpeg_quality: 75       # Default: 85
   ```

4. **Check System Resources:**
   ```bash
   # Monitor CPU and memory usage
   htop
   docker stats whorang-backend
   ```

### **High Memory Usage**

**Symptoms:**
- System becomes slow or unresponsive
- Out of memory errors
- Container restarts

**Solutions:**

1. **Increase Memory Allocation:**
   ```yaml
   # Docker Compose
   deploy:
     resources:
       limits:
         memory: 4G
   ```

2. **Enable Memory Cleanup:**
   ```yaml
   # Add-on configuration
   cleanup_interval: 1800  # Clean up every 30 minutes
   max_cached_images: 50   # Reduce cache size
   ```

3. **Optimize Processing:**
   ```yaml
   max_concurrent_requests: 2  # Reduce from default 5
   enable_caching: false       # Disable if memory constrained
   ```

### **Database Performance Issues**

**Symptoms:**
- Slow query responses
- Database lock errors
- High disk I/O

**Solutions:**

1. **Database Maintenance:**
   ```bash
   # Access database
   sqlite3 /data/whorang.db
   
   # Optimize database
   VACUUM;
   REINDEX;
   
   # Check database size
   .dbinfo
   ```

2. **Clean Old Data:**
   ```yaml
   # Configure data retention
   retention:
     visitor_events_days: 30    # Keep only 30 days
     face_images_days: 90       # Keep face images 90 days
   ```

3. **Check Disk Space:**
   ```bash
   df -h /data/
   # Ensure sufficient free space (>1GB recommended)
   ```

## 🌐 Network and Connectivity

### **Cannot Access Web Interface**

**Symptoms:**
- Browser shows "Connection refused"
- Timeout when accessing http://ip:3001
- 502/503 errors

**Solutions:**

1. **Check Port Accessibility:**
   ```bash
   # Test from Home Assistant host
   curl http://localhost:3001/health
   
   # Test from another device
   curl http://192.168.1.100:3001/health
   ```

2. **Verify Firewall Settings:**
   ```bash
   # Check if port 3001 is open
   netstat -tlnp | grep 3001
   
   # Open port if needed (varies by system)
   ufw allow 3001
   ```

3. **Check Add-on Network Mode:**
   ```yaml
   # Ensure add-on has network access
   network_mode: host  # For Docker
   ```

### **WebSocket Connection Issues**

**Symptoms:**
- Entities don't update in real-time
- "WebSocket connection failed" in logs
- Manual refresh required for updates

**Solutions:**

1. **Enable WebSocket:**
   ```yaml
   # Add-on configuration
   websocket_enabled: true
   
   # Integration options
   websocket_enabled: true
   ```

2. **Check WebSocket Endpoint:**
   ```javascript
   // Test WebSocket connection
   const ws = new WebSocket('ws://192.168.1.100:3001/ws');
   ws.onopen = () => console.log('Connected');
   ws.onerror = (error) => console.log('Error:', error);
   ```

3. **Proxy Configuration:**
   ```yaml
   # If using reverse proxy, ensure WebSocket support
   proxy_set_header Upgrade $http_upgrade;
   proxy_set_header Connection "upgrade";
   ```

## 🤖 AI Provider Issues

### **OpenAI API Errors**

**Common Errors:**
- "Invalid API key"
- "Rate limit exceeded"
- "Insufficient quota"

**Solutions:**

1. **Verify API Key:**
   ```bash
   # Test API key directly
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer sk-your-api-key"
   ```

2. **Check Quota and Billing:**
   - Visit [OpenAI Usage Dashboard](https://platform.openai.com/usage)
   - Ensure sufficient credits
   - Check rate limits

3. **Adjust Request Settings:**
   ```yaml
   openai_max_tokens: 500      # Reduce token usage
   openai_temperature: 0.1     # More deterministic responses
   ```

### **Ollama Connection Issues**

**Symptoms:**
- "Connection refused" to Ollama
- "Model not found" errors
- Slow local processing

**Solutions:**

1. **Verify Ollama Installation:**
   ```bash
   # Check if Ollama is running
   curl http://localhost:11434/api/tags
   
   # Start Ollama if needed
   ollama serve
   ```

2. **Pull Required Models:**
   ```bash
   # Pull vision-capable models
   ollama pull llava-phi3
   ollama pull llava:latest
   
   # List available models
   ollama list
   ```

3. **Configure Ollama Host:**
   ```yaml
   # If Ollama is on different host
   ollama_host: 192.168.1.50
   ollama_port: 11434
   ```

### **Gemini API Issues**

**Common Problems:**
- Duplicate face detections
- Inconsistent response format
- Safety filter blocks

**Solutions:**

1. **Configure Response Format:**
   ```yaml
   # Force JSON responses
   gemini_response_format: json
   ```

2. **Adjust Safety Settings:**
   ```yaml
   gemini_safety_settings: block_none
   ```

3. **Enable Deduplication:**
   ```yaml
   enable_face_deduplication: true
   duplicate_similarity_threshold: 0.8
   ```

## 💾 Database Problems

### **Database Corruption**

**Symptoms:**
- "Database is locked" errors
- Corrupted data responses
- Add-on crashes on database access

**Solutions:**

1. **Check Database Integrity:**
   ```bash
   sqlite3 /data/whorang.db "PRAGMA integrity_check;"
   ```

2. **Repair Database:**
   ```bash
   # Backup current database
   cp /data/whorang.db /data/whorang.db.backup
   
   # Repair database
   sqlite3 /data/whorang.db ".recover" | sqlite3 /data/whorang_recovered.db
   mv /data/whorang_recovered.db /data/whorang.db
   ```

3. **Reset Database:**
   ```bash
   # Last resort: delete and recreate
   rm /data/whorang.db
   # Restart add-on to recreate database
   ```

### **Data Persistence Issues**

**Symptoms:**
- Data lost after restart
- Database resets to empty
- Face images disappear

**Solutions:**

1. **Check Volume Mapping:**
   ```bash
   # Verify data directory is persistent
   ls -la /data/
   
   # For Docker, check volume mapping
   docker inspect whorang-backend | grep -A 10 Mounts
   ```

2. **Fix Permissions:**
   ```bash
   chown -R node:node /data/
   chmod -R 755 /data/
   ```

3. **Enable Database Backups:**
   ```yaml
   backup_enabled: true
   backup_interval: 86400  # Daily backups
   max_backups: 7         # Keep 7 days
   ```

## 📋 Log Analysis

### **Enable Debug Logging**

```yaml
# Add-on configuration
log_level: debug

# Home Assistant configuration.yaml
logger:
  default: info
  logs:
    custom_components.whorang: debug
    whorang: debug
```

### **Key Log Patterns**

**Successful Operation:**
```
[INFO] WhoRang backend started successfully
[INFO] Database connected: /data/whorang.db
[INFO] AI provider initialized: openai
[INFO] WebSocket server listening on port 3001
```

**Common Error Patterns:**
```
[ERROR] Database connection failed
[ERROR] AI provider authentication failed
[ERROR] Face detection timeout
[ERROR] WebSocket connection refused
[ERROR] File permission denied
```

### **Log Locations**

```bash
# Add-on logs
# Settings → Add-ons → WhoRang → Logs

# Docker container logs
docker logs whorang-backend

# Home Assistant logs
tail -f /config/home-assistant.log | grep -i whorang

# System logs
journalctl -u home-assistant@homeassistant -f
```

## 📞 Getting Help

### **Before Reporting Issues**

1. **Collect System Information:**
   ```bash
   # Home Assistant version
   ha info
   
   # System architecture
   uname -a
   
   # Available resources
   free -h && df -h
   ```

2. **Gather Relevant Logs:**
   ```bash
   # Add-on logs (last 100 lines)
   ha addons logs whorang | tail -100
   
   # Home Assistant logs (WhoRang related)
   grep -i whorang /config/home-assistant.log | tail -50
   ```

3. **Test Basic Functionality:**
   ```bash
   # API health check
   curl http://localhost:3001/health
   
   # Integration status
   # Check entity count and availability
   ```

### **Support Channels**

- **GitHub Issues**: [Report bugs](https://github.com/Beast12/whorang-addon/issues)
- **GitHub Discussions**: [Community support](https://github.com/Beast12/whorang-addon/discussions)
- **Documentation**: [Complete guides](https://github.com/Beast12/whorang-addon/tree/main/docs)

### **Issue Report Template**

```markdown
**System Information:**
- Home Assistant version: 
- WhoRang version: 
- Installation method: (Add-on/Docker/Manual)
- Architecture: (amd64/arm64/armv7)

**Problem Description:**
- What were you trying to do?
- What happened instead?
- When did this start occurring?

**Configuration:**
```yaml
# Your relevant configuration (remove API keys)
```

**Logs:**
```
# Relevant log entries
```

**Steps to Reproduce:**
1. 
2. 
3. 

**Additional Context:**
- Screenshots if applicable
- Network setup details
- Other relevant information
```

---

**Still having issues?** Don't hesitate to reach out to the community - we're here to help make your WhoRang system work perfectly!
