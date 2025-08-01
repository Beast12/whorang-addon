

class AnalysisController {
  constructor(databaseManager, broadcast) {
    this.databaseManager = databaseManager;
    this.broadcast = broadcast;
    // Bind methods to ensure 'this' context is correct when passed as callbacks
    this.triggerAnalysis = this.triggerAnalysis.bind(this);
    this.getAnalysisStatus = this.getAnalysisStatus.bind(this);
  }

  /**
   * Trigger AI analysis for a visitor
   * POST /api/analysis/trigger
   */
    async triggerAnalysis(req, res) {
    const db = this.databaseManager.getDatabase();
    
    try {
      const { visitor_id, ai_prompt_template, custom_ai_prompt, enable_weather_context } = req.body;
      
      // Extract AI template configuration from request
      const aiTemplateConfig = {
        ai_prompt_template: ai_prompt_template || 'professional',
        custom_ai_prompt: custom_ai_prompt || '',
        enable_weather_context: enable_weather_context !== false
      };
      
      console.log(`🎯 Analysis trigger with AI template: ${aiTemplateConfig.ai_prompt_template}`);
      
      let targetVisitor;
      
      // Get the visitor to analyze
      if (visitor_id) {
        // Analyze specific visitor
        const stmt = db.prepare('SELECT * FROM doorbell_events WHERE id = ?');
        targetVisitor = stmt.get(visitor_id);
        
        if (!targetVisitor) {
          return res.status(404).json({
            success: false,
            error: 'Visitor not found',
            visitor_id
          });
        }
      } else {
        // Analyze latest visitor
        const stmt = db.prepare('SELECT * FROM doorbell_events ORDER BY timestamp DESC LIMIT 1');
        targetVisitor = stmt.get();
        
        if (!targetVisitor) {
          return res.status(404).json({
            success: false,
            error: 'No visitors found to analyze'
          });
        }
      }
      
      console.log(`Triggering AI analysis for visitor ${targetVisitor.id}`);
      
      // Validate that visitor has an image
      if (!targetVisitor.image_url) {
        return res.status(400).json({
          success: false,
          error: 'Visitor has no image to analyze',
          visitor_id: targetVisitor.id
        });
      }
      
      // Return immediate response and process asynchronously
      res.json({
        success: true,
        message: 'Analysis triggered successfully',
        visitor_id: targetVisitor.id,
        processing: true
      });
      
      // Process analysis asynchronously with AI template configuration
      setImmediate(async () => {
        try {
          await this._processVisitorAnalysis(targetVisitor, aiTemplateConfig);
        } catch (error) {
          console.error(`Failed to process analysis for visitor ${targetVisitor.id}:`, error);
        }
      });
      
    } catch (error) {
      console.error('Error triggering analysis:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }
  
  /**
   * Process analysis directly (for programmatic calls)
   * @param {number} visitor_id - ID of visitor to analyze
   * @param {Object} aiTemplateConfig - AI template configuration
   * @returns {Promise<Object>} Analysis result
   */
    async processAnalysisDirectly(visitor_id, aiTemplateConfig = null) {
    const db = this.databaseManager.getDatabase();
    
    try {
      let targetVisitor;
      
      if (visitor_id) {
        const stmt = db.prepare('SELECT * FROM doorbell_events WHERE id = ?');
        targetVisitor = stmt.get(visitor_id);
        
        if (!targetVisitor) {
          throw new Error(`Visitor ${visitor_id} not found`);
        }
      } else {
        const stmt = db.prepare('SELECT * FROM doorbell_events ORDER BY timestamp DESC LIMIT 1');
        targetVisitor = stmt.get();
        
        if (!targetVisitor) {
          throw new Error('No visitors found to analyze');
        }
      }
      
      if (!targetVisitor.image_url) {
        throw new Error(`Visitor ${targetVisitor.id} has no image to analyze`);
      }
      
      console.log(`Processing direct analysis for visitor ${targetVisitor.id}`);
      
      // Process analysis using existing private method with AI template config
      const result = await AnalysisController._processVisitorAnalysis(targetVisitor, aiTemplateConfig);
      
      return {
        success: true,
        visitor_id: targetVisitor.id,
        message: 'Analysis completed successfully',
        ...result
      };
      
    } catch (error) {
      console.error('Error in direct analysis processing:', error);
      throw error;
    }
  }

  /**
   * Process AI analysis for a visitor
   * @private
   */
    async _processVisitorAnalysis(visitor, aiTemplateConfig = null) {
    const db = this.databaseManager.getDatabase();
    
    try {
      console.log(`Starting AI analysis for visitor ${visitor.id}`);
      
      // Record start time for processing time calculation
      const analysisStartTime = Date.now();
      
      // Mark as processing
      const markProcessingStmt = db.prepare(`
        UPDATE doorbell_events 
        SET ai_processing_complete = 0 
        WHERE id = ?
      `);
      markProcessingStmt.run(visitor.id);
      
      // Get current AI provider configuration
      const configStmt = db.prepare('SELECT * FROM face_recognition_config LIMIT 1');
      const config = configStmt.get();
      const aiProvider = config?.ai_provider || 'local';
      
      console.log(`Using AI provider: ${aiProvider}`);
      
      // Get AI provider instance with full configuration
      const provider = aiProviders.createAIProvider(aiProvider, {
        api_key: config?.api_key,
        ollama_url: config?.ollama_url,
        ollama_model: config?.ollama_model,
        openai_model: config?.openai_model,
        claude_model: config?.claude_model,
        gemini_model: config?.gemini_model,
        cost_tracking_enabled: config?.cost_tracking_enabled
      });
      
      // Perform AI analysis with timing and template configuration
      const analysisResults = await provider.detectFaces(visitor.image_url, visitor.id, aiTemplateConfig);
      
      // Calculate total processing time
      const totalProcessingTime = Date.now() - analysisStartTime;
      
      console.log(`AI analysis completed for visitor ${visitor.id}:`, {
        faces_detected: analysisResults.faces_detected,
        objects_detected: analysisResults.objects_detected?.length || 0,
        confidence: analysisResults.scene_analysis?.overall_confidence,
        processing_time_ms: totalProcessingTime
      });
      
      // Update visitor with new analysis results including processing time
      const updateStmt = db.prepare(`
        UPDATE doorbell_events SET
          ai_message = ?,
          ai_title = ?,
          ai_confidence_score = ?,
          ai_objects_detected = ?,
          ai_scene_analysis = ?,
          ai_processing_complete = 1,
          faces_detected = ?,
          processing_time = ?
        WHERE id = ?
      `);
      
      updateStmt.run(
        analysisResults.ai_message || visitor.ai_message,
        analysisResults.ai_title || visitor.ai_title,
        analysisResults.scene_analysis?.overall_confidence || null,
        JSON.stringify(analysisResults.objects_detected || []),
        JSON.stringify(analysisResults.scene_analysis || {}),
        analysisResults.faces_detected || 0,
        totalProcessingTime.toString(),
        visitor.id
      );
      
      // REMOVED: Face processing is already handled by the webhook handler
      // to prevent duplicate processing of the same event
      console.log(`Face processing for visitor ${visitor.id} is handled separately by webhook handler`);
      
      // Send WebSocket notification about analysis completion
      if (this.broadcast) {
        this.broadcast({
          type: 'ai_analysis_complete',
          data: {
            visitor_id: visitor.id,
            ai_provider: aiProvider,
            faces_detected: analysisResults.faces_detected || 0,
            objects_detected: analysisResults.objects_detected?.length || 0,
            confidence_score: analysisResults.scene_analysis?.overall_confidence,
            processing_time: totalProcessingTime,
            processing_time_ms: totalProcessingTime,
            cost_usd: analysisResults.cost_usd || 0
          }
        });
      }
      
      console.log(`Analysis processing completed for visitor ${visitor.id}`);
      
      // Return analysis results for direct calls
      return {
        analysis: analysisResults.ai_message || visitor.ai_message,
        confidence: analysisResults.scene_analysis?.overall_confidence || 0,
        faces_detected: analysisResults.faces_detected || 0,
        provider: aiProvider,
        objects_detected: analysisResults.objects_detected?.length || 0,
        scene_analysis: analysisResults.scene_analysis
      };
      
    } catch (error) {
      console.error(`Error processing analysis for visitor ${visitor.id}:`, error);
      
      // Mark as failed
      const failStmt = db.prepare(`
        UPDATE doorbell_events 
        SET ai_processing_complete = 1 
        WHERE id = ?
      `);
      failStmt.run(visitor.id);
      
      // Send error notification via WebSocket
      if (this.broadcast) {
        this.broadcast({
          type: 'ai_analysis_error',
          data: {
            visitor_id: visitor.id,
            error: error.message
          }
        });
      }
    }
  }
  
  /**
   * Get analysis status for a visitor
   * GET /api/analysis/status/:visitor_id
   */
    async getAnalysisStatus(req, res) {
    const db = this.databaseManager.getDatabase();
    
    try {
      const { visitor_id } = req.params;
      
      const stmt = db.prepare(`
        SELECT 
          id,
          ai_processing_complete,
          ai_confidence_score,
          faces_detected,
          ai_objects_detected,
          ai_scene_analysis
        FROM doorbell_events 
        WHERE id = ?
      `);
      
      const visitor = stmt.get(visitor_id);
      
      if (!visitor) {
        return res.status(404).json({
          success: false,
          error: 'Visitor not found'
        });
      }
      
      res.json({
        success: true,
        visitor_id: visitor.id,
        processing_complete: Boolean(visitor.ai_processing_complete),
        confidence_score: visitor.ai_confidence_score,
        faces_detected: visitor.faces_detected || 0,
        objects_detected: visitor.ai_objects_detected ? 
          JSON.parse(visitor.ai_objects_detected).length : 0,
        scene_analysis: visitor.ai_scene_analysis ? 
          JSON.parse(visitor.ai_scene_analysis) : null
      });
      
    } catch (error) {
      console.error('Error getting analysis status:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }
}

module.exports = AnalysisController;
