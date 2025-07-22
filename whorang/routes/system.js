const express = require('express');
const router = express.Router();

// System restart endpoint
router.post('/restart', (req, res) => {
  try {
    console.log('System restart requested via API');
    
    // Send immediate response before restarting
    res.json({ 
      message: 'Backend restart initiated',
      restart_time: new Date().toISOString(),
      expected_downtime: '5-10 seconds'
    });
    
    // Broadcast restart notification to all WebSocket clients
    const { broadcast } = require('../websocket/handler');
    broadcast({
      type: 'system_restart',
      data: { 
        timestamp: new Date().toISOString(),
        initiated_by: 'admin_api'
      }
    });
    
    // Give time for response to be sent and WebSocket message to be delivered
    setTimeout(() => {
      console.log('Initiating graceful restart...');
      
      // Graceful restart - this will cause the container to restart
      // In a Docker environment, the container will be restarted automatically
      process.exit(0);
      
    }, 1000); // 1 second delay to ensure response is sent
    
  } catch (err) {
    console.error('Error initiating restart:', err);
    res.status(500).json({ error: err.message });
  }
});

// System health check with detailed information
router.get('/health', (req, res) => {
  try {
    const db = require('../config/database').getDatabase();
    
    // Check database connectivity
    let dbStatus = 'healthy';
    let dbError = null;
    try {
      const testStmt = db.prepare('SELECT 1 as test');
      testStmt.get();
    } catch (error) {
      dbStatus = 'error';
      dbError = error.message;
    }
    
    // Check uploads directory
    const fs = require('fs');
    const path = require('path');
    const uploadsDir = process.env.UPLOADS_DIR || './uploads';
    let uploadsStatus = 'healthy';
    let uploadsError = null;
    
    try {
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      // Test write access
      const testFile = path.join(uploadsDir, '.health_check');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
    } catch (error) {
      uploadsStatus = 'error';
      uploadsError = error.message;
    }
    
    // System information
    const systemInfo = {
      uptime: process.uptime(),
      memory_usage: process.memoryUsage(),
      node_version: process.version,
      platform: process.platform,
      pid: process.pid,
      timestamp: new Date().toISOString()
    };
    
    const overallStatus = (dbStatus === 'healthy' && uploadsStatus === 'healthy') ? 'healthy' : 'degraded';
    
    res.json({
      status: overallStatus,
      components: {
        database: {
          status: dbStatus,
          error: dbError
        },
        uploads: {
          status: uploadsStatus,
          error: uploadsError
        }
      },
      system: systemInfo
    });
    
  } catch (err) {
    console.error('Error checking system health:', err);
    res.status(500).json({ 
      status: 'error',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// System information endpoint
router.get('/info', (req, res) => {
  try {
    const packageJson = require('../package.json');
    
    const systemInfo = {
      application: {
        name: packageJson.name || 'WhoRang Backend',
        version: packageJson.version || '2.0.0',
        description: packageJson.description || 'AI-powered doorbell face recognition system'
      },
      runtime: {
        node_version: process.version,
        platform: process.platform,
        architecture: process.arch,
        uptime_seconds: process.uptime(),
        memory_usage: process.memoryUsage(),
        pid: process.pid
      },
      environment: {
        node_env: process.env.NODE_ENV || 'development',
        uploads_dir: process.env.UPLOADS_DIR || './uploads',
        database_path: process.env.DATABASE_PATH || './doorbell.db',
        cors_origin: process.env.CORS_ORIGIN || 'http://localhost:8080'
      },
      timestamp: new Date().toISOString()
    };
    
    res.json(systemInfo);
    
  } catch (err) {
    console.error('Error getting system info:', err);
    res.status(500).json({ error: err.message });
  }
});

// System logs endpoint (last N lines)
router.get('/logs', (req, res) => {
  try {
    const lines = parseInt(req.query.lines) || 100;
    const level = req.query.level || 'all'; // all, error, warn, info
    
    // This is a simplified implementation
    // In a production environment, you'd want to read from actual log files
    res.json({
      message: 'Log endpoint not fully implemented',
      note: 'Logs are currently output to console. Check container logs with: docker logs <container_name>',
      requested_lines: lines,
      requested_level: level,
      timestamp: new Date().toISOString()
    });
    
  } catch (err) {
    console.error('Error getting logs:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
