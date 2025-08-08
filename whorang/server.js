
const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');

// Import configuration and utilities
const configReader = require('./utils/configReader');
const pathValidator = require('./utils/pathValidator');
const directoryManager = require('./utils/directoryManager');
// Import handlers and routers
const { initializeWebSocket, broadcast, getConnectedClients } = require('./websocket/handler');
const { databaseManager, initializeDatabase, closeDatabase, getDatabase } = require('./utils/databaseManager');
const createWebhookRouter = require('./routes/webhook');
const createConfigRouter = require('./routes/config');
const createAnalysisRouter = require('./routes/analysis');
const createFacesRouter = require('./routes/faces');
const createDetectedFacesRouter = require('./routes/detectedFaces');
const createOpenaiRouter = require('./routes/openai');
const createAiRouter = require('./routes/ai');
const { createStatsRouter } = require('./routes/stats');
const systemRouter = require('./routes/system');

// Import controllers for dependency injection
const AnalysisController = require('./controllers/analysisController');
const DetectedFacesController = require('./controllers/detectedFacesController');
const FaceConfigController = require('./controllers/faceConfigController');
const FaceDetectionController = require('./controllers/faceDetectionController');
const OllamaController = require('./controllers/ollamaController');
const OpenaiController = require('./controllers/openaiController');
const PersonController = require('./controllers/personController');
const VisitorLabelingController = require('./controllers/visitorLabelingController');
const uploadMiddleware = require('./middleware/upload');

const app = express();
const server = http.createServer(app);

// Get configuration from user settings (Home Assistant add-on or environment variables)
const config = configReader.getAll();
const PORT = process.env.PORT || 3001;
const CORS_ORIGIN = config.cors_origins.join(',') || 'http://localhost:8080';
const CORS_MODE = process.env.CORS_MODE || 'auto';
const WEBHOOK_PATH = process.env.WEBHOOK_PATH || '/api/webhook/doorbell';
const TRUST_PROXY = process.env.TRUST_PROXY === 'true' || process.env.NODE_ENV === 'production';
const PUBLIC_URL = config.public_url || process.env.PUBLIC_URL || null;

// Log configuration status
console.log('🔧 WhoRang Configuration:');
console.log(`  Database path: ${config.database_path}`);
console.log(`  Uploads path: ${config.uploads_path}`);
console.log(`  AI provider: ${config.ai_provider}`);
console.log(`  Log level: ${config.log_level}`);
console.log(`  WebSocket enabled: ${config.websocket_enabled}`);
console.log(`  CORS enabled: ${config.cors_enabled}`);
console.log(`  Public URL: ${PUBLIC_URL || 'auto-detected'}`);
console.log(`  Running as HA add-on: ${configReader.isHomeAssistantAddon()}`);

// Configure proxy trust for production deployments
if (TRUST_PROXY) {
  app.set('trust proxy', true);
  console.log('Proxy trust enabled for production deployment');
}

// Initialize database
const db = initializeDatabase();

// Initialize WebSocket
const wss = initializeWebSocket(server);

// Enhanced CORS configuration with multiple modes
const corsOrigins = CORS_ORIGIN.split(',').map(origin => origin.trim());

// Determine CORS mode
let effectiveCorsMode = CORS_MODE;
if (CORS_MODE === 'auto') {
  if (CORS_ORIGIN === 'http://localhost:8080') {
    effectiveCorsMode = 'permissive';
  } else {
    effectiveCorsMode = 'strict';
  }
}

// CORS configuration strategies
const corsConfigs = {
  strict: {
    origin: function(origin, callback) {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      
      // Check if origin is in allowed list
      if (corsOrigins.includes(origin)) {
        console.log(`✅ CORS allowed: ${origin}`);
        return callback(null, true);
      }
      
      // For development, allow localhost variants
      if (process.env.NODE_ENV === 'development' && 
          (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
        console.log(`✅ CORS allowed (dev): ${origin}`);
        return callback(null, true);
      }
      
      // Log CORS rejection for debugging
      console.log(`❌ CORS rejected: ${origin}, allowed: ${corsOrigins.join(', ')}`);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true
  },
  permissive: {
    origin: function(origin, callback) {
      // Allow ALL origins in permissive mode (minimal logging)
      return callback(null, origin || '*');
    },
    credentials: false // Safer with open CORS
  },
  development: {
    origin: function(origin, callback) {
      // Allow requests with no origin
      if (!origin) return callback(null, true);
      
      // Allow configured origins
      if (corsOrigins.includes(origin)) {
        console.log(`✅ CORS allowed: ${origin}`);
        return callback(null, true);
      }
      
      // Allow localhost and development variants
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        console.log(`✅ CORS allowed (dev): ${origin}`);
        return callback(null, true);
      }
      
      // Log CORS rejection for debugging
      console.log(`❌ CORS rejected: ${origin}, allowed: ${corsOrigins.join(', ')}`);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true
  }
};

// Apply CORS configuration
const corsConfig = corsConfigs[effectiveCorsMode] || corsConfigs.strict;
app.use(cors({
  ...corsConfig,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'Content-Type', 'X-Request-ID']
}));

// Middleware to handle OPTIONS requests for CORS preflight
app.use((req, res, next) => {
  // Set headers for all responses
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  
  // Check if CORS is enabled
  if (config.cors_enabled) {
    const origin = req.headers.origin;
    if (corsOrigins.includes(origin) || effectiveCorsMode !== 'strict') {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
  }
  
  next();
});

// Middleware for handling proxy headers
app.use((req, res, next) => {
  // Log proxy headers in development
  if (process.env.NODE_ENV === 'development') {
    console.log('Request headers:', {
      'x-forwarded-for': req.get('x-forwarded-for'),
      'x-forwarded-proto': req.get('x-forwarded-proto'),
      'x-forwarded-host': req.get('x-forwarded-host'),
      'host': req.get('host'),
      'origin': req.get('origin')
    });
  }
  next();
});

// Middleware for parsing JSON bodies
app.use(express.json());

// Centralized dependencies for injection
const dependencies = {
  databaseManager,
  getDatabase,
  configManager: configReader,
  directoryManager,
  broadcast,
  // Controllers
  AnalysisController,
  DetectedFacesController,
  FaceConfigController,
  FaceDetectionController,
  OllamaController,
  OpenaiController,
  PersonController,
  VisitorLabelingController,
};

// Initialize and use routers
const { router: webhookRouter, handleCustomWebhookPaths } = createWebhookRouter(dependencies);
// Register webhook middleware for custom path handling
app.use(handleCustomWebhookPaths);
app.use('/api/analysis', createAnalysisRouter(dependencies));
app.use('/api/config', createConfigRouter(dependencies));
app.use('/api/stats', createStatsRouter(dependencies));
app.use('/api/faces', createFacesRouter(dependencies));
app.use('/api/detectedFaces', createDetectedFacesRouter(dependencies));
app.use('/api/openai', createOpenaiRouter(dependencies));
app.use('/api/ai', createAiRouter(dependencies));
app.use('/api/webhook', webhookRouter);

// Register system routes (includes /health endpoint)
app.use('/', systemRouter);

// Serve static assets for frontend
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html for the root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve settings.html for the settings path
app.get('/settings.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'settings.html'));
});

// Serve static files from the effective uploads directory
const uploadsPath = directoryManager.getEffectiveBasePath();
console.log(`📁 Serving uploads from: ${uploadsPath}`);
app.use('/uploads', express.static(uploadsPath));

// Fallback route for SPA - serve index.html for any unmatched routes
app.get('*', (req, res) => {
  // Exclude API routes from SPA fallback
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not Found' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Configuration status endpoint for debugging
app.get('/api/debug/config', (req, res) => {
  try {
    const status = {
      timestamp: new Date().toISOString(),
      configReader: configReader.getStatus(),
      pathValidator: pathValidator.getStatus(),
      configuration: configReader.getAll(),
      cors: {
        mode: effectiveCorsMode,
        configuredMode: CORS_MODE,
        origins: corsOrigins
      },
      publicUrl: PUBLIC_URL
    };
    res.status(200).json(status);
  } catch (error) {
    console.error('Error getting configuration status:', error);
    res.status(500).json({ 
      error: 'Failed to get configuration status',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Directory status endpoint for debugging upload issues
app.get('/api/debug/directories', (req, res) => {
  try {
    const status = {
      timestamp: new Date().toISOString(),
      uploads: directoryManager.getStatus(),
      database: databaseManager.getStatus(),
      uploadMiddleware: uploadMiddleware.getStatus(),
      persistenceWarnings: []
    };
    
    const dbStatus = databaseManager.getStatus();
    if (!dbStatus.isPersistent) {
      status.persistenceWarnings.push({
        type: 'database',
        message: 'Database is using temporary storage - data will be lost on restart!',
        effectivePath: dbStatus.effectivePath,
        recommendation: 'Ensure /data directory is properly mounted and writable'
      });
    }
    
    const dirStatus = directoryManager.getStatus();
    if (!dirStatus.isDataWritable) {
      status.persistenceWarnings.push({
        type: 'uploads',
        message: 'Uploads are using temporary storage - files will be lost on restart!',
        effectivePath: dirStatus.effectiveBasePath,
        recommendation: 'Ensure /data directory is properly mounted and writable'
      });
    }
    
    res.status(200).json(status);
  } catch (error) {
    console.error('Error getting directory status:', error);
    res.status(500).json({ 
      error: 'Failed to get directory status',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Enhanced error handling for production
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  
  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({ message: 'Internal server error' });
  } else {
    res.status(500).json({ message: err.message, stack: err.stack });
  }
});

// Start server
server.listen(PORT, '127.0.0.1', () => {
  console.log(`🔔 WhoRang - AI-Powered Doorbell Intelligence`);
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`CORS Mode: ${effectiveCorsMode} (configured: ${CORS_MODE})`);
  console.log(`CORS Origins: ${corsOrigins.join(', ')}`);
  console.log(`Proxy Trust: ${TRUST_PROXY ? 'enabled' : 'disabled'}`);
  console.log(`Public URL: ${PUBLIC_URL || 'auto-detected from requests'}`);
  console.log(`WebSocket server ready`);
  
  if (!PUBLIC_URL) {
    console.log(`💡 Tip: Set PUBLIC_URL environment variable to configure image URLs`);
    console.log(`   Example: PUBLIC_URL=http://your-domain.com:3001`);
  }
  
  // Set up addon_config symlinks for debugging access (HA add-on best practice)
  if (process.env.WHORANG_ADDON_MODE === 'true' && require('fs').existsSync('/addon_config')) {
    const fs = require('fs');
    const path = require('path');
    
    try {
      // Create symlink to database file for user access
      const dbPath = databaseManager.getEffectivePath();
      const dbSymlinkPath = '/addon_config/database/whorang.db';
      
      // Remove existing symlink if it exists
      if (fs.existsSync(dbSymlinkPath)) {
        fs.unlinkSync(dbSymlinkPath);
      }
      
      // Create new symlink to current database location
      fs.symlinkSync(dbPath, dbSymlinkPath);
      console.log(`🔗 Database symlink created: /addon_config/database/whorang.db -> ${dbPath}`);
      
      // Create debug info file
      const debugInfo = {
        timestamp: new Date().toISOString(),
        version: '2.0.3',
        configuration: configReader.getAll(),
        paths: {
          database: dbPath,
          uploads: uploadsPath,
          nginx_logs: '/tmp/nginx-*.log'
        },
        environment: {
          NODE_ENV: process.env.NODE_ENV,
          WHORANG_ADDON_MODE: process.env.WHORANG_ADDON_MODE,
          DATA_WRITABLE: process.env.DATA_WRITABLE
        }
      };
      
      fs.writeFileSync('/addon_config/debug/system-info.json', JSON.stringify(debugInfo, null, 2));
      console.log(`📋 Debug info created: /addon_config/debug/system-info.json`);
      
    } catch (error) {
      console.warn(`⚠️  Could not set up addon_config symlinks: ${error.message}`);
    }
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  closeDatabase();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  closeDatabase();
  process.exit(0);
});
