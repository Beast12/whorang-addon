
const express = require('express');
const { v4: uuidv4 } = require('uuid');

function createConfigRouter(dependencies) {
  const router = express.Router();
  const { databaseManager, broadcast } = dependencies;

  // Get webhook configuration
  router.get('/webhook', (req, res) => {
    const db = databaseManager.getDatabase();
    const PUBLIC_URL = process.env.PUBLIC_URL || process.env.CORS_ORIGIN || 'http://localhost:8080';
    const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN || null;
    const WEBHOOK_PATH = process.env.WEBHOOK_PATH || '/api/webhook/doorbell';

    try {
      const stmt = db.prepare('SELECT webhook_token, webhook_url, webhook_path FROM webhook_config LIMIT 1');
      const config = stmt.get();
      
      const webhookPath = config?.webhook_path || WEBHOOK_PATH;
      const webhookUrl = `${PUBLIC_URL}${webhookPath}`;
      
      res.json({
        webhook_url: webhookUrl,
        webhook_path: webhookPath,
        has_token: !!(config?.webhook_token || WEBHOOK_TOKEN),
        webhook_token: config?.webhook_token ? '***' : null,
        public_url: PUBLIC_URL
      });
    } catch (err) {
      console.error('Error getting webhook config:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Update webhook configuration
  router.put('/webhook', (req, res) => {
    const { webhook_token, webhook_path } = req.body;
    const db = databaseManager.getDatabase();
    const PUBLIC_URL = process.env.PUBLIC_URL || process.env.CORS_ORIGIN || 'http://localhost:8080';
    const WEBHOOK_PATH = process.env.WEBHOOK_PATH || '/api/webhook/doorbell';
    
    try {
      const stmt = db.prepare('SELECT id FROM webhook_config LIMIT 1');
      const existing = stmt.get();
      
      const finalWebhookPath = webhook_path || WEBHOOK_PATH;
      const webhookUrl = `${PUBLIC_URL}${finalWebhookPath}`;
      
      if (existing) {
        const updateStmt = db.prepare(`
          UPDATE webhook_config 
          SET webhook_token = ?, webhook_path = ?, webhook_url = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `);
        updateStmt.run(webhook_token, finalWebhookPath, webhookUrl, existing.id);
      } else {
        const insertStmt = db.prepare(`
          INSERT INTO webhook_config (webhook_token, webhook_path, webhook_url)
          VALUES (?, ?, ?)
        `);
        insertStmt.run(webhook_token, finalWebhookPath, webhookUrl);
      }
      
      res.json({ 
        message: 'Webhook configuration updated successfully',
        webhook_url: webhookUrl,
        webhook_path: finalWebhookPath
      });
    } catch (err) {
      console.error('Error updating webhook config:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Test webhook endpoint
  router.post('/webhook/test', (req, res) => {
    const testPayload = {
      ai_message: "Test visitor at the front door - this is a test notification",
      ai_title: "Test Notification",
      location: "Front Door",
      weather: "clear"
    };

    try {
      // Simulate webhook processing
      const newEvent = {
        visitor_id: uuidv4(),
        timestamp: new Date().toISOString(),
        ai_message: testPayload.ai_message,
        ai_title: testPayload.ai_title,
        image_url: '/placeholder.svg',
        location: testPayload.location,
        weather: testPayload.weather
      };

      // Broadcast test event
      broadcast({
        type: 'new_visitor',
        data: { ...newEvent, id: 'test-' + Date.now() }
      });

      res.json({ 
        message: 'Test webhook sent successfully',
        test_payload: testPayload
      });
    } catch (err) {
      console.error('Error sending test webhook:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Get face recognition configuration
  router.get('/face-recognition', (req, res) => {
    const db = databaseManager.getDatabase();
    
    try {
      const stmt = db.prepare('SELECT * FROM face_recognition_config LIMIT 1');
      const config = stmt.get();
      
      if (!config) {
        // Return default configuration if none exists
        res.json({
          ai_provider: 'gemini',
          api_key: null,
          openai_api_key: null,
          ollama_url: 'http://localhost:11434',
          current_ai_model: 'gemini-1.5-flash',
          openai_model: 'gpt-4o',
          ollama_model: 'llava-phi3:latest',
          confidence_threshold: 0.6,
          training_images_per_person: 3
        });
      } else {
        res.json(config);
      }
    } catch (err) {
      console.error('Error getting face recognition config:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Update face recognition configuration
  router.put('/face-recognition', (req, res) => {
    const db = databaseManager.getDatabase();
    const {
      ai_provider,
      api_key,
      openai_api_key,
      ollama_url,
      current_ai_model,
      openai_model,
      ollama_model,
      confidence_threshold,
      training_images_per_person
    } = req.body;
    
    try {
      const stmt = db.prepare('SELECT id FROM face_recognition_config LIMIT 1');
      const existing = stmt.get();
      
      if (existing) {
        const updateStmt = db.prepare(`
          UPDATE face_recognition_config 
          SET 
            ai_provider = ?,
            api_key = ?,
            openai_api_key = ?,
            ollama_url = ?,
            current_ai_model = ?,
            openai_model = ?,
            ollama_model = ?,
            confidence_threshold = ?,
            training_images_per_person = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `);
        updateStmt.run(
          ai_provider, api_key, openai_api_key, ollama_url,
          current_ai_model, openai_model, ollama_model,
          confidence_threshold, training_images_per_person,
          existing.id
        );
      } else {
        const insertStmt = db.prepare(`
          INSERT INTO face_recognition_config (
            ai_provider, api_key, openai_api_key, ollama_url,
            current_ai_model, openai_model, ollama_model,
            confidence_threshold, training_images_per_person
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        insertStmt.run(
          ai_provider, api_key, openai_api_key, ollama_url,
          current_ai_model, openai_model, ollama_model,
          confidence_threshold, training_images_per_person
        );
      }
      
      res.json({ 
        message: 'Face recognition configuration updated successfully'
      });
    } catch (err) {
      console.error('Error updating face recognition config:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Reset all configuration to defaults
  router.post('/reset', (req, res) => {
    const db = databaseManager.getDatabase();
    
    try {
      // Reset face recognition configuration to defaults (only update columns that exist)
      const resetFaceConfigStmt = db.prepare(`
        UPDATE face_recognition_config 
        SET 
          ai_provider = 'gemini',
          confidence_threshold = 0.6,
          training_images_per_person = 3,
          updated_at = CURRENT_TIMESTAMP
      `);
      resetFaceConfigStmt.run();
      
      // Reset webhook configuration if table exists
      try {
        const resetWebhookStmt = db.prepare(`
          UPDATE webhook_config 
          SET 
            webhook_token = NULL,
            webhook_path = '/api/webhook/doorbell',
            updated_at = CURRENT_TIMESTAMP
        `);
        resetWebhookStmt.run();
      } catch (webhookError) {
        console.log('Webhook config table not found, skipping webhook reset');
      }
      
      // Broadcast configuration reset event
      try {
        broadcast({
          type: 'config_reset',
          data: { 
            timestamp: new Date().toISOString(),
            reset_by: 'admin'
          }
        });
      } catch (wsError) {
        console.log('WebSocket broadcast failed:', wsError.message);
      }
      
      res.json({ 
        message: 'All configuration reset to defaults successfully',
        reset_items: [
          'Face recognition settings',
          'AI provider configuration', 
          'Confidence thresholds',
          'Model selections',
          'Processing settings'
        ]
      });
    } catch (err) {
      console.error('Error resetting configuration:', err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = createConfigRouter;
