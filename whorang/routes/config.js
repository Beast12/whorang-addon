
const express = require('express');
const { v4: uuidv4 } = require('uuid');

function createConfigRouter(dependencies) {
  const router = express.Router();
  const { databaseManager, configReader, broadcast } = dependencies;

  // Get full config for frontend
  router.get('/config', (req, res) => {
    res.json(configReader.getAll());
  });

  // Get webhook configuration
  router.get('/config/webhook', (req, res) => {
    const db = databaseManager.getDatabase();
    const config = configReader.getAll();
    
    try {
      const stmt = db.prepare('SELECT webhook_token, webhook_path FROM webhook_config LIMIT 1');
      const dbConfig = stmt.get() || {};
      
      const webhookPath = dbConfig.webhook_path || config.webhook_path;
      const webhookUrl = `${config.public_url}${webhookPath}`;
      
      res.json({
        webhook_url: webhookUrl,
        webhook_path: webhookPath,
        has_token: !!(dbConfig.webhook_token || config.webhook_token),
        public_url: config.public_url
      });
    } catch (err) {
      console.error('Error getting webhook config:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Update webhook configuration
  router.put('/config/webhook', (req, res) => {
    const { webhook_token, webhook_path } = req.body;
    const db = databaseManager.getDatabase();
    const config = configReader.getAll();

    try {
      const finalWebhookPath = webhook_path || config.webhook_path;
      const webhookUrl = `${config.public_url}${finalWebhookPath}`;

      const stmt = db.prepare('SELECT id FROM webhook_config LIMIT 1');
      const existing = stmt.get();
      
      if (existing) {
        const updateStmt = db.prepare('UPDATE webhook_config SET webhook_token = ?, webhook_path = ?, webhook_url = ? WHERE id = ?');
        updateStmt.run(webhook_token, finalWebhookPath, webhookUrl, existing.id);
      } else {
        const insertStmt = db.prepare('INSERT INTO webhook_config (webhook_token, webhook_path, webhook_url) VALUES (?, ?, ?)');
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
  router.post('/config/webhook/test', (req, res) => {
    try {
      broadcast({
        type: 'new_visitor',
        data: {
          id: 'test-' + Date.now(),
          visitor_id: uuidv4(),
          timestamp: new Date().toISOString(),
          ai_message: 'Test visitor at the front door - this is a test notification',
          ai_title: 'Test Notification',
          image_url: '/placeholder.svg',
        }
      });
      res.json({ message: 'Test webhook sent successfully' });
    } catch (err) {
      console.error('Error sending test webhook:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Get face recognition configuration
  router.get('/config/face-recognition', (req, res) => {
    const db = databaseManager.getDatabase();
    try {
      const stmt = db.prepare('SELECT * FROM face_recognition_config LIMIT 1');
      const config = stmt.get();
      res.json(config || configReader.get('face_recognition'));
    } catch (err) {
      console.error('Error getting face recognition config:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Update face recognition configuration
  router.put('/config/face-recognition', (req, res) => {
    const db = databaseManager.getDatabase();
    const { ...updateData } = req.body;

    try {
      const fields = Object.keys(updateData).filter(k => k !== 'id');
      const placeholders = fields.map(() => '?').join(', ');
      const values = fields.map(k => updateData[k]);

      const stmt = db.prepare('SELECT id FROM face_recognition_config LIMIT 1');
      const existing = stmt.get();
      
      if (existing) {
        const setClause = fields.map(f => `${f} = ?`).join(', ');
        const updateStmt = db.prepare(`UPDATE face_recognition_config SET ${setClause} WHERE id = ?`);
        updateStmt.run(...values, existing.id);
      } else {
        const insertStmt = db.prepare(`INSERT INTO face_recognition_config (${fields.join(', ')}) VALUES (${placeholders})`);
        insertStmt.run(...values);
      }
      
      res.json({ message: 'Face recognition configuration updated successfully' });
    } catch (err) {
      console.error('Error updating face recognition config:', err);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = createConfigRouter;
