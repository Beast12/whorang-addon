class StatsController {
  /**
   * Get comprehensive system statistics
   * GET /api/stats
   */
  static async getStats(req, res) {
    const db = require('../utils/databaseManager').getDatabase();
    
    try {
      // Get visitor statistics
      const visitorStats = db.prepare(`
        SELECT 
          COUNT(*) as total_visitors,
          COUNT(CASE WHEN ai_processing_complete = 1 THEN 1 END) as analyzed_visitors,
          COUNT(CASE WHEN faces_detected > 0 THEN 1 END) as visitors_with_faces,
          AVG(CASE WHEN ai_processing_complete = 1 THEN ai_confidence_score END) as avg_confidence,
          MAX(timestamp) as last_visitor_time
        FROM doorbell_events
      `).get();

      // Get face statistics
      const faceStats = db.prepare(`
        SELECT 
          COUNT(*) as total_faces,
          COUNT(CASE WHEN person_id IS NOT NULL THEN 1 END) as labeled_faces,
          COUNT(CASE WHEN person_id IS NULL THEN 1 END) as unknown_faces
        FROM faces
      `).get();

      // Get person statistics
      const personStats = db.prepare(`
        SELECT 
          COUNT(*) as total_persons,
          COUNT(CASE WHEN created_at > datetime('now', '-7 days') THEN 1 END) as new_persons_week
        FROM persons
      `).get();

      // Get AI provider usage statistics
      const aiStats = db.prepare(`
        SELECT 
          ai_provider,
          COUNT(*) as usage_count,
          AVG(ai_processing_time_ms) as avg_processing_time,
          SUM(CASE WHEN ai_cost_usd > 0 THEN ai_cost_usd ELSE 0 END) as total_cost
        FROM doorbell_events 
        WHERE ai_processing_complete = 1 AND ai_provider IS NOT NULL
        GROUP BY ai_provider
      `).all();

      // Get recent activity (last 24 hours)
      const recentActivity = db.prepare(`
        SELECT 
          COUNT(*) as visitors_24h,
          COUNT(CASE WHEN faces_detected > 0 THEN 1 END) as faces_detected_24h
        FROM doorbell_events 
        WHERE timestamp > datetime('now', '-24 hours')
      `).get();

      // Get database size info
      const dbStats = db.prepare(`
        SELECT 
          (SELECT COUNT(*) FROM doorbell_events) as events_count,
          (SELECT COUNT(*) FROM faces) as faces_count,
          (SELECT COUNT(*) FROM persons) as persons_count
      `).get();

      // Calculate processing performance
      const performanceStats = db.prepare(`
        SELECT 
          AVG(ai_processing_time_ms) as avg_ai_time,
          MIN(ai_processing_time_ms) as min_ai_time,
          MAX(ai_processing_time_ms) as max_ai_time,
          COUNT(CASE WHEN ai_processing_time_ms < 5000 THEN 1 END) as fast_analyses,
          COUNT(CASE WHEN ai_processing_time_ms >= 5000 THEN 1 END) as slow_analyses
        FROM doorbell_events 
        WHERE ai_processing_complete = 1 AND ai_processing_time_ms > 0
      `).get();

      const stats = {
        timestamp: new Date().toISOString(),
        visitors: {
          total: visitorStats.total_visitors || 0,
          analyzed: visitorStats.analyzed_visitors || 0,
          with_faces: visitorStats.visitors_with_faces || 0,
          average_confidence: visitorStats.avg_confidence ? 
            Math.round(visitorStats.avg_confidence * 100) / 100 : 0,
          last_visitor: visitorStats.last_visitor_time
        },
        faces: {
          total: faceStats.total_faces || 0,
          labeled: faceStats.labeled_faces || 0,
          unknown: faceStats.unknown_faces || 0,
          labeling_rate: faceStats.total_faces > 0 ? 
            Math.round((faceStats.labeled_faces / faceStats.total_faces) * 100) : 0
        },
        persons: {
          total: personStats.total_persons || 0,
          new_this_week: personStats.new_persons_week || 0
        },
        ai_providers: aiStats.map(provider => ({
          name: provider.ai_provider,
          usage_count: provider.usage_count,
          avg_processing_time: provider.avg_processing_time ? 
            Math.round(provider.avg_processing_time) : 0,
          total_cost: provider.total_cost ? 
            Math.round(provider.total_cost * 100) / 100 : 0
        })),
        recent_activity: {
          visitors_24h: recentActivity.visitors_24h || 0,
          faces_detected_24h: recentActivity.faces_detected_24h || 0
        },
        database: {
          events: dbStats.events_count || 0,
          faces: dbStats.faces_count || 0,
          persons: dbStats.persons_count || 0
        },
        performance: {
          avg_ai_processing_time: performanceStats.avg_ai_time ? 
            Math.round(performanceStats.avg_ai_time) : 0,
          min_ai_processing_time: performanceStats.min_ai_time || 0,
          max_ai_processing_time: performanceStats.max_ai_time || 0,
          fast_analyses: performanceStats.fast_analyses || 0,
          slow_analyses: performanceStats.slow_analyses || 0
        }
      };

      res.json({
        success: true,
        stats
      });

    } catch (error) {
      console.error('Error getting statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Get visitor statistics
   * GET /api/stats/visitors
   */
  static async getVisitorStats(req, res) {
    const db = require('../utils/databaseManager').getDatabase();
    
    try {
      const { days = 30 } = req.query;
      
      const stats = db.prepare(`
        SELECT 
          DATE(timestamp) as date,
          COUNT(*) as visitor_count,
          COUNT(CASE WHEN faces_detected > 0 THEN 1 END) as faces_count,
          COUNT(CASE WHEN ai_processing_complete = 1 THEN 1 END) as analyzed_count
        FROM doorbell_events 
        WHERE timestamp > datetime('now', '-' || ? || ' days')
        GROUP BY DATE(timestamp)
        ORDER BY date DESC
      `).all(days);

      res.json({
        success: true,
        period_days: parseInt(days),
        daily_stats: stats
      });

    } catch (error) {
      console.error('Error getting visitor statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Get AI usage and cost statistics
   * GET /api/stats/ai-usage
   */
  static async getAIUsageStats(req, res) {
    const db = require('../utils/databaseManager').getDatabase();
    
    try {
      const { days = 30 } = req.query;
      
      const usageStats = db.prepare(`
        SELECT 
          ai_provider,
          DATE(timestamp) as date,
          COUNT(*) as usage_count,
          AVG(ai_processing_time_ms) as avg_processing_time,
          SUM(CASE WHEN ai_cost_usd > 0 THEN ai_cost_usd ELSE 0 END) as daily_cost
        FROM doorbell_events 
        WHERE ai_processing_complete = 1 
          AND ai_provider IS NOT NULL
          AND timestamp > datetime('now', '-' || ? || ' days')
        GROUP BY ai_provider, DATE(timestamp)
        ORDER BY date DESC, ai_provider
      `).all(days);

      // Get total costs by provider
      const totalCosts = db.prepare(`
        SELECT 
          ai_provider,
          SUM(CASE WHEN ai_cost_usd > 0 THEN ai_cost_usd ELSE 0 END) as total_cost,
          COUNT(*) as total_usage,
          AVG(ai_processing_time_ms) as avg_time
        FROM doorbell_events 
        WHERE ai_processing_complete = 1 
          AND ai_provider IS NOT NULL
          AND timestamp > datetime('now', '-' || ? || ' days')
        GROUP BY ai_provider
      `).all(days);

      res.json({
        success: true,
        period_days: parseInt(days),
        daily_usage: usageStats,
        provider_totals: totalCosts.map(provider => ({
          provider: provider.ai_provider,
          total_cost: Math.round(provider.total_cost * 100) / 100,
          total_usage: provider.total_usage,
          avg_processing_time: Math.round(provider.avg_time)
        }))
      });

    } catch (error) {
      console.error('Error getting AI usage statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Get face recognition statistics
   * GET /api/stats/faces
   */
  static async getFaceStats(req, res) {
    const db = require('../utils/databaseManager').getDatabase();
    
    try {
      // Get face quality distribution
      const qualityStats = db.prepare(`
        SELECT 
          CASE 
            WHEN quality_score >= 0.8 THEN 'high'
            WHEN quality_score >= 0.6 THEN 'medium'
            WHEN quality_score >= 0.4 THEN 'low'
            ELSE 'very_low'
          END as quality_category,
          COUNT(*) as count
        FROM faces
        WHERE quality_score IS NOT NULL
        GROUP BY quality_category
      `).all();

      // Get person face counts
      const personFaceCounts = db.prepare(`
        SELECT 
          p.name as person_name,
          COUNT(f.id) as face_count,
          AVG(f.quality_score) as avg_quality
        FROM persons p
        LEFT JOIN faces f ON p.id = f.person_id
        GROUP BY p.id, p.name
        ORDER BY face_count DESC
        LIMIT 10
      `).all();

      res.json({
        success: true,
        quality_distribution: qualityStats,
        top_persons: personFaceCounts.map(person => ({
          name: person.person_name,
          face_count: person.face_count,
          avg_quality: person.avg_quality ? 
            Math.round(person.avg_quality * 100) / 100 : 0
        }))
      });

    } catch (error) {
      console.error('Error getting face statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }
}

module.exports = StatsController;
