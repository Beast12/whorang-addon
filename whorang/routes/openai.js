const express = require('express');
const { authenticateToken } = require('../middleware/auth');

function createOpenaiRouter(dependencies) {
  const router = express.Router();
  const { OpenaiController, databaseManager, configManager } = dependencies;
  
  // Instantiate controller with dependencies
  const openaiController = new OpenaiController(databaseManager, configManager);

  // Get available models from OpenAI API
  router.get('/models', authenticateToken, openaiController.getAvailableModels.bind(openaiController));

  // Test OpenAI connection
  router.post('/test-connection', authenticateToken, openaiController.testConnection.bind(openaiController));

  // Get usage statistics
  router.get('/usage/stats', authenticateToken, openaiController.getUsageStats.bind(openaiController));

  // Get usage logs
  router.get('/usage/logs', authenticateToken, openaiController.getUsageLogs.bind(openaiController));

  // Get available AI providers
  router.get('/providers', authenticateToken, openaiController.getAvailableProviders.bind(openaiController));

  // Set AI provider
  router.post('/provider', authenticateToken, openaiController.setAIProvider.bind(openaiController));

  // Get all models from all providers
  router.get('/all-models', authenticateToken, openaiController.getAllModels.bind(openaiController));

  // Get models for a specific provider
  router.get('/provider/:provider/models', authenticateToken, openaiController.getProviderModels.bind(openaiController));

  // Get current model
  router.get('/current-model', authenticateToken, openaiController.getCurrentModel.bind(openaiController));

  // Set AI model
  router.post('/model', authenticateToken, openaiController.setAIModel.bind(openaiController));

  return router;
}

module.exports = createOpenaiRouter;
