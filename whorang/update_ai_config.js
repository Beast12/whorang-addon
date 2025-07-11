const { initializeDatabase } = require('./config/database');

async function updateAIConfig() {
  console.log('=== Updating AI Configuration ===');
  
  try {
    // Initialize database connection
    const db = initializeDatabase();
    
    // Check current configuration
    const currentConfigStmt = db.prepare('SELECT * FROM face_recognition_config LIMIT 1');
    const currentConfig = currentConfigStmt.get();
    
    console.log('Current configuration:');
    console.log('  AI Provider:', currentConfig?.ai_provider || 'Not set');
    console.log('  Enabled:', currentConfig?.enabled || false);
    console.log('  Ollama URL:', currentConfig?.ollama_url || 'Not set');
    console.log('  Ollama Model:', currentConfig?.ollama_model || 'Not set');
    
    // Update configuration to use working Ollama
    const updateStmt = db.prepare(`
      UPDATE face_recognition_config 
      SET ai_provider = ?, 
          enabled = ?, 
          ollama_url = ?, 
          ollama_model = ?,
          confidence_threshold = ?
      WHERE id = 1
    `);
    
    const result = updateStmt.run(
      'local',                    // ai_provider
      1,                         // enabled
      'http://192.168.86.163:11434',  // ollama_url
      'llava-phi3:latest',       // ollama_model
      0.7                        // confidence_threshold
    );
    
    if (result.changes > 0) {
      console.log('\n✅ Configuration updated successfully!');
      
      // Verify the update
      const updatedConfig = currentConfigStmt.get();
      console.log('\nNew configuration:');
      console.log('  AI Provider:', updatedConfig.ai_provider);
      console.log('  Enabled:', updatedConfig.enabled);
      console.log('  Ollama URL:', updatedConfig.ollama_url);
      console.log('  Ollama Model:', updatedConfig.ollama_model);
      console.log('  Confidence Threshold:', updatedConfig.confidence_threshold);
      
    } else {
      console.log('❌ No configuration found to update');
      
      // Try to insert new configuration
      const insertStmt = db.prepare(`
        INSERT INTO face_recognition_config 
        (ai_provider, enabled, ollama_url, ollama_model, confidence_threshold)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      const insertResult = insertStmt.run(
        'local',                    // ai_provider
        1,                         // enabled
        'http://192.168.86.163:11434',  // ollama_url
        'llava-phi3:latest',       // ollama_model
        0.7                        // confidence_threshold
      );
      
      if (insertResult.changes > 0) {
        console.log('✅ New configuration created successfully!');
      } else {
        console.log('❌ Failed to create configuration');
      }
    }
    
  } catch (error) {
    console.error('❌ Error updating configuration:', error);
  }
}

// Run the update
updateAIConfig().then(() => {
  console.log('\n=== Configuration Update Complete ===');
  process.exit(0);
}).catch(error => {
  console.error('Update failed:', error);
  process.exit(1);
});
