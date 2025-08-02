const express = require('express');
const createAnalysisController = require('../controllers/analysisController');

function createAnalysisRouter(dependencies) {
  const router = express.Router();
  const analysisController = createAnalysisController(dependencies);

  // Trigger AI analysis for a visitor
  router.post('/trigger', analysisController.triggerAnalysis);

  // Get analysis status for a visitor
  router.get('/status/:visitor_id', analysisController.getAnalysisStatus);

  return router;
}

module.exports = createAnalysisRouter;
