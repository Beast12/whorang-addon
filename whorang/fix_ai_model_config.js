#!/usr/bin/env node

/**
 * Fix AI model configuration to use a vision-capable model
 */

const { getDatabase } = require('./config/database');

async function fixAIModelConfig() {
  console.log('🔧 Fixing AI Model Configuration');
  console.log('================================');
  
  try {
    // Connect to database using existing config
    const db = getDatabase();
    
    console.log('📊 Current configuration:');
    
    // Check current config
    const currentConfig = db.prepare('SELECT * FROM face_recognition_config LIMIT 1').get();
    
    if (currentConfig) {
      console.log('Provider:', currentConfig.ai_provider || 'not set');
      console.log('Ollama Model:', currentConfig.ollama_model || 'not set');
      console.log('Current AI Model:', currentConfig.current_ai_model || 'not set');
      console.log('Ollama URL:', currentConfig.ollama_url || 'not set');
    } else {
      console.log('No configuration found - will create new one');
    }
    
    // Update configuration to use llava-phi3:latest (which we know works)
    const visionModel = 'llava-phi3:latest';
    const ollamaUrl = 'http://192.168.86.163:11434';
    
    console.log('\n🎯 Updating configuration:');
    console.log('Setting AI Provider: local');
    console.log('Setting Ollama Model:', visionModel);
    console.log('Setting Ollama URL:', ollamaUrl);
    
    if (currentConfig) {
      // Update existing config
      const updateStmt = db.prepare(`
        UPDATE face_recognition_config 
        SET ai_provider = ?, 
            ollama_model = ?, 
            current_ai_model = ?,
            ollama_url = ?,
            updated_at = ?
        WHERE id = ?
      `);
      
      updateStmt.run(
        'local',
        visionModel,
        visionModel,
        ollamaUrl,
        new Date().toISOString(),
        currentConfig.id
      );
    } else {
      // Create new config
      const insertStmt = db.prepare(`
        INSERT INTO face_recognition_config (
          enabled, ai_provider, ollama_model, current_ai_model, ollama_url,
          confidence_threshold, cost_tracking_enabled, monthly_budget_limit,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const now = new Date().toISOString();
      insertStmt.run(
        1, // enabled
        'local',
        visionModel,
        visionModel,
        ollamaUrl,
        0.7, // confidence_threshold
        1, // cost_tracking_enabled
        50.0, // monthly_budget_limit
        now,
        now
      );
    }
    
    // Verify the update
    console.log('\n✅ Updated configuration:');
    const newConfig = db.prepare('SELECT * FROM face_recognition_config LIMIT 1').get();
    console.log('Provider:', newConfig.ai_provider);
    console.log('Ollama Model:', newConfig.ollama_model);
    console.log('Current AI Model:', newConfig.current_ai_model);
    console.log('Ollama URL:', newConfig.ollama_url);
    
    db.close();
    
    console.log('\n🎉 SUCCESS: AI model configuration updated!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Restart the WhoRang add-on in Home Assistant');
    console.log('2. Face detection will now use llava-phi3:latest (vision-capable)');
    console.log('3. All 18 models will still appear in the dropdown for selection');
    
  } catch (error) {
    console.error('❌ Error fixing AI model configuration:', error);
    process.exit(1);
  }
}

// Run the fix
if (require.main === module) {
  fixAIModelConfig().catch(console.error);
}

module.exports = { fixAIModelConfig };
