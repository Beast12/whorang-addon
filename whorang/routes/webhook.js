const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { validateWebhookToken } = require('../middleware/auth');
const path = require('path');

function createWebhookRouter(dependencies) {
  const {
    databaseManager,
    faceProcessingService,
    analysisController,
    upload,
    broadcast,
    configReader,
    directoryManager,
  } = dependencies;

  const router = express.Router();

  // Check if automatic analysis should be triggered
  function shouldAutoAnalyze() {
    return configReader.get('auto_ai_analysis');
  }

  // Webhook handler function
  async function handleWebhookEvent(req, res) {
    const { ai_message, ai_title, location, device_name, image_url } = req.body;

    if (!location) {
      return res.status(400).json({ error: 'Missing required field: location' });
    }

    // Dynamically construct the image URL using DirectoryManager to avoid hardcoded paths
    const facesSubDir = path.relative(directoryManager.getPath('base'), directoryManager.getPath('faces'));
    const publicImageUrl = req.file
      ? `/${path.posix.join('uploads', facesSubDir, req.file.filename)}`
      : image_url || '/placeholder.svg';

    const newEvent = {
      visitor_id: uuidv4(),
      timestamp: new Date().toISOString(),
      ai_message,
      ai_title: ai_title || null,
      image_url: publicImageUrl,
      location,
      device_name: device_name || null,
    };

    try {
      const eventId = await databaseManager.insertEvent(newEvent);
      const eventWithId = { ...newEvent, id: eventId };

      const fullImageUrl = req.file
        ? `${req.protocol}://${req.get('host')}${newEvent.image_url}`
        : newEvent.image_url;

      faceProcessingService.addToProcessingQueue(eventWithId.id, fullImageUrl).catch((error) => {
        console.error('Face processing queue error:', error);
      });

      if (fullImageUrl && shouldAutoAnalyze()) {
        console.log('Triggering automatic AI analysis for visitor:', eventWithId.id);
        analysisController.triggerAnalysis(eventWithId.id, fullImageUrl);
      }

      broadcast({ type: 'new_visitor', data: eventWithId });
      res.status(201).json(eventWithId);
    } catch (err) {
      console.error('Error inserting new event:', err);
      res.status(500).json({ error: err.message });
    }
  }

  // Default webhook endpoint
  router.post('/doorbell', validateWebhookToken, upload.single('image'), handleWebhookEvent);

  return router;
}

module.exports = { createWebhookRouter };
