# WhoRang v2.0.0 Migration Guide

**Migrating from separate repositories to the consolidated solution**

This guide helps you migrate from the previous two-repository setup (whorang-addon + whorang-integration) to the new consolidated v2.0.0 solution.

## 🎯 What Changed

### Before v2.0.0
- **Two Repositories**: `whorang-addon` (backend) + `whorang-integration` (frontend)
- **Manual Installation**: Install addon, then manually install integration via HACS
- **Version Coordination**: Ensure compatible versions between backend and integration
- **Separate Updates**: Update addon and integration independently

### After v2.0.0
- **Single Repository**: Everything in `whorang-addon` repository
- **Automatic Installation**: Install addon → integration appears automatically
- **Synchronized Versions**: Backend and integration always compatible
- **Unified Updates**: Single update process for complete system

## 🚀 Migration Paths

### Path A: Home Assistant OS/Supervised Users (Recommended)

This is the easiest migration path with minimal downtime.

#### Step 1: Backup Current Configuration
```bash
# Backup your current settings
cp /config/.storage/core.config_entries /config/.storage/core.config_entries.backup
cp -r /config/custom_components/whorang /config/custom_components/whorang.backup
```

#### Step 2: Remove Old Integration
1. Go to **Settings → Devices & Services**
2. Find **WhoRang AI Doorbell** integration
3. Click **⋮** → **Delete**
4. Confirm deletion

#### Step 3: Update Addon Repository
1. Go to **Settings → Add-ons → Add-on Store**
2. Click **⋮** → **Repositories**
3. The repository URL remains the same: `https://github.com/Beast12/whorang-addon`
4. Click **Reload** to refresh available addons

#### Step 4: Update Addon
1. Go to **WhoRang AI Doorbell** addon
2. Click **Update** (you should see v2.0.0 available)
3. Wait for update to complete
4. **Start** the addon

#### Step 5: Integration Auto-Discovery
1. Go to **Settings → Devices & Services**
2. You should see **WhoRang AI Doorbell** discovered automatically
3. Click **Configure** and enter your AI API keys
4. All your entities will be recreated with the same names

#### Step 6: Verify Migration
- Check that all 19+ entities are present
- Verify face gallery data is intact
- Test AI analysis functionality
- Confirm automations still work

### Path B: Docker Users

For users running WhoRang via Docker Compose or standalone containers.

#### Step 1: Backup Data
```bash
# Backup your data directory
cp -r ./whorang-data ./whorang-data.backup

# Backup integration files
cp -r ./config/custom_components/whorang ./config/custom_components/whorang.backup
```

#### Step 2: Update Docker Image
```bash
# Pull new consolidated image
docker pull ghcr.io/beast12/whorang-backend:2.0.0

# Stop current container
docker stop whorang-backend
docker rm whorang-backend
```

#### Step 3: Update Docker Compose (if using)
```yaml
version: '3.8'
services:
  whorang:
    image: ghcr.io/beast12/whorang-backend:2.0.0  # Updated version
    container_name: whorang-backend
    restart: unless-stopped
    ports:
      - "3001:3001"
    volumes:
      - ./whorang-data:/data
      - ./config/custom_components:/config/custom_components  # Integration files
    environment:
      - AI_PROVIDER=local
      - LOG_LEVEL=info
```

#### Step 4: Start New Container
```bash
# Using docker run
docker run -d \
  --name whorang-backend \
  --restart unless-stopped \
  -p 3001:3001 \
  -v $(pwd)/whorang-data:/data \
  -v $(pwd)/config/custom_components:/config/custom_components \
  -e AI_PROVIDER=local \
  ghcr.io/beast12/whorang-backend:2.0.0

# Or using docker-compose
docker-compose up -d
```

#### Step 5: Restart Home Assistant
```bash
# Restart Home Assistant to load updated integration
docker restart homeassistant
# or
systemctl restart home-assistant@homeassistant
```

#### Step 6: Reconfigure Integration
1. Remove old integration from **Settings → Devices & Services**
2. Add new integration (should auto-discover at localhost:3001)
3. Configure AI API keys
4. Verify all entities are working

## 🔧 Configuration Migration

### AI API Keys
Your AI API keys will need to be re-entered in the new integration:

```yaml
# Old location (addon configuration)
openai_api_key: "sk-..."
gemini_api_key: "AIza..."

# New location (integration options)
# Configure via Settings → Devices & Services → WhoRang → Configure
```

### Ollama Configuration
Ollama settings are now configured in the integration options:

```yaml
# Old: Addon configuration
ollama_url: "http://192.168.1.100:11434"

# New: Integration options
ollama_host: "192.168.1.100"
ollama_port: 11434
```

### Automation Updates
Most automations will continue working, but some service calls may need updates:

```yaml
# Old service calls (still work)
service: whorang.trigger_analysis
service: whorang.process_doorbell_event

# New enhanced services (recommended)
service: whorang.label_face
data:
  face_id: 123
  person_name: "John Doe"

service: whorang.batch_label_faces
data:
  face_ids: [123, 124, 125]
  person_name: "Jane Smith"
```

## 📊 Data Preservation

### What's Preserved
- ✅ **Face Recognition Database**: All known persons and face data
- ✅ **Visitor History**: Complete visitor logs and statistics
- ✅ **AI Usage Statistics**: Cost tracking and performance metrics
- ✅ **Configuration Settings**: AI provider preferences and thresholds
- ✅ **Face Gallery**: All face crops and thumbnails

### What's Reset
- ⚠️ **Integration Configuration**: Need to re-enter API keys
- ⚠️ **Entity History**: Home Assistant entity history starts fresh
- ⚠️ **Dashboard Cards**: May need to re-add custom cards

## 🚨 Troubleshooting Migration Issues

### Integration Not Auto-Discovered
```bash
# Check addon is running
docker ps | grep whorang

# Check integration files are present
ls -la /config/custom_components/whorang/

# Restart Home Assistant
systemctl restart home-assistant@homeassistant
```

### Entities Not Appearing
1. **Check Integration Status**: Settings → Devices & Services → WhoRang
2. **Verify Connection**: Integration should show "Connected"
3. **Check Logs**: Look for errors in Home Assistant logs
4. **Reload Integration**: Try removing and re-adding integration

### Face Data Missing
```bash
# Check data directory
ls -la /data/uploads/faces/

# Verify database
sqlite3 /data/whorang.db ".tables"

# Check permissions
chown -R node:node /data/
```

### API Keys Not Working
1. **Re-enter Keys**: Go to integration options and re-enter API keys
2. **Test Keys**: Use the built-in API key validation
3. **Check Quotas**: Verify API quotas haven't been exceeded
4. **Try Different Provider**: Test with local Ollama first

## 🔄 Rollback Plan

If you encounter issues, you can rollback to the previous setup:

### Step 1: Stop New Version
```bash
# Stop v2.0.0 addon
docker stop whorang-backend
```

### Step 2: Restore Backups
```bash
# Restore integration files
rm -rf /config/custom_components/whorang
cp -r /config/custom_components/whorang.backup /config/custom_components/whorang

# Restore data
rm -rf ./whorang-data
cp -r ./whorang-data.backup ./whorang-data
```

### Step 3: Reinstall Previous Versions
1. **Addon**: Install previous version from addon store
2. **Integration**: Reinstall via HACS
3. **Configuration**: Restore from backup

## ✅ Post-Migration Checklist

After successful migration, verify these items:

- [ ] **Addon Running**: v2.0.0 addon is running and healthy
- [ ] **Integration Connected**: Shows "Connected" status
- [ ] **All Entities Present**: 19+ entities across 6 platforms
- [ ] **Face Gallery Working**: Can view and manage faces
- [ ] **AI Analysis Working**: Can trigger analysis and get results
- [ ] **Automations Working**: Existing automations still function
- [ ] **Custom Cards Working**: Dashboard cards display correctly
- [ ] **WebSocket Updates**: Real-time updates functioning
- [ ] **API Keys Valid**: All AI providers working
- [ ] **Cost Tracking**: Usage statistics updating

## 🎉 Benefits After Migration

Once migrated, you'll enjoy these benefits:

### 🚀 Simplified Management
- **One-Click Updates**: Update everything at once
- **No Version Conflicts**: Backend and integration always compatible
- **Unified Documentation**: Everything in one place

### 🔧 Enhanced Features
- **Auto-Discovery**: Integration appears automatically
- **Better Error Handling**: Improved error messages and recovery
- **Enhanced Services**: More automation services available
- **Improved Performance**: Optimized communication between components

### 📈 Future-Proof
- **Easier Maintenance**: Single repository to maintain
- **Faster Development**: New features deployed together
- **Better Testing**: Complete system tested as one unit

## 🆘 Need Help?

If you encounter issues during migration:

1. **Check Logs**: Enable debug logging for detailed information
2. **GitHub Issues**: [Report migration problems](https://github.com/Beast12/whorang-addon/issues)
3. **Discussions**: [Ask for help](https://github.com/Beast12/whorang-addon/discussions)
4. **Documentation**: [Review troubleshooting guide](README.md#troubleshooting)

## 📝 Migration Success Stories

Share your migration experience to help others:

```yaml
# Example successful migration
Migration Time: ~15 minutes
Downtime: ~5 minutes
Issues: None
Result: All entities working, face data preserved
Recommendation: Follow Path A for HA OS users
```

---

**Welcome to WhoRang v2.0.0 - The Complete Solution! 🎉**

*Your migration helps make WhoRang better for everyone. Thank you for upgrading!*
