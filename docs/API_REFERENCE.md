# WhoRang Backend API Reference

Complete API documentation for the WhoRang AI Doorbell Backend service.

## 🔗 Base URL

- **Add-on**: `http://homeassistant.local:3001`
- **Docker**: `http://your-docker-host:3001`
- **SSL**: `https://homeassistant.local:3001`

## 🔐 Authentication

Most endpoints are public for local access. If API key authentication is configured:

```http
Authorization: Bearer your-api-key-here
```

## 📊 Core Analysis Endpoints

### POST /api/analysis
**Main AI analysis endpoint with multi-provider support**

```http
POST /api/analysis
Content-Type: multipart/form-data

{
  "image": <file>,
  "provider": "openai|ollama|gemini|claude|google-cloud-vision",
  "model": "gpt-4o|llava|gemini-1.5-pro|claude-3.5-sonnet",
  "options": {
    "face_detection": true,
    "scene_analysis": true,
    "confidence_threshold": 0.6
  }
}
```

**Response:**
```json
{
  "success": true,
  "analysis": {
    "ai_title": "Person at front door",
    "ai_message": "A person wearing a blue jacket is standing at the front door",
    "faces_detected": 1,
    "faces": [
      {
        "id": 123,
        "coordinates": [100, 150, 200, 250],
        "confidence": 0.95,
        "quality_score": 0.87,
        "face_crop_path": "/uploads/faces/face_123.jpg",
        "thumbnail_path": "/uploads/faces/thumb_123.jpg"
      }
    ],
    "processing_time": 1250,
    "provider": "openai",
    "model": "gpt-4o",
    "cost": 0.0025
  }
}
```

### GET /api/models
**Dynamic model discovery for all providers**

```http
GET /api/models
```

**Response:**
```json
{
  "success": true,
  "models": {
    "openai": [
      {
        "id": "gpt-4o",
        "name": "GPT-4o",
        "description": "Latest multimodal model",
        "vision_capable": true,
        "cost_per_1k_tokens": 0.005,
        "deprecated": false
      }
    ],
    "ollama": [
      {
        "id": "llava:latest",
        "name": "LLaVA",
        "size": "4.7GB",
        "vision_capable": true,
        "local": true
      }
    ]
  },
  "cache_expires": "2025-01-12T08:00:00Z"
}
```

### GET /api/models/:provider
**Provider-specific model listing**

```http
GET /api/models/openai
```

## 👤 Face Management Endpoints

### GET /api/faces
**List all detected faces with metadata**

```http
GET /api/faces?limit=50&offset=0&quality_min=0.6&labeled=false
```

**Response:**
```json
{
  "success": true,
  "faces": [
    {
      "id": 123,
      "image_url": "http://backend:3001/uploads/faces/face_123.jpg",
      "thumbnail_url": "http://backend:3001/uploads/faces/thumb_123.jpg",
      "quality_score": 0.87,
      "confidence": 0.95,
      "detection_date": "2025-01-11T08:00:00Z",
      "person_id": null,
      "person_name": null,
      "visitor_event_id": 456,
      "coordinates": [100, 150, 200, 250],
      "ai_provider": "openai",
      "labeled": false
    }
  ],
  "total": 150,
  "page": 1,
  "pages": 3
}
```

### POST /api/faces
**Upload and process new face images**

```http
POST /api/faces
Content-Type: multipart/form-data

{
  "image": <file>,
  "person_name": "John Doe",
  "description": "Family member"
}
```

### GET /api/faces/:id
**Get specific face details**

```http
GET /api/faces/123
```

### DELETE /api/faces/:id
**Remove face from system**

```http
DELETE /api/faces/123
```

### POST /api/faces/:id/label
**Assign person name to face**

```http
POST /api/faces/123/label
Content-Type: application/json

{
  "person_name": "John Doe",
  "create_person": true
}
```

### GET /api/faces/unknown
**Get faces requiring labeling**

```http
GET /api/faces/unknown?limit=50&quality_threshold=0.6
```

### POST /api/faces/similarities
**Find similar faces for labeling assistance**

```http
POST /api/faces/similarities
Content-Type: application/json

{
  "face_id": 123,
  "threshold": 0.7,
  "limit": 10
}
```

**Response:**
```json
{
  "success": true,
  "similar_faces": [
    {
      "face_id": 124,
      "similarity": 0.89,
      "image_url": "http://backend:3001/uploads/faces/face_124.jpg",
      "detection_date": "2025-01-10T15:30:00Z"
    }
  ]
}
```

## 🧑‍🤝‍🧑 Person Management Endpoints

### GET /api/persons
**List all known persons**

```http
GET /api/persons?include_faces=true&include_stats=true
```

**Response:**
```json
{
  "success": true,
  "persons": [
    {
      "id": 1,
      "name": "John Doe",
      "description": "Family member",
      "face_count": 5,
      "recognition_count": 12,
      "last_seen": "2025-01-11T07:30:00Z",
      "first_seen": "2025-01-01T10:00:00Z",
      "avatar_url": "http://backend:3001/uploads/avatars/person_1.jpg",
      "avg_confidence": 0.88,
      "created_at": "2025-01-01T10:00:00Z",
      "updated_at": "2025-01-11T07:30:00Z"
    }
  ]
}
```

### POST /api/persons
**Create new person profile**

```http
POST /api/persons
Content-Type: application/json

{
  "name": "Jane Smith",
  "description": "Neighbor",
  "notes": "Lives next door"
}
```

### GET /api/persons/:id
**Get person details with face count**

```http
GET /api/persons/1?include_faces=true
```

### PUT /api/persons/:id
**Update person information**

```http
PUT /api/persons/1
Content-Type: application/json

{
  "name": "John Doe Jr.",
  "description": "Updated description",
  "notes": "Additional notes"
}
```

### DELETE /api/persons/:id
**Remove person and associated faces**

```http
DELETE /api/persons/1?remove_faces=true
```

### GET /api/persons/:id/avatar
**Get person's avatar image**

```http
GET /api/persons/1/avatar
```

## 🚪 Visitor Tracking Endpoints

### GET /api/visitors
**List recent doorbell events**

```http
GET /api/visitors?limit=50&from_date=2025-01-01&include_faces=true
```

**Response:**
```json
{
  "success": true,
  "visitors": [
    {
      "id": 456,
      "timestamp": "2025-01-11T08:00:00Z",
      "ai_title": "Person at front door",
      "ai_message": "A person wearing a blue jacket is standing at the front door",
      "image_url": "http://backend:3001/uploads/events/event_456.jpg",
      "faces_detected": 1,
      "known_persons": [
        {
          "person_id": 1,
          "person_name": "John Doe",
          "confidence": 0.92
        }
      ],
      "unknown_faces": 0,
      "processing_time": 1250,
      "ai_provider": "openai",
      "cost": 0.0025
    }
  ]
}
```

### GET /api/visitors/:id
**Get specific visitor event details**

```http
GET /api/visitors/456
```

### POST /api/visitors
**Process new doorbell event**

```http
POST /api/visitors
Content-Type: multipart/form-data

{
  "image": <file>,
  "timestamp": "2025-01-11T08:00:00Z",
  "location": "front_door",
  "weather": {
    "temperature": 22,
    "humidity": 65,
    "condition": "sunny"
  }
}
```

### GET /api/visitors/stats
**Visitor statistics and analytics**

```http
GET /api/visitors/stats?period=7d
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "total_visitors": 45,
    "known_visitors": 12,
    "unknown_visitors": 33,
    "recognition_rate": 0.27,
    "avg_faces_per_event": 1.2,
    "busiest_hour": 14,
    "daily_breakdown": [
      {"date": "2025-01-11", "visitors": 8, "known": 3},
      {"date": "2025-01-10", "visitors": 6, "known": 2}
    ]
  }
}
```

## ⚙️ System Management Endpoints

### GET /api/health
**System health check and status**

```http
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 86400,
  "database": {
    "status": "connected",
    "size": "15.2MB",
    "tables": 8
  },
  "storage": {
    "total_space": "50GB",
    "used_space": "2.1GB",
    "free_space": "47.9GB"
  },
  "ai_providers": {
    "openai": "available",
    "ollama": "connected",
    "gemini": "available"
  }
}
```

### GET /api/stats
**Comprehensive usage statistics**

```http
GET /api/stats?period=30d
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "period": "30d",
    "visitors": {
      "total": 234,
      "known": 89,
      "unknown": 145
    },
    "faces": {
      "detected": 312,
      "labeled": 156,
      "quality_avg": 0.78
    },
    "ai_usage": {
      "total_requests": 234,
      "total_cost": 1.45,
      "avg_response_time": 1150,
      "providers": {
        "openai": {"requests": 120, "cost": 0.85},
        "ollama": {"requests": 114, "cost": 0.00}
      }
    },
    "performance": {
      "avg_processing_time": 1150,
      "success_rate": 0.98,
      "error_rate": 0.02
    }
  }
}
```

### GET /api/config
**Current system configuration**

```http
GET /api/config
```

### POST /api/config
**Update system configuration**

```http
POST /api/config
Content-Type: application/json

{
  "face_recognition_threshold": 0.7,
  "ai_analysis_timeout": 45,
  "max_upload_size": "15MB",
  "cleanup_old_files": true,
  "cleanup_days": 30
}
```

### GET /api/database/status
**Database health and metrics**

```http
GET /api/database/status
```

### GET /api/debug/directories
**Database and persistence status monitoring (v1.1.2+)**

```http
GET /api/debug/directories
```

**Response:**
```json
{
  "success": true,
  "timestamp": "2025-01-20T10:30:00.000Z",
  "directoryManager": {
    "primaryBasePath": "/data/uploads",
    "fallbackBasePath": "/app/uploads",
    "effectiveBasePath": "/data/uploads",
    "isDataWritable": true,
    "usedFallback": false
  },
  "databaseManager": {
    "primaryDbPath": "/data/whorang.db",
    "fallbackDbPath": "/app/whorang.db",
    "effectivePath": "/data/whorang.db",
    "isPersistent": true,
    "isDataWritable": true,
    "warning": null
  },
  "uploadMiddleware": {
    "status": "initialized",
    "directory": "/data/uploads/faces",
    "usedFallback": false
  },
  "environment": {
    "NODE_ENV": "production",
    "UPLOADS_PATH": "/data/uploads",
    "DATABASE_PATH": "/data/whorang.db",
    "DATA_UPLOADS_WRITABLE": "true"
  },
  "persistenceWarnings": []
}
```

**Persistence Warning Example:**
```json
{
  "persistenceWarnings": [
    {
      "type": "database",
      "message": "Database is using temporary storage - data will be lost on restart!",
      "effectivePath": "/app/whorang.db",
      "recommendation": "Ensure /data directory is properly mounted and writable"
    },
    {
      "type": "uploads",
      "message": "Uploads are using temporary storage - files will be lost on restart!",
      "effectivePath": "/app/uploads",
      "recommendation": "Ensure /data directory is properly mounted and writable"
    }
  ]
}
```

**Use Cases:**
- **Troubleshooting**: Diagnose data persistence issues
- **Monitoring**: Check if data will survive restarts
- **Docker Validation**: Verify volume mappings are working
- **Health Checks**: Automated monitoring of persistence status

## 🤖 AI Provider Management Endpoints

### GET /api/ai/providers
**List available AI providers**

```http
GET /api/ai/providers
```

**Response:**
```json
{
  "success": true,
  "providers": [
    {
      "id": "openai",
      "name": "OpenAI",
      "status": "available",
      "models": ["gpt-4o", "gpt-4o-mini"],
      "vision_capable": true,
      "cost_per_request": 0.0025,
      "configured": true
    },
    {
      "id": "ollama",
      "name": "Ollama (Local)",
      "status": "connected",
      "models": ["llava:latest", "bakllava:latest"],
      "vision_capable": true,
      "cost_per_request": 0.0,
      "configured": true,
      "host": "localhost:11434"
    }
  ]
}
```

### POST /api/ai/providers/:provider/test
**Test provider connectivity**

```http
POST /api/ai/providers/openai/test
Content-Type: application/json

{
  "api_key": "sk-...",
  "model": "gpt-4o"
}
```

### GET /api/ai/usage
**AI usage statistics and costs**

```http
GET /api/ai/usage?period=7d&provider=all
```

### POST /api/ai/models/refresh
**Refresh model cache**

```http
POST /api/ai/models/refresh
Content-Type: application/json

{
  "provider": "ollama",
  "force": true
}
```

## 🔄 WebSocket Real-time Updates

### Connection
```javascript
const ws = new WebSocket('ws://homeassistant.local:3001/ws');
```

### Events

#### face_detected
```json
{
  "event": "face_detected",
  "data": {
    "face_id": 123,
    "visitor_event_id": 456,
    "quality_score": 0.87,
    "person_recognized": false
  }
}
```

#### person_recognized
```json
{
  "event": "person_recognized",
  "data": {
    "person_id": 1,
    "person_name": "John Doe",
    "confidence": 0.92,
    "visitor_event_id": 456
  }
}
```

#### analysis_complete
```json
{
  "event": "analysis_complete",
  "data": {
    "visitor_event_id": 456,
    "processing_time": 1250,
    "faces_detected": 1,
    "ai_provider": "openai",
    "cost": 0.0025
  }
}
```

#### system_status
```json
{
  "event": "system_status",
  "data": {
    "status": "healthy",
    "ai_providers_online": 3,
    "database_connected": true,
    "storage_available": "47.9GB"
  }
}
```

## 📝 Request/Response Examples

### Complete Face Labeling Workflow

1. **Get Unknown Faces**
```http
GET /api/faces/unknown?limit=10&quality_threshold=0.7
```

2. **Find Similar Faces**
```http
POST /api/faces/similarities
{
  "face_id": 123,
  "threshold": 0.8,
  "limit": 5
}
```

3. **Label Face**
```http
POST /api/faces/123/label
{
  "person_name": "John Doe",
  "create_person": true
}
```

4. **Verify Person Created**
```http
GET /api/persons?name=John%20Doe
```

### Batch Face Processing

1. **Upload Multiple Images**
```http
POST /api/analysis
Content-Type: multipart/form-data
{
  "image": <file1>,
  "provider": "openai",
  "options": {"face_detection": true}
}
```

2. **Process Results**
```http
GET /api/faces?visitor_event_id=456
```

3. **Batch Label Similar Faces**
```http
POST /api/faces/batch-label
{
  "face_ids": [123, 124, 125],
  "person_name": "John Doe"
}
```

## 🚨 Error Handling

### Standard Error Response
```json
{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Face ID not found",
    "details": {
      "face_id": 999,
      "available_faces": [123, 124, 125]
    }
  }
}
```

### Common Error Codes

| Code | Description | HTTP Status |
|------|-------------|-------------|
| `INVALID_REQUEST` | Malformed request data | 400 |
| `UNAUTHORIZED` | Invalid API key | 401 |
| `NOT_FOUND` | Resource not found | 404 |
| `RATE_LIMITED` | Too many requests | 429 |
| `AI_PROVIDER_ERROR` | AI service unavailable | 503 |
| `STORAGE_FULL` | Insufficient storage space | 507 |

## 🔧 Rate Limiting

- **Default**: 100 requests per minute per IP
- **AI Analysis**: 10 requests per minute per IP
- **File Uploads**: 5 requests per minute per IP

Rate limit headers:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1641916800
```

## 📊 Pagination

For endpoints that return lists:

```http
GET /api/faces?page=2&limit=25&sort=quality_score&order=desc
```

Response includes pagination metadata:
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 2,
    "limit": 25,
    "total": 150,
    "pages": 6,
    "has_next": true,
    "has_prev": true
  }
}
```

## 🔍 Filtering and Sorting

### Common Query Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `limit` | Results per page | `?limit=50` |
| `offset` | Skip results | `?offset=100` |
| `sort` | Sort field | `?sort=created_at` |
| `order` | Sort direction | `?order=desc` |
| `from_date` | Start date filter | `?from_date=2025-01-01` |
| `to_date` | End date filter | `?to_date=2025-01-31` |
| `quality_min` | Minimum quality | `?quality_min=0.7` |
| `labeled` | Labeling status | `?labeled=false` |

This comprehensive API provides all the functionality needed to build sophisticated face recognition applications and integrate with Home Assistant or other automation systems.
