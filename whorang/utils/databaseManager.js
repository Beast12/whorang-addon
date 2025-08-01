const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const configReader = require('./configReader');
const pathValidator = require('./pathValidator');

let db;

class DatabaseManager {
  constructor() {
    this.primaryDbPath = configReader.getDatabasePath();
    this.fallbackDbPath = '/app/whorang.db';
    this.effectiveDbPath = null;
    this.isDataWritable = false;
    this.validatePrimaryPath();
  }

  validatePrimaryPath() {
    const validation = pathValidator.validateDatabasePath(this.primaryDbPath);
    if (validation.isValid) {
      this.isDataWritable = true;
    } else {
      console.warn(`⚠️  User-configured database path is not accessible: ${validation.error}`);
      this.isDataWritable = false;
    }
  }

  getEffectiveDatabasePath() {
    if (this.effectiveDbPath) return this.effectiveDbPath;

    const isAddon = configReader.isHomeAssistantAddon();
    const isDevelopment = process.env.NODE_ENV === 'development' || !isAddon;

    const pathsToTry = [
      this.primaryDbPath,
      isAddon ? '/data/whorang.db' : null,
      isDevelopment ? path.join(__dirname, '..', '.local', 'whorang.db') : null,
      this.fallbackDbPath,
    ].filter(p => p && typeof p === 'string');

    const uniquePaths = [...new Set(pathsToTry)];

    for (const dbPath of uniquePaths) {
      try {
        const dir = path.dirname(dbPath);
        fsSync.mkdirSync(dir, { recursive: true });
        const testFile = path.join(dir, '.db_write_test');
        fsSync.writeFileSync(testFile, 'test');
        fsSync.unlinkSync(testFile);

        console.log(`✅ Database path validated. Using: ${dbPath}`);
        if (dbPath !== this.primaryDbPath) {
          console.warn(`⚠️  Using fallback database path. Check config if this is not intended.`);
        }
        this.effectiveDbPath = dbPath;
        return dbPath;
      } catch (error) {
        console.warn(`⚠️  Could not use path '${dbPath}': ${error.message}`);
      }
    }

    const error = new Error('Unable to find a writable location for the database.');
    console.error(`❌ Database path resolution failed. Checked: ${uniquePaths.join(', ')}`);
    throw error;
  }

  getStatus() {
    try {
      const effectivePath = this.getEffectiveDatabasePath();
      const isPersistent = effectivePath === this.primaryDbPath;
      return {
        primaryDbPath: this.primaryDbPath,
        fallbackDbPath: this.fallbackDbPath,
        effectivePath: effectivePath,
        isPersistent: isPersistent,
        isDataWritable: this.isDataWritable,
        warning: isPersistent ? null : 'Database is using temporary storage - data will be lost on restart!'
      };
    } catch (error) {
      return {
        primaryDbPath: this.primaryDbPath,
        fallbackDbPath: this.fallbackDbPath,
        effectivePath: null,
        isPersistent: false,
        isDataWritable: this.isDataWritable,
        error: error.message
      };
    }
  }
}

const databaseManager = new DatabaseManager();

function createTables() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS doorbell_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        visitor_id TEXT UNIQUE NOT NULL,
        timestamp TEXT NOT NULL,
        ai_message TEXT NOT NULL,
        ai_title TEXT,
        image_url TEXT NOT NULL,
        location TEXT NOT NULL,
        weather TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        confidence_score REAL,
        objects_detected TEXT,
        processing_time TEXT,
        model_version TEXT,
        device_name TEXT,
        device_firmware TEXT,
        device_battery INTEGER,
        weather_temperature REAL,
        weather_condition TEXT,
        weather_humidity INTEGER,
        weather_data TEXT
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS webhook_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        webhook_token TEXT,
        webhook_url TEXT,
        webhook_path TEXT DEFAULT '/api/webhook/doorbell',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS persons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS face_encodings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person_id INTEGER NOT NULL,
        encoding_data TEXT NOT NULL,
        confidence REAL,
        image_path TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (person_id) REFERENCES persons (id) ON DELETE CASCADE
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS person_visitor_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person_id INTEGER,
        visitor_event_id INTEGER NOT NULL,
        confidence REAL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (person_id) REFERENCES persons (id) ON DELETE SET NULL,
        FOREIGN KEY (visitor_event_id) REFERENCES doorbell_events (id) ON DELETE CASCADE
      )
    `);

    // Create face_recognition_config table with all required columns
    console.log('Creating/updating face_recognition_config table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS face_recognition_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        enabled BOOLEAN DEFAULT 0,
        ai_provider TEXT DEFAULT 'local',
        api_key TEXT,
        confidence_threshold REAL DEFAULT 0.6,
        training_images_per_person INTEGER DEFAULT 3,
        auto_delete_after_days INTEGER DEFAULT 0,
        background_processing BOOLEAN DEFAULT 1,
        ollama_url TEXT DEFAULT 'http://localhost:11434',
        ollama_model TEXT DEFAULT 'llava',
        unknown_person_name TEXT DEFAULT 'Unknown',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add missing columns to existing tables if they don't exist
    function addColumnIfNotExists(table, column, definition) {
      const stmt = db.prepare(`PRAGMA table_info(${table})`);
      const columns = stmt.all();
      if (!columns.some(c => c.name === column)) {
        console.log(`Adding column '${column}' to table '${table}'...`);
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      }
    }

    addColumnIfNotExists('face_recognition_config', 'enabled', 'BOOLEAN DEFAULT 0');
    addColumnIfNotExists('face_recognition_config', 'ai_provider', `TEXT DEFAULT 'local'`);
    addColumnIfNotExists('face_recognition_config', 'api_key', 'TEXT');
    addColumnIfNotExists('face_recognition_config', 'confidence_threshold', 'REAL DEFAULT 0.6');
    addColumnIfNotExists('face_recognition_config', 'training_images_per_person', 'INTEGER DEFAULT 3');
    addColumnIfNotExists('face_recognition_config', 'auto_delete_after_days', 'INTEGER DEFAULT 0');
    addColumnIfNotExists('face_recognition_config', 'background_processing', 'BOOLEAN DEFAULT 1');
    addColumnIfNotExists('face_recognition_config', 'ollama_url', `TEXT DEFAULT 'http://localhost:11434'`);
    addColumnIfNotExists('face_recognition_config', 'ollama_model', `TEXT DEFAULT 'llava'`);
    addColumnIfNotExists('face_recognition_config', 'unknown_person_name', `TEXT DEFAULT 'Unknown'`);
    addColumnIfNotExists('face_recognition_config', 'created_at', 'TEXT DEFAULT CURRENT_TIMESTAMP');
    addColumnIfNotExists('face_recognition_config', 'updated_at', 'TEXT DEFAULT CURRENT_TIMESTAMP');
    addColumnIfNotExists('doorbell_events', 'weather_temperature', 'REAL');
    addColumnIfNotExists('doorbell_events', 'weather_condition', 'TEXT');
    addColumnIfNotExists('doorbell_events', 'weather_humidity', 'INTEGER');
    addColumnIfNotExists('doorbell_events', 'weather_data', 'TEXT');
    addColumnIfNotExists('persons', 'updated_at', 'TEXT DEFAULT CURRENT_TIMESTAMP');
    addColumnIfNotExists('webhook_config', 'updated_at', 'TEXT DEFAULT CURRENT_TIMESTAMP');

    // New tables for enhanced face detection and AI usage tracking
    db.exec(`
      CREATE TABLE IF NOT EXISTS detected_faces (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        visitor_event_id INTEGER NOT NULL,
        person_id INTEGER,
        box_x INTEGER NOT NULL,
        box_y INTEGER NOT NULL,
        box_width INTEGER NOT NULL,
        box_height INTEGER NOT NULL,
        confidence REAL,
        is_primary BOOLEAN DEFAULT 0,
        image_path TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (visitor_event_id) REFERENCES doorbell_events (id) ON DELETE CASCADE,
        FOREIGN KEY (person_id) REFERENCES persons (id) ON DELETE SET NULL
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS face_merge_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_person_id INTEGER NOT NULL,
        target_person_id INTEGER NOT NULL,
        merged_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (source_person_id) REFERENCES persons (id) ON DELETE CASCADE,
        FOREIGN KEY (target_person_id) REFERENCES persons (id) ON DELETE CASCADE
      )
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS ai_usage_tracking (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider TEXT NOT NULL,
        model TEXT,
        cost REAL,
        prompt_tokens INTEGER,
        completion_tokens INTEGER,
        total_tokens INTEGER,
        visitor_event_id INTEGER,
        success BOOLEAN DEFAULT 1,
        error_message TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (visitor_event_id) REFERENCES doorbell_events (id) ON DELETE SET NULL
      )
    `);

    // Create model cache table for dynamic model management
    db.exec(`
      CREATE TABLE IF NOT EXISTS model_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider TEXT NOT NULL UNIQUE,
        models_data TEXT NOT NULL,
        cached_at TEXT DEFAULT CURRENT_TIMESTAMP,
        expires_at TEXT
      )
    `);

    // Create indexes for better performance
    db.exec(`CREATE INDEX IF NOT EXISTS idx_detected_faces_person_id ON detected_faces (person_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_detected_faces_visitor_event_id ON detected_faces (visitor_event_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_detected_faces_created_at ON detected_faces (created_at)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_face_merge_history_target_person_id ON face_merge_history (target_person_id)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_ai_usage_tracking_provider ON ai_usage_tracking (provider)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_ai_usage_tracking_created_at ON ai_usage_tracking (created_at)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_ai_usage_tracking_visitor_event_id ON ai_usage_tracking (visitor_event_id)`);

    console.log('Enhanced face detection and AI usage tracking tables created');

    // Verify face_recognition_config table structure
    const schemaStmt = db.prepare("PRAGMA table_info(face_recognition_config)");
    const columns = schemaStmt.all();
    console.log('face_recognition_config table schema:', columns.map(col => `${col.name} ${col.type}`));

    console.log('Database tables ready');
  } catch (err) {
    console.error('Error creating tables:', err);
  }
}

function initializeWebhookConfig() {
  const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN || null;
  const WEBHOOK_PATH = process.env.WEBHOOK_PATH || '/api/webhook/doorbell';
  const PUBLIC_URL = process.env.PUBLIC_URL || process.env.CORS_ORIGIN || 'http://localhost:8080';

  try {
    const configStmt = db.prepare('SELECT * FROM webhook_config LIMIT 1');
    const config = configStmt.get();
    
    if (!config && WEBHOOK_TOKEN) {
      const insertStmt = db.prepare(`
        INSERT INTO webhook_config (webhook_token, webhook_url, webhook_path)
        VALUES (?, ?, ?)
      `);
      insertStmt.run(WEBHOOK_TOKEN, `${PUBLIC_URL}${WEBHOOK_PATH}`, WEBHOOK_PATH);
      console.log('Initialized webhook configuration from environment');
    }

    // Initialize face recognition config if not exists
    const faceConfigStmt = db.prepare('SELECT * FROM face_recognition_config LIMIT 1');
    const faceConfig = faceConfigStmt.get();
    
    console.log('Checking face recognition config initialization...');
    console.log('Existing face config:', faceConfig);
    
    if (!faceConfig) {
      console.log('Initializing face recognition configuration...');
      const insertFaceConfigStmt = db.prepare(`
        INSERT INTO face_recognition_config 
        (enabled, ai_provider, confidence_threshold, training_images_per_person, auto_delete_after_days, background_processing, ollama_url, ollama_model)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = insertFaceConfigStmt.run(0, 'local', 0.6, 3, 0, 1, 'http://localhost:11434', 'llava');
      console.log('Face recognition config initialized with result:', result);
      
      // Verify initialization
      const verifyStmt = db.prepare('SELECT * FROM face_recognition_config WHERE id = ?');
      const newConfig = verifyStmt.get(result.lastInsertRowid);
      console.log('Verified new face config:', newConfig);
    }
  } catch (err) {
    console.error('Error initializing configurations:', err);
  }
}

function initializeDatabase() {
  if (db) return db;

  const dbPath = databaseManager.getEffectiveDatabasePath();
  db = new Database(dbPath, { verbose: process.env.NODE_ENV === 'development' ? console.log : null });

  createTables();
  initializeWebhookConfig();
  console.log('Database schema initialized.');

  return db;
}

function closeDatabase() {
  if (db && db.open) {
    db.close();
    console.log('Database connection closed.');
  }
}

function getDatabase() {
  if (!db) {
    return initializeDatabase();
  }
  return db;
}

module.exports = {
  databaseManager,
  initializeDatabase,
  closeDatabase,
  getDatabase,
};
