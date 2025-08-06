const express = require('express');

// Import factory functions for routes that need dependencies
const createStatsRouter = require('./stats');
const createConfigRouter = require('./config');
const createFacesRouter = require('./faces');
const createDetectedFacesRouter = require('./detectedFaces');
const createOpenaiRouter = require('./openai');
const createAnalysisRouter = require('./analysis');

// Import direct routes (no dependencies needed)
const visitorsRoutes = require('./visitors');
const databaseRoutes = require('./database');
const aiRoutes = require('./ai');
const systemRoutes = require('./system');

function createApiRouter(dependencies) {
  const router = express.Router();

  // Health check
  router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Mount route modules - use factory functions for routes that need dependencies
  router.use('/visitors', visitorsRoutes);
  router.use('/stats', createStatsRouter(dependencies));
  router.use('/database', databaseRoutes);
  router.use('/config', createConfigRouter(dependencies));
  router.use('/faces', createFacesRouter(dependencies));
  router.use('/detected-faces', createDetectedFacesRouter(dependencies));
  router.use('/openai', createOpenaiRouter(dependencies));
  router.use('/analysis', createAnalysisRouter(dependencies));
  router.use('/ai', aiRoutes);
  router.use('/system', systemRoutes);

  return router;
}

module.exports = createApiRouter;
