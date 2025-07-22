# WhoRang Dashboard Examples

Complete guide to creating beautiful and functional Home Assistant dashboards for your WhoRang AI Doorbell system.

## 📋 Table of Contents

- [Quick Setup](#-quick-setup)
- [Complete Dashboard](#-complete-dashboard)
- [Custom Cards](#-custom-cards)
- [Mobile-Optimized Layout](#-mobile-optimized-layout)
- [Advanced Features](#-advanced-features)
- [Troubleshooting](#-troubleshooting)

## 🚀 Quick Setup

### **Minimal Dashboard**

Perfect for getting started quickly:

```yaml
type: vertical-stack
cards:
  - type: picture-entity
    entity: camera.whorang_latest_image
    name: Latest Visitor
    show_state: false
    tap_action:
      action: more-info
    
  - type: glance
    title: Visitor Statistics
    entities:
      - entity: sensor.whorang_visitor_count_today
        name: Today
      - entity: sensor.whorang_visitor_count_week
        name: Week
      - entity: sensor.whorang_visitor_count_month
        name: Month
      - entity: sensor.whorang_known_faces
        name: Known
        
  - type: entities
    title: Quick Actions
    entities:
      - entity: button.whorang_trigger_analysis
        name: Analyze Now
      - entity: select.whorang_ai_provider
        name: AI Provider
```

### **Status Overview Card**

Monitor system health at a glance:

```yaml
type: entities
title: WhoRang System Status
entities:
  - entity: sensor.whorang_system_status
    name: System Status
    icon: mdi:shield-check
  - entity: binary_sensor.whorang_system_online
    name: Online
  - entity: sensor.whorang_ai_response_time
    name: Response Time
    suffix: ms
  - entity: sensor.whorang_ai_cost_today
    name: AI Cost Today
  - entity: sensor.whorang_last_analysis_time
    name: Last Analysis
```

## 🎨 Complete Dashboard

### **Full-Featured WhoRang Dashboard**

```yaml
title: WhoRang AI Doorbell
path: whorang
icon: mdi:doorbell-video
cards:
  # Header with latest visitor
  - type: horizontal-stack
    cards:
      - type: picture-entity
        entity: camera.whorang_latest_image
        name: Latest Visitor
        show_state: false
        aspect_ratio: "16:9"
        tap_action:
          action: more-info
      - type: vertical-stack
        cards:
          - type: entity
            entity: sensor.whorang_latest_visitor
            name: Latest Analysis
            attribute: ai_message
          - type: glance
            entities:
              - entity: binary_sensor.whorang_doorbell
                name: Doorbell
              - entity: binary_sensor.whorang_motion
                name: Motion
              - entity: binary_sensor.whorang_known_visitor
                name: Known
              - entity: binary_sensor.whorang_ai_processing
                name: Processing

  # Statistics Row
  - type: horizontal-stack
    cards:
      - type: statistic
        entity: sensor.whorang_visitor_count_today
        name: Today's Visitors
        period:
          calendar:
            period: day
      - type: statistic
        entity: sensor.whorang_visitor_count_week
        name: This Week
        period:
          calendar:
            period: week
      - type: statistic
        entity: sensor.whorang_visitor_count_month
        name: This Month
        period:
          calendar:
            period: month
      - type: statistic
        entity: sensor.whorang_known_faces
        name: Known Faces
        
  # Face Management Section
  - type: custom:whorang-face-manager-card
    title: Face Manager
    whorang_url: "http://192.168.1.100:3001"  # Update with your IP
    show_progress: true
    show_quality: true
    batch_mode: true
    
  - type: custom:whorang-known-persons-card
    title: Known Persons
    whorang_url: "http://192.168.1.100:3001"  # Update with your IP
    show_statistics: true
    show_avatars: true
    
  # System Controls
  - type: entities
    title: System Controls
    entities:
      - entity: select.whorang_ai_provider
        name: AI Provider
      - entity: select.whorang_ai_model
        name: AI Model
      - entity: button.whorang_trigger_analysis
        name: Trigger Analysis
      - entity: button.whorang_refresh_data
        name: Refresh Data
      - entity: button.whorang_test_webhook
        name: Test Webhook
        
  # Performance Monitoring
  - type: horizontal-stack
    cards:
      - type: gauge
        entity: sensor.whorang_ai_response_time
        name: Response Time
        min: 0
        max: 10000
        severity:
          green: 0
          yellow: 5000
          red: 8000
        unit: ms
      - type: entity
        entity: sensor.whorang_ai_cost_today
        name: AI Cost Today
        icon: mdi:currency-usd
      - type: entity
        entity: sensor.whorang_ai_cost_month
        name: Monthly Cost
        icon: mdi:chart-line
        
  # Recent Activity
  - type: history-graph
    title: Visitor Activity (24h)
    hours_to_show: 24
    refresh_interval: 300
    entities:
      - entity: binary_sensor.whorang_doorbell
        name: Doorbell
      - entity: binary_sensor.whorang_motion
        name: Motion
      - entity: binary_sensor.whorang_known_visitor
        name: Known Visitor
```

## 🎯 Custom Cards

### **WhoRang Face Manager Card**

The main face management interface:

```yaml
type: custom:whorang-face-manager-card
title: Face Manager
whorang_url: "http://homeassistant.local:3001"
config:
  show_progress: true          # Show labeling progress
  show_quality: true           # Show face quality scores
  batch_mode: true            # Enable batch labeling
  auto_refresh: 30            # Auto-refresh interval (seconds)
  max_faces_display: 20       # Maximum faces to show at once
  quality_threshold: 0.6      # Minimum quality to display
  sort_by: "quality"          # Sort by: quality, date, confidence
  sort_order: "desc"          # Sort order: asc, desc
```

**Features:**
- **Interactive Selection**: Click faces to select (blue border)
- **Batch Operations**: Label multiple faces as same person
- **Quality Filtering**: Hide low-quality faces
- **Progress Tracking**: Visual progress bar
- **Real-time Updates**: Automatic refresh

### **WhoRang Known Persons Card**

Gallery of recognized people:

```yaml
type: custom:whorang-known-persons-card
title: Known Persons
whorang_url: "http://homeassistant.local:3001"
config:
  show_statistics: true       # Show person statistics
  show_avatars: true         # Show person avatars
  show_last_seen: true       # Show last seen dates
  show_confidence: true      # Show recognition confidence
  avatar_size: 80            # Avatar size in pixels
  max_persons: 50            # Maximum persons to display
  sort_by: "last_seen"       # Sort by: name, last_seen, face_count
  sort_order: "desc"         # Sort order: asc, desc
```

**Features:**
- **Person Avatars**: Best face image for each person
- **Statistics**: Face count, last seen, recognition stats
- **Management**: Edit, delete, merge persons
- **Face Gallery**: View all faces for each person

### **WhoRang Simple Face Manager**

Lightweight version for basic needs:

```yaml
type: custom:whorang-face-manager-simple-card
title: Quick Face Labeling
whorang_url: "http://homeassistant.local:3001"
config:
  max_faces: 10              # Show only 10 faces
  hide_labeled: true         # Hide already labeled faces
  simple_mode: true          # Simplified interface
```

## 📱 Mobile-Optimized Layout

### **Mobile Dashboard**

Optimized for phone screens:

```yaml
title: WhoRang Mobile
path: whorang-mobile
icon: mdi:cellphone
panel: false
cards:
  # Compact header
  - type: picture-entity
    entity: camera.whorang_latest_image
    name: Latest Visitor
    show_state: false
    aspect_ratio: "4:3"
    
  # Status indicators
  - type: glance
    show_name: false
    show_state: true
    entities:
      - entity: binary_sensor.whorang_doorbell
        name: Bell
      - entity: binary_sensor.whorang_motion
        name: Motion
      - entity: binary_sensor.whorang_known_visitor
        name: Known
      - entity: sensor.whorang_visitor_count_today
        name: Today
        
  # Quick stats
  - type: entities
    entities:
      - entity: sensor.whorang_latest_visitor
        name: Latest Analysis
        attribute: ai_message
      - entity: sensor.whorang_system_status
        name: System Status
      - entity: sensor.whorang_ai_response_time
        name: Response Time
        suffix: ms
        
  # Mobile face manager
  - type: custom:whorang-face-manager-simple-card
    title: Face Manager
    whorang_url: "http://homeassistant.local:3001"
    config:
      max_faces: 6
      mobile_mode: true
      
  # Quick actions
  - type: entities
    entities:
      - entity: button.whorang_trigger_analysis
        name: Analyze Now
      - entity: select.whorang_ai_provider
        name: AI Provider
```

### **Tablet Layout**

Optimized for larger screens:

```yaml
title: WhoRang Tablet
path: whorang-tablet
icon: mdi:tablet
panel: true
cards:
  - type: grid
    columns: 3
    square: false
    cards:
      # Left column - Latest visitor
      - type: vertical-stack
        cards:
          - type: picture-entity
            entity: camera.whorang_latest_image
            name: Latest Visitor
            aspect_ratio: "16:9"
          - type: entity
            entity: sensor.whorang_latest_visitor
            name: Analysis
            attribute: ai_message
            
      # Middle column - Face management
      - type: custom:whorang-face-manager-card
        title: Face Manager
        whorang_url: "http://homeassistant.local:3001"
        config:
          max_faces_display: 12
          show_progress: true
          
      # Right column - Statistics and controls
      - type: vertical-stack
        cards:
          - type: statistic
            entity: sensor.whorang_visitor_count_today
            name: Today's Visitors
          - type: statistic
            entity: sensor.whorang_visitor_count_week
            name: This Week
          - type: entities
            title: Controls
            entities:
              - select.whorang_ai_provider
              - select.whorang_ai_model
              - button.whorang_trigger_analysis
```

## 🔧 Advanced Features

### **Conditional Cards**

Show cards based on conditions:

```yaml
type: conditional
conditions:
  - entity: binary_sensor.whorang_system_online
    state: "on"
card:
  type: custom:whorang-face-manager-card
  title: Face Manager (Online)
  whorang_url: "http://homeassistant.local:3001"
```

### **Auto-Entities Card**

Dynamically show device trackers for known persons:

```yaml
type: custom:auto-entities
card:
  type: entities
  title: Known Visitors
filter:
  include:
    - entity_id: "device_tracker.whorang_*"
      state: "home"
  exclude: []
sort:
  method: last_changed
  reverse: true
```

### **Mushroom Cards Integration**

Modern card design with Mushroom cards:

```yaml
type: vertical-stack
cards:
  - type: custom:mushroom-title-card
    title: WhoRang AI Doorbell
    subtitle: Intelligent Visitor Recognition
    
  - type: horizontal-stack
    cards:
      - type: custom:mushroom-entity-card
        entity: binary_sensor.whorang_doorbell
        name: Doorbell
        icon: mdi:doorbell
        tap_action:
          action: more-info
      - type: custom:mushroom-entity-card
        entity: binary_sensor.whorang_known_visitor
        name: Known Visitor
        icon: mdi:account-check
      - type: custom:mushroom-entity-card
        entity: sensor.whorang_visitor_count_today
        name: Today
        icon: mdi:counter
        
  - type: custom:mushroom-media-player-card
    entity: camera.whorang_latest_image
    name: Latest Image
    use_media_info: false
```

### **Button Card Customization**

Custom styled buttons:

```yaml
type: custom:button-card
entity: button.whorang_trigger_analysis
name: Analyze Visitor
icon: mdi:face-recognition
color: rgb(68, 115, 158)
size: 30%
styles:
  card:
    - height: 80px
  name:
    - font-size: 14px
    - font-weight: bold
tap_action:
  action: call-service
  service: button.press
  service_data:
    entity_id: button.whorang_trigger_analysis
```

## 📊 Performance Monitoring Dashboard

### **System Health Dashboard**

Monitor WhoRang performance:

```yaml
title: WhoRang Monitoring
path: whorang-monitoring
cards:
  - type: horizontal-stack
    cards:
      - type: gauge
        entity: sensor.whorang_ai_response_time
        name: AI Response Time
        min: 0
        max: 30000
        severity:
          green: 0
          yellow: 10000
          red: 20000
        unit: ms
      - type: gauge
        entity: sensor.whorang_ai_cost_today
        name: Daily AI Cost
        min: 0
        max: 5
        severity:
          green: 0
          yellow: 2
          red: 4
        unit: $
        
  - type: history-graph
    title: Response Time Trend
    hours_to_show: 24
    entities:
      - entity: sensor.whorang_ai_response_time
        name: Response Time
        
  - type: history-graph
    title: Daily Costs
    hours_to_show: 168  # 7 days
    entities:
      - entity: sensor.whorang_ai_cost_today
        name: Daily Cost
        
  - type: entities
    title: System Information
    entities:
      - entity: sensor.whorang_system_status
        name: Status
      - entity: binary_sensor.whorang_system_online
        name: Online
      - entity: sensor.whorang_known_faces
        name: Known Faces
      - entity: sensor.whorang_unknown_faces
        name: Unknown Faces
```

## 🚨 Troubleshooting

### **Cards Not Loading**

**Custom cards not found:**
```bash
# Check if custom cards are installed
ls -la /config/www/community/

# Install missing cards via HACS
# HACS → Frontend → Search for card
```

**Images not displaying:**
```yaml
# Update whorang_url in card configuration
whorang_url: "http://192.168.1.100:3001"  # Use your actual IP
```

### **Performance Issues**

**Slow dashboard loading:**
```yaml
# Reduce refresh intervals
auto_refresh: 60  # Increase from 30 seconds

# Limit displayed items
max_faces_display: 10  # Reduce from 20
```

**Mobile performance:**
```yaml
# Use simple cards on mobile
type: custom:whorang-face-manager-simple-card
config:
  mobile_mode: true
  max_faces: 6
```

### **Configuration Validation**

**Test card configuration:**
```yaml
# Start with minimal configuration
type: custom:whorang-face-manager-card
whorang_url: "http://homeassistant.local:3001"

# Add features gradually
config:
  show_progress: true
  # Add more options one by one
```

**Debug card issues:**
```javascript
// Open browser developer tools (F12)
// Check console for error messages
// Look for network errors or JavaScript errors
```

## 📝 Configuration Tips

### **Best Practices**

1. **Use IP addresses** for whorang_url in local networks
2. **Test cards individually** before combining
3. **Start simple** and add features gradually
4. **Use conditional cards** to handle offline states
5. **Optimize for your screen size** (mobile/tablet/desktop)

### **Common Configurations**

```yaml
# For local network access
whorang_url: "http://192.168.1.100:3001"

# For domain-based access
whorang_url: "http://homeassistant.local:3001"

# For HTTPS setup
whorang_url: "https://your-domain.com:3001"
```

### **Card Refresh Settings**

```yaml
# Conservative (low resource usage)
auto_refresh: 60
max_faces_display: 10

# Balanced (recommended)
auto_refresh: 30
max_faces_display: 20

# Aggressive (high resource usage)
auto_refresh: 15
max_faces_display: 50
```

---

**Dashboard setup complete!** Your WhoRang system now has a beautiful, functional interface for managing your AI doorbell system.
