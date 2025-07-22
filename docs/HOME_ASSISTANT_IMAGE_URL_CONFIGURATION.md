# Home Assistant Add-on Image URL Configuration

## 🎯 Overview

The WhoRang add-on now supports configurable image URLs through the `public_url` option. This allows users to customize how face images are served, which is essential for proper image loading in different deployment scenarios.

## 🔧 Configuration Options

### **Option 1: Using Home Assistant Add-on Configuration UI**

1. **Navigate to Add-ons:**
   - Go to **Settings** → **Add-ons** → **WhoRang AI Doorbell**

2. **Open Configuration Tab:**
   - Click on the **Configuration** tab

3. **Add Public URL Setting:**
   ```yaml
   public_url: "http://your-homeassistant-ip:3001"
   ```

4. **Save and Restart:**
   - Click **Save**
   - Restart the add-on

### **Option 2: Using YAML Configuration**

Edit your add-on configuration directly:

```yaml
ssl: false
certfile: fullchain.pem
keyfile: privkey.pem
ai_provider: local
log_level: info
database_path: /data/whorang.db
uploads_path: /data/uploads
max_upload_size: 10MB
face_recognition_threshold: 0.6
ai_analysis_timeout: 30
websocket_enabled: true
cors_enabled: true
cors_origins:
  - "*"
public_url: "http://192.168.1.100:3001"  # Your Home Assistant IP
```

## 🌐 Common Configuration Examples

### **For Local Network Access:**
```yaml
public_url: "http://192.168.1.100:3001"
```
*Replace `192.168.1.100` with your Home Assistant's IP address*

### **For Domain-based Access:**
```yaml
public_url: "http://homeassistant.local:3001"
```

### **For HTTPS with Custom Domain:**
```yaml
public_url: "https://your-domain.com:3001"
```

### **For Different Port (if changed):**
```yaml
public_url: "http://192.168.1.100:8080"
```

### **For Ingress/Proxy Setup:**
```yaml
public_url: "https://your-domain.com/whorang"
```

## 🔍 How to Find Your Home Assistant IP

### **Method 1: Home Assistant UI**
1. Go to **Settings** → **System** → **Network**
2. Look for your IP address under network interfaces

### **Method 2: Router Admin Panel**
1. Access your router's admin interface
2. Look for connected devices
3. Find "Home Assistant" or your device name

### **Method 3: Command Line (if SSH enabled)**
```bash
hostname -I
```

## 🎯 When to Use Custom Public URL

### **✅ Use Custom Public URL When:**
- Accessing WhoRang from different devices on your network
- Face images show as broken/placeholder icons
- Using custom domains or reverse proxies
- Running Home Assistant on non-standard ports
- Using HTTPS with custom certificates

### **❌ Leave Empty When:**
- Only accessing through Home Assistant ingress
- Default auto-detection works correctly
- Using standard localhost setup

## 🔧 Troubleshooting

### **Images Not Loading:**
1. **Check your Public URL setting:**
   ```yaml
   public_url: "http://YOUR_HA_IP:3001"
   ```

2. **Verify the URL is accessible:**
   - Open `http://YOUR_HA_IP:3001` in your browser
   - You should see the WhoRang interface

3. **Check add-on logs:**
   - Look for: `"Using custom public URL: http://YOUR_HA_IP:3001"`

### **Still Having Issues:**
1. **Try without public_url first:**
   ```yaml
   public_url: ""
   ```
   
2. **Check browser console for errors**

3. **Verify network connectivity**

## 📋 Configuration Schema

The `public_url` option accepts:
- **Type:** String (optional)
- **Format:** Full URL including protocol and port
- **Examples:**
  - `http://192.168.1.100:3001`
  - `https://homeassistant.local:3001`
  - `http://your-domain.com:8080`
- **Default:** Empty (auto-detection)

## 🚀 Advanced Configurations

### **Reverse Proxy Setup:**
If using a reverse proxy (nginx, Apache, etc.):
```yaml
public_url: "https://your-domain.com/whorang"
```

### **Docker Network Setup:**
For complex Docker networking:
```yaml
public_url: "http://whorang-backend:3001"
```

### **Multiple Network Interfaces:**
Choose the interface accessible to your clients:
```yaml
public_url: "http://192.168.1.100:3001"  # Main network
# OR
public_url: "http://10.0.0.100:3001"     # IoT network
```

## 📝 Configuration Validation

After setting `public_url`, verify it works:

1. **Check Add-on Logs:**
   ```
   [INFO] Using custom public URL: http://192.168.1.100:3001
   ```

2. **Test Image URLs:**
   - Open WhoRang Face Manager
   - Images should load without placeholder icons

3. **API Test:**
   ```bash
   curl http://192.168.1.100:3001/api/faces/gallery
   ```
   Should return image URLs with your configured domain.

## 🎯 Best Practices

1. **Use IP addresses** for local network access
2. **Use domain names** for external/remote access
3. **Include port numbers** unless using standard ports (80/443)
4. **Test configuration** after changes
5. **Keep logs enabled** during initial setup for troubleshooting

## 🔄 Migration from Previous Versions

If upgrading from a version without `public_url` support:

1. **Images were broken before:** Set `public_url` to your Home Assistant IP
2. **Images worked before:** Leave `public_url` empty initially
3. **Test thoroughly** after upgrade
4. **Configure as needed** based on your setup

The add-on will automatically handle the transition and provide helpful logging to guide configuration.
