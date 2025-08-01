const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

// Import configuration and utilities
const configReader = require('./utils/configReader');
const DirectoryManager = require('./utils/directoryManager');

// Import services
const DatabaseManager = require('./utils/databaseManager');
const FaceProcessingService = require('./services/faceProcessing');
const FaceCroppingServiceSharp = require('./services/faceCroppingServiceSharp');

// Import controllers
const AnalysisController = require('./controllers/analysisController');

// Import routers
const { createWebhookRouter } = require('./routes/webhook');

const createFacesRouter = require('./routes/faces');
const createAnalysisRouter = require('./routes/analysis');
const createConfigRouter = require('./routes/config');

// Import WebSocket handler
const { initializeWebSocket, broadcast } = require('./websocket/handler');

const app = express();
const server = http.createServer(app);
let databaseManager; // To be accessed by gracefulShutdown
let dependencies;

async function startServer() {
  try {
    // --- DEPENDENCY INJECTION CONTAINER ---

    // Initialize core utilities
    
    const directoryManager = new DirectoryManager(configReader);
    await directoryManager.initialize(); // ASYNC INITIALIZATION

    // Initialize services
    databaseManager = new DatabaseManager(configReader);
    databaseManager.initialize(); // Synchronous initialization

    const faceCroppingService = new FaceCroppingServiceSharp(directoryManager);
    await faceCroppingService.initialize(); // ASYNC INITIALIZATION

    const faceProcessingService = new FaceProcessingService(databaseManager, faceCroppingService);

    // Initialize controllers
    const analysisController = new AnalysisController(databaseManager, broadcast);

    // Configure Multer for file uploads
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, directoryManager.getPath('faces'));
      },
      filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
      },
    });
    const upload = multer({ storage });

    // Collect all dependencies for injection
    dependencies = {
      databaseManager,
      faceProcessingService,
      analysisController,
      upload,
      broadcast,
      configReader,
      directoryManager,
    };

    // Get configuration from user settings
    const config = configReader.getAll();
    const PORT = process.env.PORT || 3001;
    const CORS_ORIGIN = config.cors_origins ? config.cors_origins.join(',') : 'http://localhost:8080';
    const TRUST_PROXY = process.env.TRUST_PROXY === 'true' || process.env.NODE_ENV === 'production';

    // Configure proxy trust
    if (TRUST_PROXY) {
      app.set('trust proxy', true);
    }

    // CORS configuration
    const corsOptions = {
      origin: CORS_ORIGIN.split(','),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    };
    app.use(cors(corsOptions));

    // Middleware
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Initialize WebSocket
    initializeWebSocket(server);

    // API Routes (with dependency injection)
    app.use('/api/webhook', createWebhookRouter(dependencies));

    app.use('/api', createFacesRouter(dependencies));
    app.use('/api', createAnalysisRouter(dependencies));
    app.use('/api', createConfigRouter(dependencies));

    // Health check endpoint
    app.get('/api/health', (req, res) => {
      res.status(200).json({ status: 'healthy' });
    });

    // Serve static files
    app.use(express.static(path.join(__dirname, '..', 'public')));
    app.use('/uploads', express.static(directoryManager.getPath('base')));

    // Fallback for SPA
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
    });

    // Error handling
    app.use((err, req, res, next) => {
      console.error('Server error:', err);
      res.status(500).json({ message: err.message, stack: err.stack });
    });

    // Start the server
    server.listen(PORT, () => {
      console.log(`🔔 WhoRang AI Doorbell server running on port ${PORT}`);
      console.log(`   CORS Origins: ${CORS_ORIGIN}`);
    });
  } catch (error) {
    console.error('❌ CRITICAL ERROR: Failed to start the server.', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
const gracefulShutdown = () => {
  console.log('Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed.');
    if (databaseManager) {
      databaseManager.close();
    }
    process.exit(0);
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

module.exports = { app, server, dependencies };
