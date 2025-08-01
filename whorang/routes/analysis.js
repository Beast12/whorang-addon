const express = require('express');

function createAnalysisRouter(dependencies) {
  const router = express.Router();
  const { analysisController } = dependencies;

  // Trigger AI analysis for a visitor
  router.post('/analysis/trigger', analysisController.triggerAnalysis);

  // Get analysis status for a visitor
  router.get('/analysis/status/:visitor_id', analysisController.getAnalysisStatus);

  return router;
}

module.exports = createAnalysisRouter;
