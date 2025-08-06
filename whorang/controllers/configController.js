const configReader = require('../utils/configReader');

class ConfigController {
  /**
   * Get current configuration
   * GET /api/config
   */
  static async getConfig(req, res) {
    try {
      const config = configReader.getAll();
      
      res.json({
        success: true,
        config: {
          ai_provider: config.ai_provider,
          log_level: config.log_level,
          database_path: config.database_path,
          uploads_path: config.uploads_path,
          max_upload_size: config.max_upload_size,
          face_recognition_threshold: config.face_recognition_threshold,
          ai_analysis_timeout: config.ai_analysis_timeout,
          websocket_enabled: config.websocket_enabled,
          cors_enabled: config.cors_enabled,
          cors_origins: config.cors_origins,
          public_url: config.public_url
        }
      });
    } catch (error) {
      console.error('Error getting configuration:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Update configuration
   * POST /api/config
   */
  static async updateConfig(req, res) {
    try {
      const updates = req.body;
      
      // Validate configuration updates
      const allowedKeys = [
        'ai_provider',
        'log_level',
        'face_recognition_threshold',
        'ai_analysis_timeout',
        'websocket_enabled',
        'cors_enabled',
        'public_url'
      ];
      
      const validUpdates = {};
      for (const [key, value] of Object.entries(updates)) {
        if (allowedKeys.includes(key)) {
          validUpdates[key] = value;
        }
      }
      
      if (Object.keys(validUpdates).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No valid configuration updates provided',
          allowed_keys: allowedKeys
        });
      }
      
      // Apply configuration updates
      for (const [key, value] of Object.entries(validUpdates)) {
        configReader.set(key, value);
      }
      
      res.json({
        success: true,
        message: 'Configuration updated successfully',
        updated: validUpdates
      });
      
    } catch (error) {
      console.error('Error updating configuration:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Get AI provider configuration
   * GET /api/config/ai-provider
   */
  static async getAIProviderConfig(req, res) {
    try {
      const config = configReader.getAll();
      
      res.json({
        success: true,
        ai_provider: config.ai_provider,
        ai_analysis_timeout: config.ai_analysis_timeout,
        available_providers: ['local', 'openai', 'claude', 'gemini', 'google-cloud-vision']
      });
    } catch (error) {
      console.error('Error getting AI provider configuration:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Set AI provider
   * POST /api/config/ai-provider
   */
  static async setAIProvider(req, res) {
    try {
      const { provider } = req.body;
      
      const validProviders = ['local', 'openai', 'claude', 'gemini', 'google-cloud-vision'];
      
      if (!provider || !validProviders.includes(provider)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid AI provider',
          valid_providers: validProviders
        });
      }
      
      configReader.set('ai_provider', provider);
      
      res.json({
        success: true,
        message: `AI provider set to ${provider}`,
        ai_provider: provider
      });
      
    } catch (error) {
      console.error('Error setting AI provider:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Get system status and configuration health
   * GET /api/config/status
   */
  static async getSystemStatus(req, res) {
    try {
      const config = configReader.getAll();
      const databaseManager = require('../utils/databaseManager');
      const directoryManager = require('../utils/directoryManager');
      
      const status = {
        timestamp: new Date().toISOString(),
        config_loaded: true,
        database: databaseManager.getStatus(),
        directories: directoryManager.getStatus(),
        ai_provider: config.ai_provider,
        websocket_enabled: config.websocket_enabled,
        addon_mode: configReader.isHomeAssistantAddon()
      };
      
      res.json({
        success: true,
        status
      });
      
    } catch (error) {
      console.error('Error getting system status:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }
}

module.exports = ConfigController;
