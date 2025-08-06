const express = require('express');

function createAnalysisRouter(dependencies) {
  const router = express.Router();
  const { databaseManager, configManager, broadcast } = dependencies;
  
  // Instantiate controller with dependencies
  const analysisController = new dependencies.AnalysisController(databaseManager, configManager, broadcast);

  // Trigger AI analysis for a visitor
  router.post('/trigger', analysisController.triggerAnalysis.bind(analysisController));

  // Get analysis status for a visitor
  router.get('/status/:visitor_id', analysisController.getAnalysisStatus.bind(analysisController));

  return router;
}

module.exports = createAnalysisRouter;
