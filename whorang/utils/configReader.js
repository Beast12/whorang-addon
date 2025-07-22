const fs = require('fs');
const path = require('path');

/**
 * Configuration Reader - Handles reading configuration from multiple sources
 * Supports both Home Assistant add-on and standalone Docker deployments
 */
class ConfigReader {
  constructor() {
    this.config = null;
    this.configSources = {
      homeAssistantOptions: '/data/options.json',
      environmentVariables: process.env,
      defaults: {
        database_path: '/data/whorang.db',
        uploads_path: '/data/uploads',
        ai_provider: 'local',
        log_level: 'info',
        websocket_enabled: true,
        cors_enabled: true,
        cors_origins: ['*'],
        public_url: '',
        max_upload_size: '10MB',
        face_recognition_threshold: 0.6,
        ai_analysis_timeout: 30
      }
    };
    
    this.loadConfiguration();
  }

  /**
   * Load configuration from all available sources with proper precedence
   * Priority: Environment Variables > Home Assistant Options > Defaults
   */
  loadConfiguration() {
    console.log('🔧 Loading configuration from multiple sources...');
    
    // Start with defaults
    this.config = { ...this.configSources.defaults };
    
    // Try to load Home Assistant add-on options
    const haOptions = this.loadHomeAssistantOptions();
    if (haOptions) {
      console.log('✅ Loaded Home Assistant add-on options');
      this.config = { ...this.config, ...haOptions };
    }
    
    // Override with environment variables (highest priority)
    this.loadEnvironmentVariables();
    
    // Validate and sanitize configuration
    this.validateConfiguration();
    
    console.log('📋 Final configuration loaded:');
    console.log(`  Database path: ${this.config.database_path}`);
    console.log(`  Uploads path: ${this.config.uploads_path}`);
    console.log(`  AI provider: ${this.config.ai_provider}`);
    console.log(`  Log level: ${this.config.log_level}`);
    console.log(`  WebSocket enabled: ${this.config.websocket_enabled}`);
    console.log(`  CORS enabled: ${this.config.cors_enabled}`);
  }

  /**
   * Load Home Assistant add-on options from /data/options.json
   */
  loadHomeAssistantOptions() {
    try {
      if (fs.existsSync(this.configSources.homeAssistantOptions)) {
        const optionsContent = fs.readFileSync(this.configSources.homeAssistantOptions, 'utf8');
        const options = JSON.parse(optionsContent);
        
        console.log('📖 Home Assistant options found:', Object.keys(options));
        
        // Map Home Assistant option names to internal config names
        const mappedOptions = {};
        
        // Direct mappings
        const directMappings = {
          'database_path': 'database_path',
          'uploads_path': 'uploads_path',
          'ai_provider': 'ai_provider',
          'log_level': 'log_level',
          'websocket_enabled': 'websocket_enabled',
          'cors_enabled': 'cors_enabled',
          'cors_origins': 'cors_origins',
          'public_url': 'public_url',
          'max_upload_size': 'max_upload_size',
          'face_recognition_threshold': 'face_recognition_threshold',
          'ai_analysis_timeout': 'ai_analysis_timeout'
        };
        
        for (const [haKey, configKey] of Object.entries(directMappings)) {
          if (options.hasOwnProperty(haKey)) {
            mappedOptions[configKey] = options[haKey];
          }
        }
        
        return mappedOptions;
      } else {
        console.log('ℹ️  No Home Assistant options file found - using environment variables and defaults');
        return null;
      }
    } catch (error) {
      console.warn(`⚠️  Failed to load Home Assistant options: ${error.message}`);
      return null;
    }
  }

  /**
   * Load and map environment variables
   */
  loadEnvironmentVariables() {
    const envMappings = {
      'DATABASE_PATH': 'database_path',
      'UPLOADS_PATH': 'uploads_path',
      'AI_PROVIDER': 'ai_provider',
      'LOG_LEVEL': 'log_level',
      'WEBSOCKET_ENABLED': 'websocket_enabled',
      'CORS_ENABLED': 'cors_enabled',
      'CORS_ORIGINS': 'cors_origins',
      'PUBLIC_URL': 'public_url',
      'MAX_UPLOAD_SIZE': 'max_upload_size',
      'FACE_RECOGNITION_THRESHOLD': 'face_recognition_threshold',
      'AI_ANALYSIS_TIMEOUT': 'ai_analysis_timeout'
    };

    let envCount = 0;
    for (const [envKey, configKey] of Object.entries(envMappings)) {
      if (process.env[envKey] !== undefined) {
        let value = process.env[envKey];
        
        // Type conversion for specific keys
        if (configKey === 'websocket_enabled' || configKey === 'cors_enabled') {
          value = value.toLowerCase() === 'true';
        } else if (configKey === 'face_recognition_threshold') {
          value = parseFloat(value);
        } else if (configKey === 'ai_analysis_timeout') {
          value = parseInt(value);
        } else if (configKey === 'cors_origins') {
          try {
            value = JSON.parse(value);
          } catch {
            value = value.split(',').map(origin => origin.trim());
          }
        }
        
        this.config[configKey] = value;
        envCount++;
      }
    }
    
    if (envCount > 0) {
      console.log(`✅ Loaded ${envCount} environment variable overrides`);
    }
  }

  /**
   * Validate and sanitize configuration
   */
  validateConfiguration() {
    // Validate database path
    if (!this.config.database_path || typeof this.config.database_path !== 'string') {
      console.warn('⚠️  Invalid database_path, using default');
      this.config.database_path = this.configSources.defaults.database_path;
    }

    // Validate uploads path
    if (!this.config.uploads_path || typeof this.config.uploads_path !== 'string') {
      console.warn('⚠️  Invalid uploads_path, using default');
      this.config.uploads_path = this.configSources.defaults.uploads_path;
    }

    // Validate AI provider
    const validProviders = ['local', 'openai', 'claude', 'gemini', 'google-cloud-vision'];
    if (!validProviders.includes(this.config.ai_provider)) {
      console.warn(`⚠️  Invalid ai_provider '${this.config.ai_provider}', using 'local'`);
      this.config.ai_provider = 'local';
    }

    // Validate log level
    const validLogLevels = ['debug', 'info', 'warn', 'error'];
    if (!validLogLevels.includes(this.config.log_level)) {
      console.warn(`⚠️  Invalid log_level '${this.config.log_level}', using 'info'`);
      this.config.log_level = 'info';
    }

    // Validate face recognition threshold
    if (typeof this.config.face_recognition_threshold !== 'number' || 
        this.config.face_recognition_threshold < 0.1 || 
        this.config.face_recognition_threshold > 1.0) {
      console.warn(`⚠️  Invalid face_recognition_threshold '${this.config.face_recognition_threshold}', using 0.6`);
      this.config.face_recognition_threshold = 0.6;
    }

    // Validate AI analysis timeout
    if (typeof this.config.ai_analysis_timeout !== 'number' || 
        this.config.ai_analysis_timeout < 10 || 
        this.config.ai_analysis_timeout > 120) {
      console.warn(`⚠️  Invalid ai_analysis_timeout '${this.config.ai_analysis_timeout}', using 30`);
      this.config.ai_analysis_timeout = 30;
    }

    // Ensure CORS origins is an array
    if (!Array.isArray(this.config.cors_origins)) {
      console.warn('⚠️  Invalid cors_origins, using default');
      this.config.cors_origins = this.configSources.defaults.cors_origins;
    }
  }

  /**
   * Get configuration value
   */
  get(key) {
    return this.config[key];
  }

  /**
   * Get all configuration
   */
  getAll() {
    return { ...this.config };
  }

  /**
   * Get database path
   */
  getDatabasePath() {
    return this.config.database_path;
  }

  /**
   * Get uploads path
   */
  getUploadsPath() {
    return this.config.uploads_path;
  }

  /**
   * Check if running as Home Assistant add-on
   */
  isHomeAssistantAddon() {
    return fs.existsSync('/data/options.json');
  }

  /**
   * Get configuration status for debugging
   */
  getStatus() {
    return {
      isHomeAssistantAddon: this.isHomeAssistantAddon(),
      configSources: {
        homeAssistantOptions: fs.existsSync(this.configSources.homeAssistantOptions),
        environmentVariables: Object.keys(process.env).filter(key => 
          ['DATABASE_PATH', 'UPLOADS_PATH', 'AI_PROVIDER', 'LOG_LEVEL'].includes(key)
        )
      },
      currentConfig: this.config
    };
  }

  /**
   * Reload configuration (useful for testing)
   */
  reload() {
    this.loadConfiguration();
  }
}

// Export singleton instance
module.exports = new ConfigReader();
