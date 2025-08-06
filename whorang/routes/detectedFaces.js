const express = require('express');
const { validateWebhookToken } = require('../middleware/auth');

function createDetectedFacesRouter(dependencies) {
  const router = express.Router();
  const { databaseManager } = dependencies;
  
  // Import controller and service
  const DetectedFacesController = require('../controllers/detectedFacesController');
  const faceProcessingService = require('../services/faceProcessing');
  
  // Instantiate controller with dependencies
  const detectedFacesController = new DetectedFacesController(databaseManager, faceProcessingService);
  
  // Get all unassigned faces (for manual labeling)
  router.get('/unassigned', validateWebhookToken, detectedFacesController.getUnassignedFaces.bind(detectedFacesController));

  // Get faces for a specific person
  router.get('/person/:personId', validateWebhookToken, detectedFacesController.getPersonFaces.bind(detectedFacesController));

  // Assign a face to a person
  router.post('/assign', validateWebhookToken, detectedFacesController.assignFaceToPerson.bind(detectedFacesController));

  // Unassign a face from a person
  router.post('/unassign', validateWebhookToken, detectedFacesController.unassignFace.bind(detectedFacesController));

  // Bulk assign faces to a person
  router.post('/bulk-assign', validateWebhookToken, detectedFacesController.bulkAssignFaces.bind(detectedFacesController));

  // Get face similarities for matching
  router.get('/:faceId/similarities', validateWebhookToken, detectedFacesController.getFaceSimilarities.bind(detectedFacesController));

  // Delete a face
  router.delete('/:faceId', validateWebhookToken, detectedFacesController.deleteFace.bind(detectedFacesController));

  // Get face statistics
  router.get('/stats', validateWebhookToken, detectedFacesController.getFaceStats.bind(detectedFacesController));

  return router;
}

module.exports = createDetectedFacesRouter;
