
const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');

// Import configuration and utilities
const configReader = require('./utils/configReader');
const pathValidator = require('./utils/pathValidator');

// Import modules
const { initializeDatabase, closeDatabase } = require('./config/database');
const { initializeWebSocket } = require('./websocket/handler');
const apiRoutes = require('./routes/api');
const { router: webhookRoutes, handleCustomWebhookPaths } = require('./routes/webhook');

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
      if (origin.includes('localhost') || origin.includes('127.0.0.1') || 
          origin.includes('192.168.') || origin.includes('10.0.') || 
          origin.includes('172.16.')) {
        console.log(`✅ CORS allowed (dev): ${origin}`);
        return callback(null, true);
      }
      
      console.log(`❌ CORS rejected: ${origin}`);
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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Forwarded-For', 'X-Forwarded-Proto', 'X-Webhook-Token'],
  exposedHeaders: ['X-Total-Count', 'X-Page', 'X-Per-Page']
}));

// Enhanced CORS middleware with immediate header setting
app.use((req, res, next) => {
  const origin = req.get('origin');
  
  // Set CORS headers immediately for permissive mode
  if (effectiveCorsMode === 'permissive') {
    const allowOrigin = origin || '*';
    res.header('Access-Control-Allow-Origin', allowOrigin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Forwarded-For, X-Forwarded-Proto, X-Webhook-Token');
    
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
      'x-real-ip': req.get('x-real-ip'),
      origin: req.get('origin'),
      host: req.get('host')
    });
  }
  next();
});

app.use(express.json());

// Custom webhook path handler (must be before API routes)
app.use(handleCustomWebhookPaths);

// API Routes
app.use('/api', apiRoutes);

// Webhook Routes
app.use('/api/webhook', webhookRoutes);

// Handle HTML page routes BEFORE static middleware
app.get('/faces.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'faces.html'));
});

app.get('/persons.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'persons.html'));
});

app.get('/settings.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'settings.html'));
});

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Serve uploaded files using user-configured path with fallback
const directoryManager = require('./utils/directoryManager');
const uploadsPath = directoryManager.getEffectiveBasePath();
console.log(`📁 Serving uploads from: ${uploadsPath}`);
app.use('/uploads', express.static(uploadsPath));

// Fallback route for SPA - serve index.html for any unmatched routes
app.get('*', (req, res, next) => {
  // Skip API routes and specific file extensions
  if (req.path.startsWith('/api/') || 
      req.path.startsWith('/uploads/') ||
      req.path.endsWith('.js') || 
      req.path.endsWith('.css') || 
      req.path.endsWith('.png') || 
      req.path.endsWith('.jpg') || 
      req.path.endsWith('.ico') ||
      req.path.endsWith('.svg')) {
    return next();
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint for load balancers
app.get('/health', (req, res) => {
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
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        WHORANG_ADDON_MODE: process.env.WHORANG_ADDON_MODE,
        DATA_WRITABLE: process.env.DATA_WRITABLE,
        PORT: process.env.PORT
      }
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
    const directoryManager = require('./utils/directoryManager');
    const databaseManager = require('./utils/databaseManager');
    const uploadMiddleware = require('./middleware/upload');
    
    const status = {
      timestamp: new Date().toISOString(),
      directoryManager: directoryManager.getStatus(),
      databaseManager: databaseManager.getStatus(),
      uploadMiddleware: uploadMiddleware.getStatus ? uploadMiddleware.getStatus() : 'Status not available',
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        UPLOADS_PATH: process.env.UPLOADS_PATH,
        DATABASE_PATH: process.env.DATABASE_PATH,
        DATA_UPLOADS_WRITABLE: process.env.DATA_UPLOADS_WRITABLE,
        DATA_WRITABLE: process.env.DATA_WRITABLE
      },
      persistenceWarnings: []
    };
    
    // Add persistence warnings
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
server.listen(PORT, '0.0.0.0', () => {
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
      const databaseManager = require('./utils/databaseManager');
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
