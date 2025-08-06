const express = require('express');
const { validateWebhookToken } = require('../middleware/auth');

function createOpenaiRouter(dependencies) {
  const router = express.Router();
  const { databaseManager, configManager, broadcast } = dependencies;
  
  // Import controller and required service
  const OpenaiController = require('../controllers/openaiController');
  const { OpenAIVisionProvider } = require('../services/aiProviders');
  
  // Instantiate controller with dependencies
  const openaiController = new OpenaiController(databaseManager, configManager, OpenAIVisionProvider);

  // Get available models from OpenAI API
  router.get('/models', validateWebhookToken, openaiController.getAvailableModels.bind(openaiController));

  // Test OpenAI connection
  router.post('/test-connection', validateWebhookToken, openaiController.testConnection.bind(openaiController));

  // Get usage statistics
  router.get('/usage/stats', validateWebhookToken, openaiController.getUsageStats.bind(openaiController));

  // Get usage logs
  router.get('/usage/logs', validateWebhookToken, openaiController.getUsageLogs.bind(openaiController));

  // Get available AI providers
  router.get('/providers', validateWebhookToken, openaiController.getAvailableProviders.bind(openaiController));

  // Set AI provider
  router.post('/provider', validateWebhookToken, openaiController.setAIProvider.bind(openaiController));

  // Get all models from all providers
  router.get('/all-models', validateWebhookToken, openaiController.getAllModels.bind(openaiController));

  // Get models for a specific provider
  router.get('/provider/:provider/models', validateWebhookToken, openaiController.getProviderModels.bind(openaiController));

  // Get current model
  router.get('/current-model', validateWebhookToken, openaiController.getCurrentModel.bind(openaiController));

  // Set AI model
  router.post('/model', validateWebhookToken, openaiController.setAIModel.bind(openaiController));

  return router;
}

module.exports = createOpenaiRouter;
