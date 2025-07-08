const express = require('express');
const router = express.Router();
const { getDatabase } = require('../config/database');

// Get AI usage statistics - dedicated endpoint for Home Assistant integration
router.get('/usage', (req, res) => {
  try {
    const db = getDatabase();
    const { days = 1 } = req.query;
    
    // Calculate date filter
    let dateFilter = '';
    const now = new Date();
    
    if (days == 1) {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      dateFilter = `AND created_at >= '${yesterday.toISOString()}'`;
    } else {
      const daysAgo = new Date(now.getTime() - parseInt(days) * 24 * 60 * 60 * 1000);
      dateFilter = `AND created_at >= '${daysAgo.toISOString()}'`;
    }

    // Get overall usage statistics by provider
    const overallStmt = db.prepare(`
      SELECT 
        provider,
        COUNT(*) as total_requests,
        SUM(total_tokens) as total_tokens,
        SUM(cost_usd) as total_cost,
        AVG(processing_time_ms) as avg_processing_time,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_requests,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed_requests
      FROM ai_usage_tracking 
      WHERE 1=1 ${dateFilter}
      GROUP BY provider
      ORDER BY total_cost DESC
    `);
    
    const providerStats = overallStmt.all();

    // Calculate totals across all providers
    const totalCost = providerStats.reduce((sum, stat) => sum + (stat.total_cost || 0), 0);
    const totalRequests = providerStats.reduce((sum, stat) => sum + (stat.total_requests || 0), 0);
    const totalTokens = providerStats.reduce((sum, stat) => sum + (stat.total_tokens || 0), 0);

    // Get budget information
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const budgetStmt = db.prepare(`
      SELECT 
        SUM(cost_usd) as monthly_spent
      FROM ai_usage_tracking 
      WHERE created_at >= ?
    `);
    
    const budgetUsage = budgetStmt.get(currentMonth.toISOString());

    // Get budget limit from config
    const configStmt = db.prepare('SELECT monthly_budget_limit, cost_tracking_enabled FROM face_recognition_config LIMIT 1');
    const config = configStmt.get();

    // Format provider data for Home Assistant
    const providers = providerStats.map(stat => ({
      provider: stat.provider,
      cost: parseFloat((stat.total_cost || 0).toFixed(4)),
      requests: stat.total_requests || 0,
      tokens: stat.total_tokens || 0,
      avg_processing_time: Math.round(stat.avg_processing_time || 0),
      success_rate: stat.total_requests > 0 ? 
        Math.round((stat.successful_requests / stat.total_requests) * 100 * 10) / 10 : 0
    }));

    // Build response in format expected by Home Assistant integration
    const response = {
      total_cost: parseFloat(totalCost.toFixed(4)),
      total_requests: totalRequests,
      total_tokens: totalTokens,
      providers: providers,
      budget: {
        monthly_limit: config?.monthly_budget_limit || 0,
        monthly_spent: parseFloat((budgetUsage?.monthly_spent || 0).toFixed(4)),
        remaining: Math.max(0, (config?.monthly_budget_limit || 0) - (budgetUsage?.monthly_spent || 0))
      },
      period: days == 1 ? "24h" : `${days}d`,
      cost_tracking_enabled: config?.cost_tracking_enabled || false
    };

    res.json(response);

  } catch (error) {
    console.error('Error fetching AI usage stats:', error);
    res.status(500).json({
      error: 'Failed to fetch AI usage statistics',
      details: error.message,
      // Return safe defaults on error
      total_cost: 0.0,
      total_requests: 0,
      providers: [],
      budget: {
        monthly_limit: 0,
        monthly_spent: 0,
        remaining: 0
      },
      period: days == 1 ? "24h" : `${days}d`,
      cost_tracking_enabled: false
    });
  }
});

// Get detailed AI usage logs
router.get('/usage/logs', (req, res) => {
  try {
    const db = getDatabase();
    const { limit = 50, offset = 0, provider } = req.query;
    
    let providerFilter = '';
    if (provider && provider !== 'all') {
      providerFilter = `AND provider = '${provider}'`;
    }

    const stmt = db.prepare(`
      SELECT 
        aut.*,
        de.visitor_id,
        de.timestamp as event_timestamp
      FROM ai_usage_tracking aut
      LEFT JOIN doorbell_events de ON aut.visitor_event_id = de.id
      WHERE 1=1 ${providerFilter}
      ORDER BY aut.created_at DESC
      LIMIT ? OFFSET ?
    `);
    
    const logs = stmt.all(parseInt(limit), parseInt(offset));

    // Get total count for pagination
    const countStmt = db.prepare(`
      SELECT COUNT(*) as total 
      FROM ai_usage_tracking 
      WHERE 1=1 ${providerFilter}
    `);
    const { total } = countStmt.get();

    res.json({
      logs: logs.map(log => ({
        ...log,
        cost_usd: parseFloat((log.cost_usd || 0).toFixed(4)),
        created_at: log.created_at,
        success: Boolean(log.success)
      })),
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        has_more: (parseInt(offset) + parseInt(limit)) < total
      }
    });

  } catch (error) {
    console.error('Error fetching AI usage logs:', error);
    res.status(500).json({
      error: 'Failed to fetch AI usage logs',
      details: error.message,
      logs: [],
      pagination: {
        total: 0,
        limit: parseInt(req.query.limit || 50),
        offset: parseInt(req.query.offset || 0),
        has_more: false
      }
    });
  }
});

// Get AI cost summary for dashboard
router.get('/cost-summary', (req, res) => {
  try {
    const db = getDatabase();
    const now = new Date();
    
    // Get today's costs
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const todayStmt = db.prepare(`
      SELECT 
        SUM(cost_usd) as cost,
        COUNT(*) as requests
      FROM ai_usage_tracking 
      WHERE created_at >= ?
    `);
    const todayStats = todayStmt.get(today);

    // Get this month's costs
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthStmt = db.prepare(`
      SELECT 
        SUM(cost_usd) as cost,
        COUNT(*) as requests
      FROM ai_usage_tracking 
      WHERE created_at >= ?
    `);
    const monthStats = monthStmt.get(monthStart);

    // Get budget configuration
    const configStmt = db.prepare('SELECT monthly_budget_limit FROM face_recognition_config LIMIT 1');
    const config = configStmt.get();

    res.json({
      today: {
        cost: parseFloat((todayStats?.cost || 0).toFixed(4)),
        requests: todayStats?.requests || 0
      },
      month: {
        cost: parseFloat((monthStats?.cost || 0).toFixed(4)),
        requests: monthStats?.requests || 0,
        budget_limit: config?.monthly_budget_limit || 0,
        budget_remaining: Math.max(0, (config?.monthly_budget_limit || 0) - (monthStats?.cost || 0))
      }
    });

  } catch (error) {
    console.error('Error fetching AI cost summary:', error);
    res.status(500).json({
      error: 'Failed to fetch AI cost summary',
      details: error.message,
      today: { cost: 0, requests: 0 },
      month: { cost: 0, requests: 0, budget_limit: 0, budget_remaining: 0 }
    });
  }
});

// Get current Ollama configuration
router.get('/providers/local/config', (req, res) => {
  try {
    const db = getDatabase();
    const configStmt = db.prepare('SELECT * FROM face_recognition_config LIMIT 1');
    const config = configStmt.get();
    
    const ollamaUrl = config?.ollama_url || 'http://localhost:11434';
    const urlObj = new URL(ollamaUrl);
    
    res.json({
      success: true,
      host: urlObj.hostname,
      port: parseInt(urlObj.port) || 11434,
      ollama_url: ollamaUrl,
      model: config?.ollama_model || 'llava'
    });
    
  } catch (error) {
    console.error('Error getting Ollama config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get Ollama configuration',
      details: error.message
    });
  }
});

// Set Ollama configuration (the missing endpoint)
router.post('/providers/local/config', (req, res) => {
  try {
    // Handle both direct format and Home Assistant nested format
    let host, port;
    
    if (req.body && req.body.ollama) {
      // Home Assistant format: {"ollama": {"host": "...", "port": ...}}
      host = req.body.ollama.host;
      port = req.body.ollama.port;
    } else if (req.body) {
      // Direct format: {"host": "...", "port": ...}
      host = req.body.host;
      port = req.body.port;
    }
    
    if (!host || !port) {
      return res.status(400).json({
        success: false,
        error: 'Host and port are required',
        received_format: req.body,
        expected_formats: [
          '{"host": "192.168.86.163", "port": 11434}',
          '{"ollama": {"host": "192.168.86.163", "port": 11434}}'
        ]
      });
    }
    
    const db = getDatabase();
    const ollamaUrl = `http://${host}:${port}`;
    
    console.log(`Updating Ollama configuration to: ${ollamaUrl}`);
    
    // Update the database with new Ollama configuration
    const updateStmt = db.prepare(`
      UPDATE face_recognition_config 
      SET ollama_url = ?, updated_at = ?
      WHERE id = 1
    `);
    
    const result = updateStmt.run(ollamaUrl, new Date().toISOString());
    
    if (result.changes === 0) {
      // No existing config, create one
      const insertStmt = db.prepare(`
        INSERT INTO face_recognition_config 
        (ollama_url, ai_provider, updated_at, created_at)
        VALUES (?, 'local', ?, ?)
      `);
      
      const now = new Date().toISOString();
      insertStmt.run(ollamaUrl, now, now);
      console.log(`Created new Ollama configuration: ${ollamaUrl}`);
    } else {
      console.log(`Updated existing Ollama configuration: ${ollamaUrl}`);
    }
    
    res.json({
      success: true,
      message: 'Ollama configuration updated successfully',
      ollama_url: ollamaUrl,
      host: host,
      port: parseInt(port)
    });
    
  } catch (error) {
    console.error('Error updating Ollama config:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update Ollama configuration',
      details: error.message
    });
  }
});

// Test Ollama connection with current config
router.post('/providers/local/test', async (req, res) => {
  try {
    const OllamaController = require('../controllers/ollamaController');
    
    // Use the test connection method from OllamaController
    await OllamaController.testConnection(req, res);
    
  } catch (error) {
    console.error('Error testing Ollama connection:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test Ollama connection',
      details: error.message
    });
  }
});

// Get available Ollama models
router.get('/providers/local/models', async (req, res) => {
  try {
    const OllamaController = require('../controllers/ollamaController');
    
    // Use the get available models method from OllamaController
    await OllamaController.getAvailableModels(req, res);
    
  } catch (error) {
    console.error('Error getting Ollama models:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get Ollama models',
      details: error.message
    });
  }
});

module.exports = router;
