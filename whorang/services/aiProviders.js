
class BaseAIProvider {
  constructor(config) {
    this.config = config;
  }

  async detectFaces(imageUrl) {
    throw new Error('detectFaces method must be implemented');
  }

  async generateFaceEncoding(imageUrl, faceData) {
    throw new Error('generateFaceEncoding method must be implemented');
  }

  // Validate if bounding box coordinates are reasonable
  isValidBoundingBox(bbox) {
    if (!bbox || typeof bbox !== 'object') {
      return false;
    }
    
    const { x, y, width, height } = bbox;
    
    // Check if all required properties exist and are numbers
    if (typeof x !== 'number' || typeof y !== 'number' || 
        typeof width !== 'number' || typeof height !== 'number') {
      return false;
    }
    
    // Check for reasonable coordinate ranges
    // For percentage coordinates (0-100)
    if (x >= 0 && x <= 100 && y >= 0 && y <= 100 && 
        width > 0 && width <= 100 && height > 0 && height <= 100) {
      return true;
    }
    
    // For normalized coordinates (0.0-1.0)
    if (x >= 0 && x <= 1.0 && y >= 0 && y <= 1.0 && 
        width > 0 && width <= 1.0 && height > 0 && height <= 1.0) {
      return true;
    }
    
    return false;
  }

  // Detect if bounding box is a default/fallback value
  isDefaultBoundingBox(bbox) {
    if (!bbox || typeof bbox !== 'object') {
      return true;
    }
    
    const { x, y, width, height } = bbox;
    
    // Known problematic default/placeholder bounding boxes that AI providers use
    const defaultBoxes = [
      { x: 25, y: 25, width: 50, height: 50 },    // Center crop fallback
      { x: 0, y: 0, width: 100, height: 100 },    // Full image fallback
      { x: 40, y: 30, width: 20, height: 30 },    // OpenAI placeholder coordinates
      { x: 40, y: 35, width: 20, height: 30 },    // OpenAI placeholder coordinates variant
      { x: 50, y: 50, width: 25, height: 25 },    // Another common fallback
      { x: 30, y: 20, width: 40, height: 60 },    // Another placeholder pattern
    ];
    
    // Also check for suspiciously similar patterns (round numbers that look like placeholders)
    const isSuspiciousPattern = (x, y, width, height) => {
      // Only flag extremely suspicious patterns - be more permissive
      const allRoundNumbers = [x, y, width, height].filter(val => val % 10 === 0).length;
      
      // Only reject if ALL coordinates are multiples of 10 (very suspicious)
      if (allRoundNumbers === 4) {
        console.warn(`⚠️  All coordinates are multiples of 10 (suspicious): ${JSON.stringify({x, y, width, height})}`);
        return true;
      }
      
      // Check for very specific known problematic ranges (including decimal variants)
      if (x >= 38 && x <= 45 && y >= 30 && y <= 40 && width >= 10 && width <= 25 && height >= 15 && height <= 25) {
        console.warn(`⚠️  Coordinates match known AI placeholder range (including decimal variants): ${JSON.stringify({x, y, width, height})}`);
        return true;
      }
      
      return false;
    };
    
    // Check if coordinates match any known default patterns exactly
    for (const defaultBox of defaultBoxes) {
      if (x === defaultBox.x && y === defaultBox.y && 
          width === defaultBox.width && height === defaultBox.height) {
        console.warn(`⚠️  Detected known placeholder bounding box: ${JSON.stringify(bbox)}`);
        return true;
      }
    }
    
    // Check for suspicious patterns (round numbers that suggest placeholders)
    if (isSuspiciousPattern(x, y, width, height)) {
      return true;
    }
    
    // Check for suspiciously small faces (likely errors)
    if (width < 3 || height < 3) {
      console.warn(`⚠️  Face too small: width=${width}, height=${height}`);
      return true;
    }
    
    // Check for suspiciously large faces (likely errors)
    if (width > 95 || height > 95) {
      console.warn(`⚠️  Face too large: width=${width}, height=${height}`);
      return true;
    }
    
    // Check for faces that are clearly outside image bounds
    if (x < 0 || y < 0 || x + width > 100 || y + height > 100) {
      console.warn(`⚠️  Face coordinates outside image bounds: ${JSON.stringify(bbox)}`);
      return true;
    }
    
    return false;
  }
}

class OpenAIVisionProvider extends BaseAIProvider {
  constructor(config) {
    super(config);
    this.modelPricing = {
      'gpt-4o': { input: 0.005, output: 0.015 }, // per 1K tokens
      'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
      'gpt-4-vision-preview': { input: 0.01, output: 0.03 },
      'gpt-4-turbo': { input: 0.01, output: 0.03 }
    };
  }

  async detectFaces(imageUrl, visitorEventId = null) {
    if (!this.config.api_key) {
      throw new Error('OpenAI API key not configured');
    }

    const startTime = Date.now();
    const model = this.config.openai_model || 'gpt-4o';
    
    try {
      // Handle image URL - convert local paths to accessible URLs
      const processedImageUrl = await this.processImageUrl(imageUrl);
      
      const prompt = `You are a precise face detection system analyzing a doorbell camera image. Your task is to locate human faces with pixel-perfect accuracy.

CRITICAL INSTRUCTIONS:
1. EXAMINE THE IMAGE CAREFULLY: Look at every part of the image to find human faces
2. MEASURE PRECISELY: When you find a face, measure its exact location as percentages of the image dimensions
3. BE ACCURATE: Only provide coordinates if you can clearly see a face at that location
4. NO GUESSING: If you cannot clearly identify a face location, do not provide coordinates

FACE DETECTION REQUIREMENTS:
- Look for human faces, heads, or partial faces in the image
- Measure the bounding box that tightly contains the face/head area
- Provide coordinates as percentages: x=left edge, y=top edge, width=face width, height=face height
- Only report faces you can actually see and locate precisely
- Confidence should reflect how clearly you can see the face (not a guess)

COORDINATE ACCURACY:
- x: percentage from left edge of image to left edge of face
- y: percentage from top edge of image to top edge of face  
- width: percentage width of the face area
- height: percentage height of the face area
- Example: A face in the center-right taking up 15% width and 20% height might be: {"x": 60, "y": 40, "width": 15, "height": 20}

IMPORTANT: 
- DO NOT use placeholder coordinates like (40,30) or (25,25) or similar round numbers
- DO NOT guess face locations - only report what you can clearly see
- If you cannot locate a face precisely, set faces_detected to 0

Return ONLY valid JSON:
{
  "faces_detected": [number of faces you can actually locate],
  "faces": [
    {
      "id": 1,
      "bounding_box": {"x": [precise x%], "y": [precise y%], "width": [precise width%], "height": [precise height%]},
      "confidence": [0-100 based on face clarity],
      "description": "[describe the actual face you see]",
      "quality": "[clear/good/fair/poor]",
      "distinctive_features": ["actual", "features", "you", "observe"]
    }
  ],
  "objects_detected": [
    {
      "object": "[object you see]",
      "confidence": [0-100],
      "description": "[describe what you see]"
    }
  ],
  "scene_analysis": {
    "overall_confidence": [your confidence in this analysis],
    "description": "[describe what you observe]",
    "lighting": "[lighting conditions]",
    "image_quality": "[image quality assessment]"
  }
}

If no faces can be precisely located, return faces_detected: 0 and empty faces array.`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.api_key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: [{
            role: 'user',
            content: [{
              type: 'text',
              text: prompt
            }, {
              type: 'image_url',
              image_url: { 
                url: processedImageUrl,
                detail: 'high' // Use high detail for better face detection
              }
            }]
          }],
          max_tokens: 1000,
          temperature: 0.1 // Low temperature for consistent results
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenAI API error ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const processingTime = Date.now() - startTime;
      
      // Track usage and costs
      await this.trackUsage({
        model,
        operation_type: 'face_detection',
        visitor_event_id: visitorEventId,
        input_tokens: data.usage?.prompt_tokens || 0,
        output_tokens: data.usage?.completion_tokens || 0,
        total_tokens: data.usage?.total_tokens || 0,
        processing_time_ms: processingTime,
        success: true
      });

      // Parse and validate the response
      const content = data.choices[0].message.content;
      const result = this.parseOpenAIResponse(content);
      
      console.log(`OpenAI ${model} face detection completed in ${processingTime}ms`);
      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      // Track failed usage
      await this.trackUsage({
        model,
        operation_type: 'face_detection',
        visitor_event_id: visitorEventId,
        processing_time_ms: processingTime,
        success: false,
        error_message: error.message
      });

      console.error('OpenAI face detection error:', error);
      throw new Error(`Failed to detect faces with OpenAI: ${error.message}`);
    }
  }

  async processImageUrl(imageUrl) {
    // For ANY HTTP URL (including private networks like Home Assistant), 
    // convert to base64 since OpenAI cannot access private network URLs
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      console.log(`Converting remote URL to base64: ${imageUrl}`);
      return await this.convertUrlToBase64(imageUrl);
    }

    // For local images, we need to convert them to base64 data URLs
    // since OpenAI doesn't accept local file paths
    if (imageUrl.startsWith('/uploads/') || imageUrl.startsWith('./uploads/')) {
      return await this.convertImageToDataUrl(imageUrl);
    }

    // If it's a relative path, assume it's local
    return await this.convertImageToDataUrl(imageUrl);
  }

  async convertUrlToBase64(imageUrl) {
    try {
      console.log(`Fetching image from URL: ${imageUrl}`);
      
      const response = await fetch(imageUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': 'WhoRang-AI-Analysis/1.0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64Data = buffer.toString('base64');
      
      // Determine MIME type from response headers or URL extension
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      
      console.log(`Successfully converted image to base64: ${buffer.length} bytes`);
      return `data:${contentType};base64,${base64Data}`;
      
    } catch (error) {
      console.error('Error converting URL to base64:', error);
      throw new Error(`Failed to process image URL: ${error.message}`);
    }
  }

  async convertImageToDataUrl(imagePath) {
    const fs = require('fs').promises;
    const path = require('path');
    const mime = require('mime-types');

    try {
      let fullPath;
      if (imagePath.startsWith('/uploads/')) {
        fullPath = path.join(__dirname, '..', imagePath);
      } else if (imagePath.startsWith('./uploads/')) {
        fullPath = path.join(__dirname, '..', imagePath.substring(2));
      } else {
        fullPath = imagePath;
      }

      const imageBuffer = await fs.readFile(fullPath);
      const mimeType = mime.lookup(fullPath) || 'image/jpeg';
      const base64Data = imageBuffer.toString('base64');
      
      return `data:${mimeType};base64,${base64Data}`;
    } catch (error) {
      console.error('Error converting image to data URL:', error);
      throw new Error(`Failed to process image: ${error.message}`);
    }
  }

  parseOpenAIResponse(responseText) {
    try {
      console.log('Raw OpenAI response:', responseText);
      
      // Try to extract JSON from the response
      let jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.log('No JSON found in OpenAI response, creating default');
        return {
          faces_detected: 0,
          faces: [],
          objects_detected: [],
          scene_analysis: {
            overall_confidence: 0,
            description: 'No analysis available',
            lighting: 'unknown',
            image_quality: 'unknown'
          }
        };
      }
      
      const jsonStr = jsonMatch[0];
      const parsed = JSON.parse(jsonStr);
      
      // Validate and normalize the response structure
      return this.validateAndNormalizeResponse(parsed);
    } catch (error) {
      console.error('Error parsing OpenAI response:', error);
      return {
        faces_detected: 0,
        faces: [],
        objects_detected: [],
        scene_analysis: {
          overall_confidence: 0,
          description: 'Error in analysis',
          lighting: 'unknown',
          image_quality: 'unknown'
        }
      };
    }
  }

  validateAndNormalizeResponse(parsed) {
    // Validate the response structure (same as Ollama)
    if (typeof parsed.faces_detected !== 'number') {
      parsed.faces_detected = parsed.faces ? parsed.faces.length : 0;
    }
    
    if (!Array.isArray(parsed.faces)) {
      parsed.faces = [];
    }
    
    // Validate each face object with improved fallback detection
    parsed.faces = parsed.faces.map((face, index) => {
      let boundingBox = face.bounding_box;
      
      // Detect and reject obviously wrong bounding boxes
      if (!boundingBox || 
          !this.isValidBoundingBox(boundingBox) ||
          this.isDefaultBoundingBox(boundingBox)) {
        
        console.warn(`⚠️  Invalid or default bounding box detected for face ${index + 1}:`, boundingBox);
        console.warn(`⚠️  AI provider failed to detect actual face location - skipping this face`);
        
        // Return null to indicate this face should be skipped
        return null;
      }
      
      return {
        id: face.id || index + 1,
        bounding_box: boundingBox,
        confidence: Math.min(100, Math.max(0, face.confidence || 70)),
        description: face.description || 'Person detected',
        quality: face.quality || 'unknown',
        distinctive_features: Array.isArray(face.distinctive_features) ? face.distinctive_features : []
      };
    }).filter(face => face !== null); // Remove invalid faces
    
    // Update faces_detected count after filtering
    parsed.faces_detected = parsed.faces.length;
    
    // Validate objects_detected array
    if (!Array.isArray(parsed.objects_detected)) {
      parsed.objects_detected = [];
    }
    
    // Validate each object
    parsed.objects_detected = parsed.objects_detected.map((obj, index) => {
      return {
        object: obj.object || 'unknown',
        confidence: Math.min(100, Math.max(0, obj.confidence || 50)),
        description: obj.description || 'Object detected'
      };
    });
    
    // Validate scene_analysis
    if (!parsed.scene_analysis || typeof parsed.scene_analysis !== 'object') {
      parsed.scene_analysis = {
        overall_confidence: 70,
        description: 'Scene analysis completed',
        lighting: 'unknown',
        image_quality: 'unknown'
      };
    } else {
      parsed.scene_analysis = {
        overall_confidence: Math.min(100, Math.max(0, parsed.scene_analysis.overall_confidence || 70)),
        description: parsed.scene_analysis.description || 'Scene analysis completed',
        lighting: parsed.scene_analysis.lighting || 'unknown',
        image_quality: parsed.scene_analysis.image_quality || 'unknown'
      };
    }
    
    return parsed;
  }

  async trackUsage(usageData) {
    if (!this.config.cost_tracking_enabled) {
      return;
    }

    try {
      const db = require('../config/database').getDatabase();
      
      // Calculate cost based on token usage and model pricing
      const pricing = this.modelPricing[usageData.model] || this.modelPricing['gpt-4o'];
      const inputCost = (usageData.input_tokens / 1000) * pricing.input;
      const outputCost = (usageData.output_tokens / 1000) * pricing.output;
      const totalCost = inputCost + outputCost;

      const stmt = db.prepare(`
        INSERT INTO ai_usage_tracking (
          provider, model, operation_type, visitor_event_id,
          input_tokens, output_tokens, total_tokens, cost_usd,
          processing_time_ms, success, error_message, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        'openai',
        usageData.model,
        usageData.operation_type,
        usageData.visitor_event_id,
        usageData.input_tokens || 0,
        usageData.output_tokens || 0,
        usageData.total_tokens || 0,
        totalCost,
        usageData.processing_time_ms,
        usageData.success ? 1 : 0,
        usageData.error_message || null,
        new Date().toISOString()
      );

      console.log(`Tracked OpenAI usage: ${usageData.total_tokens} tokens, $${totalCost.toFixed(4)}`);
    } catch (error) {
      console.error('Error tracking OpenAI usage:', error);
    }
  }

  async generateFaceEncoding(imageUrl, faceData) {
    // For Ollama, use a simpler approach to avoid timeout issues
    // The face cropping service might be calling Ollama again, causing timeouts
    console.log('Generating face encoding for Ollama provider - using fallback method');
    
    try {
      // Create a deterministic encoding based on face data and image
      const crypto = require('crypto');
      const faceString = JSON.stringify({
        description: faceData.description,
        bounding_box: faceData.bounding_box,
        confidence: faceData.confidence,
        distinctive_features: faceData.distinctive_features,
        image_url: imageUrl
      });
      
      // Generate a more sophisticated hash-based encoding
      const hash = crypto.createHash('sha256').update(faceString).digest('hex');
      
      // Convert hash to a pseudo-embedding format (128 dimensions)
      const embedding = [];
      for (let i = 0; i < 128; i++) {
        const hexPair = hash.substr((i * 2) % hash.length, 2);
        const value = (parseInt(hexPair, 16) / 255) * 2 - 1; // Normalize to [-1, 1]
        embedding.push(value);
      }
      
      console.log('Generated fallback face encoding for Ollama');
      return JSON.stringify(embedding);
      
    } catch (error) {
      console.error('Error generating Ollama face encoding:', error);
      // Ultimate fallback to simple hash
      const crypto = require('crypto');
      return crypto.createHash('sha256').update(imageUrl + JSON.stringify(faceData)).digest('hex');
    }
  }

  // Static method to get available OpenAI models with enhanced filtering and caching
  static async getAvailableModels(apiKey, useCache = true) {
    try {
      // Check cache first if enabled
      if (useCache) {
        const cachedModels = await this.getCachedModels('openai');
        if (cachedModels && cachedModels.length > 0) {
          console.log('Using cached OpenAI models');
          return cachedModels;
        }
      }

      console.log('Fetching fresh OpenAI models from API...');
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Unable to fetch models from OpenAI`);
      }

      const data = await response.json();
      
      // Enhanced filtering for vision-capable models with deprecation awareness
      const visionModels = data.data.filter(model => {
        const name = model.id.toLowerCase();
        
        // Exclude known deprecated models
        const deprecatedModels = [
          'gpt-4-vision-preview',
          'gpt-4-1106-vision-preview',
          'gpt-4-0125-preview'
        ];
        
        if (deprecatedModels.includes(model.id)) {
          console.warn(`Filtering out deprecated model: ${model.id}`);
          return false;
        }
        
        // Include current vision-capable models
        return (
          name.includes('gpt-4o') || // GPT-4o and variants
          (name.includes('gpt-4') && name.includes('turbo')) || // GPT-4 Turbo
          name === 'gpt-4-turbo' ||
          name === 'gpt-4-turbo-2024-04-09'
        );
      });

      // Sort by preference (GPT-4o models first)
      visionModels.sort((a, b) => {
        const aIsGPT4o = a.id.includes('gpt-4o');
        const bIsGPT4o = b.id.includes('gpt-4o');
        
        if (aIsGPT4o && !bIsGPT4o) return -1;
        if (!aIsGPT4o && bIsGPT4o) return 1;
        return a.id.localeCompare(b.id);
      });

      const formattedModels = visionModels.map(model => ({
        value: model.id,
        label: this.formatModelLabel(model.id),
        created: model.created,
        owned_by: model.owned_by,
        deprecated: false,
        recommended: model.id === 'gpt-4o' || model.id === 'gpt-4o-mini'
      }));

      // Cache the results
      if (useCache && formattedModels.length > 0) {
        await this.cacheModels('openai', formattedModels);
      }

      console.log(`Found ${formattedModels.length} current OpenAI vision models`);
      return formattedModels;

    } catch (error) {
      console.error('Error fetching OpenAI models:', error);
      
      // Return updated fallback models (no deprecated ones)
      const fallbackModels = [
        { value: 'gpt-4o', label: 'GPT-4o (Recommended)', recommended: true, deprecated: false },
        { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Cost-effective)', recommended: true, deprecated: false },
        { value: 'gpt-4-turbo', label: 'GPT-4 Turbo', recommended: false, deprecated: false }
      ];
      
      console.log('Using fallback OpenAI models due to API error');
      return fallbackModels;
    }
  }

  // Helper method to format model labels
  static formatModelLabel(modelId) {
    const labelMap = {
      'gpt-4o': 'GPT-4o (Recommended)',
      'gpt-4o-mini': 'GPT-4o Mini (Cost-effective)',
      'gpt-4-turbo': 'GPT-4 Turbo',
      'gpt-4-turbo-2024-04-09': 'GPT-4 Turbo (April 2024)'
    };
    
    return labelMap[modelId] || modelId;
  }

  // Cache management methods
  static async getCachedModels(provider) {
    try {
      const db = require('../config/database').getDatabase();
      const stmt = db.prepare(`
        SELECT models_data, cached_at 
        FROM model_cache 
        WHERE provider = ? AND cached_at > datetime('now', '-24 hours')
      `);
      
      const result = stmt.get(provider);
      if (result) {
        return JSON.parse(result.models_data);
      }
      return null;
    } catch (error) {
      console.error('Error getting cached models:', error);
      return null;
    }
  }

  static async cacheModels(provider, models) {
    try {
      const db = require('../config/database').getDatabase();
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO model_cache (provider, models_data, cached_at)
        VALUES (?, ?, datetime('now'))
      `);
      
      stmt.run(provider, JSON.stringify(models));
      console.log(`Cached ${models.length} models for provider: ${provider}`);
    } catch (error) {
      console.error('Error caching models:', error);
    }
  }

  // Test API connection
  static async testConnection(apiKey, model = 'gpt-4o') {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API key validation failed: ${errorData.error?.message || 'Invalid API key'}`);
      }

      return {
        success: true,
        message: 'OpenAI API connection successful',
        models_available: true
      };
    } catch (error) {
      return {
        success: false,
        message: `OpenAI connection failed: ${error.message}`
      };
    }
  }
}

class LocalOllamaProvider extends BaseAIProvider {
  constructor(config) {
    super(config);
    // Ollama is free/local - no real costs should be tracked
    this.computeCostPerSecond = 0; // $0.00 - local Ollama is free
  }

  static makeHttpRequest(url, options = {}) {
    const http = require('http');
    const https = require('https');
    const { URL } = require('url');
    
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const client = isHttps ? https : http;
      
      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (isHttps ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        timeout: options.timeout || 60000 // Increased timeout for vision models (60 seconds)
      };

      const req = client.request(requestOptions, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const jsonData = JSON.parse(data);
            resolve({
              ok: res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode,
              data: jsonData
            });
          } catch (error) {
            resolve({
              ok: res.statusCode >= 200 && res.statusCode < 300,
              status: res.statusCode,
              data: data
            });
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      if (options.body) {
        req.write(JSON.stringify(options.body));
      }

      req.end();
    });
  }

  async detectFaces(imageUrl, visitorEventId = null) {
    const ollamaUrl = this.config.ollama_url || 'http://localhost:11434';
    const ollamaModel = this.config.ollama_model || 'llava';
    
    console.log('LocalOllamaProvider using URL:', ollamaUrl);
    console.log('LocalOllamaProvider using model:', ollamaModel);
    
    const startTime = Date.now();
    
    try {
      // Enhanced prompt for comprehensive scene analysis - optimized for Ollama
      const prompt = `You are analyzing a doorbell camera image. Look carefully at what you actually see in this specific image and provide a detailed analysis.

TASK: Analyze this doorbell camera image and describe exactly what you observe.

INSTRUCTIONS:
1. FACE DETECTION: Look for human faces in the image. For each face you see:
   - Provide bounding box coordinates as percentages (x, y, width, height) 
   - Give confidence level (0-100) based on how clearly you can see the face
   - Describe the person you actually observe
   - Assess image quality for that face
   - Note any distinctive features you can identify

2. OBJECT DETECTION: Identify objects, people, vehicles, packages, animals, etc. that you can actually see in this image. Be specific about what you observe.

3. SCENE ANALYSIS: Describe the overall scene, lighting conditions, and image quality based on what you actually see.

CRITICAL: Analyze THIS specific image. Do not use generic examples or placeholder descriptions. Describe what you actually observe.

Return ONLY valid JSON in this structure:
{
  "faces_detected": [number of faces you actually see],
  "faces": [
    {
      "id": [sequential number],
      "bounding_box": {"x": [actual percentage], "y": [actual percentage], "width": [actual percentage], "height": [actual percentage]},
      "confidence": [your confidence 0-100],
      "description": "[describe the actual person you see]",
      "quality": "[your assessment: clear/good/fair/poor]",
      "distinctive_features": ["list", "actual", "features", "you", "observe"]
    }
  ],
  "objects_detected": [
    {
      "object": "[actual object you see]",
      "confidence": [your confidence 0-100],
      "description": "[describe the specific object you observe]"
    }
  ],
  "scene_analysis": {
    "overall_confidence": [your confidence in this analysis],
    "description": "[describe the actual scene you observe]",
    "lighting": "[describe actual lighting: bright/good/dim/poor/etc]",
    "image_quality": "[assess actual quality: high/good/fair/poor]"
  }
}

If you see no faces, set faces_detected to 0 and faces to empty array. Always analyze what you actually observe in this specific image.`;

      // Convert image to base64 if it's a local path
      const imageBase64 = await this.convertImageToBase64(imageUrl);
      
      const response = await LocalOllamaProvider.makeHttpRequest(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: {
          model: ollamaModel,
          prompt: prompt,
          images: [imageBase64],
          stream: false,
          options: {
            temperature: 0.1, // Low temperature for consistent results
            top_p: 0.9,
            num_predict: 500
          }
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status} - Check if Ollama is running at ${ollamaUrl}`);
      }

      const processingTime = Date.now() - startTime;
      
      // Parse Ollama response
      const result = this.parseOllamaResponse(response.data);
      
      // Track usage for Ollama (estimate tokens and calculate compute cost)
      await this.trackUsage({
        model: ollamaModel,
        operation_type: 'face_detection',
        visitor_event_id: visitorEventId,
        estimated_tokens: this.estimateTokens(prompt, result),
        processing_time_ms: processingTime,
        success: true
      });
      
      console.log(`Ollama ${ollamaModel} face detection completed in ${processingTime}ms`);
      return result;
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      // Track failed usage
      await this.trackUsage({
        model: ollamaModel,
        operation_type: 'face_detection',
        visitor_event_id: visitorEventId,
        processing_time_ms: processingTime,
        success: false,
        error_message: error.message
      });
      
      console.error('Ollama face detection error:', error);
      throw new Error(`Failed to detect faces with Ollama at ${ollamaUrl}: ${error.message}`);
    }
  }

  async convertImageToBase64(imageUrl) {
    const fs = require('fs').promises;
    const path = require('path');
    const http = require('http');
    const https = require('https');
    
    try {
      let imageBuffer;
      
      if (imageUrl.startsWith('/uploads/')) {
        // Local file path
        const imagePath = path.join(__dirname, '..', imageUrl);
        imageBuffer = await fs.readFile(imagePath);
      } else if (imageUrl.startsWith('http')) {
        // Remote URL - download the image
        console.log('Downloading remote image:', imageUrl);
        imageBuffer = await this.downloadImage(imageUrl);
      } else {
        // Direct file path
        imageBuffer = await fs.readFile(imageUrl);
      }
      
      return imageBuffer.toString('base64');
    } catch (error) {
      console.error('Error converting image to base64:', error);
      throw error;
    }
  }

  async downloadImage(url) {
    const http = require('http');
    const https = require('https');
    const { URL } = require('url');
    
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;
      
      const request = client.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Doorbell-Face-Detection/1.0'
        }
      }, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download image: HTTP ${response.statusCode}`));
          return;
        }
        
        const chunks = [];
        
        response.on('data', (chunk) => {
          chunks.push(chunk);
        });
        
        response.on('end', () => {
          const buffer = Buffer.concat(chunks);
          console.log(`Downloaded image: ${buffer.length} bytes`);
          resolve(buffer);
        });
        
        response.on('error', (error) => {
          reject(error);
        });
      });
      
      request.on('error', (error) => {
        reject(error);
      });
      
      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Image download timeout'));
      });
    });
  }

  parseOllamaResponse(responseData) {
    try {
      // Extract the response text
      const responseText = responseData.response || responseData.message || '';
      console.log('Raw Ollama response:', responseText);
      
      // Try to extract JSON from the response
      let jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        // If no JSON found, create a default response
        console.log('No JSON found in response, creating default');
        return {
          faces_detected: 0,
          faces: [],
          objects_detected: [],
          scene_analysis: {
            overall_confidence: 0,
            description: 'No analysis available',
            lighting: 'unknown',
            image_quality: 'unknown'
          }
        };
      }
      
      let jsonStr = jsonMatch[0];
      let parsed;
      
      // Try to parse JSON, if it fails due to truncation, attempt to fix it
      try {
        parsed = JSON.parse(jsonStr);
      } catch (parseError) {
        console.warn('⚠️  JSON parsing failed, attempting to fix truncated response...');
        console.warn('Parse error:', parseError.message);
        
        // Attempt to fix common truncation issues
        const fixedJson = this.fixTruncatedJson(jsonStr);
        if (fixedJson) {
          console.log('✅ Successfully fixed truncated JSON');
          parsed = JSON.parse(fixedJson);
        } else {
          console.error('❌ Could not fix truncated JSON, using fallback');
          throw parseError;
        }
      }
      
      // Validate the response structure
      if (typeof parsed.faces_detected !== 'number') {
        parsed.faces_detected = parsed.faces ? parsed.faces.length : 0;
      }
      
      if (!Array.isArray(parsed.faces)) {
        parsed.faces = [];
      }
      
      // Validate each face object with basic fallback
      parsed.faces = parsed.faces.map((face, index) => {
        return {
          id: face.id || index + 1,
          bounding_box: face.bounding_box || { x: 25, y: 25, width: 50, height: 50 },
          confidence: Math.min(100, Math.max(0, face.confidence || 70)),
          description: face.description || 'Person detected',
          quality: face.quality || 'unknown',
          distinctive_features: Array.isArray(face.distinctive_features) ? face.distinctive_features : []
        };
      });

      // Apply Ollama face cropping fix to improve coordinate accuracy
      // Now that JSON truncation is fixed, we can apply coordinate tightening for better crops
      if (parsed.faces.length > 0) {
        console.log('🔧 Applying Ollama face cropping improvement...');
        const ollamaFaceCroppingFix = require('./ollamaFaceCroppingFix');
        
        const originalFaces = [...parsed.faces];
        parsed.faces = ollamaFaceCroppingFix.fixOllamaFaceCoordinates(parsed.faces);
        
        // Update faces_detected count after fixing
        parsed.faces_detected = parsed.faces.length;
        
        // Log improvement statistics
        const stats = ollamaFaceCroppingFix.getCroppingStats(originalFaces, parsed.faces);
        console.log('📊 Ollama face cropping stats:', stats);
      }
      
      // Validate objects_detected array
      if (!Array.isArray(parsed.objects_detected)) {
        parsed.objects_detected = [];
      }
      
      // Validate each object
      parsed.objects_detected = parsed.objects_detected.map((obj, index) => {
        return {
          object: obj.object || 'unknown',
          confidence: Math.min(100, Math.max(0, obj.confidence || 50)),
          description: obj.description || 'Object detected'
        };
      });
      
      // Validate scene_analysis
      if (!parsed.scene_analysis || typeof parsed.scene_analysis !== 'object') {
        parsed.scene_analysis = {
          overall_confidence: 70,
          description: 'Scene analysis completed',
          lighting: 'unknown',
          image_quality: 'unknown'
        };
      } else {
        parsed.scene_analysis = {
          overall_confidence: Math.min(100, Math.max(0, parsed.scene_analysis.overall_confidence || 70)),
          description: parsed.scene_analysis.description || 'Scene analysis completed',
          lighting: parsed.scene_analysis.lighting || 'unknown',
          image_quality: parsed.scene_analysis.image_quality || 'unknown'
        };
      }
      
      return parsed;
    } catch (error) {
      console.error('Error parsing Ollama response:', error);
      // Return a safe default
      return {
        faces_detected: 0,
        faces: [],
        objects_detected: [],
        scene_analysis: {
          overall_confidence: 0,
          description: 'Error in analysis',
          lighting: 'unknown',
          image_quality: 'unknown'
        }
      };
    }
  }

  /**
   * Attempt to fix truncated JSON responses from Ollama
   */
  fixTruncatedJson(jsonStr) {
    try {
      // Common truncation patterns and fixes
      let fixed = jsonStr.trim();
      
      console.log('🔧 Attempting to fix JSON truncation...');
      console.log('Original length:', fixed.length);
      
      // Handle incomplete strings at the end
      if (fixed.match(/"[^"]*$/)) {
        console.log('🔧 Found incomplete string at end, closing it...');
        fixed += '"';
      }
      
      // Handle incomplete property values
      if (fixed.match(/:\s*"[^"]*$/)) {
        console.log('🔧 Found incomplete property value, closing it...');
        fixed += '"';
      }
      
      // Remove trailing commas
      if (fixed.match(/,\s*$/)) {
        console.log('🔧 Removing trailing comma...');
        fixed = fixed.replace(/,\s*$/, '');
      }
      
      // Count and balance braces
      const openBraces = (fixed.match(/\{/g) || []).length;
      const closeBraces = (fixed.match(/\}/g) || []).length;
      const openBrackets = (fixed.match(/\[/g) || []).length;
      const closeBrackets = (fixed.match(/\]/g) || []).length;
      
      // Add missing closing brackets first
      const missingBrackets = openBrackets - closeBrackets;
      if (missingBrackets > 0) {
        console.log(`🔧 Adding ${missingBrackets} missing closing brackets...`);
        fixed += ']'.repeat(missingBrackets);
      }
      
      // Add missing closing braces
      const missingBraces = openBraces - closeBraces;
      if (missingBraces > 0) {
        console.log(`🔧 Adding ${missingBraces} missing closing braces...`);
        fixed += '}'.repeat(missingBraces);
      }
      
      console.log('🔧 Fixed JSON length:', fixed.length);
      
      // Try to parse the fixed JSON
      JSON.parse(fixed);
      console.log('✅ JSON fix successful!');
      return fixed;
      
    } catch (error) {
      console.warn('❌ Could not fix truncated JSON:', error.message);
      console.warn('Fixed JSON was:', fixed.substring(fixed.length - 100)); // Show last 100 chars
      return null;
    }
  }

  // Estimate tokens for Ollama (since it doesn't provide token counts)
  estimateTokens(prompt, response) {
    // Rough estimation: ~4 characters per token
    const promptTokens = Math.ceil(prompt.length / 4);
    const responseTokens = Math.ceil(JSON.stringify(response).length / 4);
    return {
      input_tokens: promptTokens,
      output_tokens: responseTokens,
      total_tokens: promptTokens + responseTokens
    };
  }

  async trackUsage(usageData) {
    if (!this.config.cost_tracking_enabled) {
      return;
    }

    try {
      const db = require('../config/database').getDatabase();
      
      // Calculate compute cost based on processing time for Ollama
      const computeCost = (usageData.processing_time_ms / 1000) * this.computeCostPerSecond;
      
      // Get token estimates
      const tokens = usageData.estimated_tokens || { input_tokens: 0, output_tokens: 0, total_tokens: 0 };

      const stmt = db.prepare(`
        INSERT INTO ai_usage_tracking (
          provider, model, operation_type, visitor_event_id,
          input_tokens, output_tokens, total_tokens, cost_usd,
          processing_time_ms, success, error_message, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        'ollama',
        usageData.model,
        usageData.operation_type,
        usageData.visitor_event_id,
        tokens.input_tokens,
        tokens.output_tokens,
        tokens.total_tokens,
        computeCost,
        usageData.processing_time_ms,
        usageData.success ? 1 : 0,
        usageData.error_message || null,
        new Date().toISOString()
      );

      console.log(`Tracked Ollama usage: ${tokens.total_tokens} tokens (estimated), free local processing`);
    } catch (error) {
      console.error('Error tracking Ollama usage:', error);
    }
  }

  async generateFaceEncoding(imageUrl, faceData) {
    // For Ollama, use a simpler approach to avoid timeout issues
    // The face cropping service might be calling Ollama again, causing timeouts
    console.log('Generating face encoding for Ollama provider - using fallback method');
    
    try {
      // Create a deterministic encoding based on face data and image
      const crypto = require('crypto');
      const faceString = JSON.stringify({
        description: faceData.description,
        bounding_box: faceData.bounding_box,
        confidence: faceData.confidence,
        distinctive_features: faceData.distinctive_features,
        image_url: imageUrl
      });
      
      // Generate a more sophisticated hash-based encoding
      const hash = crypto.createHash('sha256').update(faceString).digest('hex');
      
      // Convert hash to a pseudo-embedding format (128 dimensions)
      const embedding = [];
      for (let i = 0; i < 128; i++) {
        const hexPair = hash.substr((i * 2) % hash.length, 2);
        const value = (parseInt(hexPair, 16) / 255) * 2 - 1; // Normalize to [-1, 1]
        embedding.push(value);
      }
      
      console.log('Generated fallback face encoding for Ollama');
      return JSON.stringify(embedding);
      
    } catch (error) {
      console.error('Error generating Ollama face encoding:', error);
      // Ultimate fallback to simple hash
      const crypto = require('crypto');
      return crypto.createHash('sha256').update(imageUrl + JSON.stringify(faceData)).digest('hex');
    }
  }

  // Static method to get available Ollama models with vision capability filtering
  static async getAvailableModels(ollamaUrl = 'http://localhost:11434', useCache = true) {
    try {
      // Check cache first if enabled
      if (useCache) {
        const cachedModels = await OpenAIVisionProvider.getCachedModels('ollama');
        if (cachedModels && cachedModels.length > 0) {
          console.log('Using cached Ollama models');
          return cachedModels;
        }
      }

      console.log(`Fetching fresh Ollama models from ${ollamaUrl}...`);
      
      // Fetch models from Ollama API
      const response = await LocalOllamaProvider.makeHttpRequest(`${ollamaUrl}/api/tags`, {
        method: 'GET',
        timeout: 10000 // 10 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Unable to fetch models from Ollama at ${ollamaUrl}`);
      }

      const data = response.data;
      
      // Show ALL models - let user decide which ones work for vision
      const allModels = data.models || [];

      // Sort by name for consistent ordering
      allModels.sort((a, b) => a.name.localeCompare(b.name));

      const formattedModels = allModels.map(model => ({
        value: model.name,
        label: this.formatOllamaModelLabel(model.name),
        size: model.size,
        modified_at: model.modified_at,
        digest: model.digest,
        is_vision: true,
        recommended: model.name.toLowerCase().includes('llava')
      }));

      // Cache the results
      if (useCache && formattedModels.length > 0) {
        await OpenAIVisionProvider.cacheModels('ollama', formattedModels);
      }

      console.log(`Found ${formattedModels.length} vision-capable Ollama models`);
      return formattedModels;

    } catch (error) {
      console.error('Error fetching Ollama models:', error);
      
      // Return enhanced fallback models including common vision models
      const fallbackModels = [
        { value: 'llava:latest', label: 'LLaVA Latest (Recommended)', recommended: true, is_vision: true },
        { value: 'llava:7b', label: 'LLaVA 7B', recommended: false, is_vision: true },
        { value: 'llava:13b', label: 'LLaVA 13B', recommended: false, is_vision: true },
        { value: 'llava-phi3:latest', label: 'LLaVA Phi3 Latest', recommended: true, is_vision: true },
        { value: 'bakllava:latest', label: 'BakLLaVA Latest', recommended: false, is_vision: true },
        { value: 'cogvlm:latest', label: 'CogVLM Latest', recommended: false, is_vision: true },
        { value: 'gemma3:1b', label: 'Gemma 3 1B (Multimodal)', recommended: false, is_vision: true },
        { value: 'gemma2:2b', label: 'Gemma 2 2B', recommended: false, is_vision: true }
      ];
      
      console.log('Using fallback Ollama models due to API error');
      return fallbackModels;
    }
  }

  // Helper method to format Ollama model labels
  static formatOllamaModelLabel(modelName) {
    // Extract base name and size/variant
    const parts = modelName.split(':');
    const baseName = parts[0];
    const variant = parts[1] || 'latest';
    
    // Create user-friendly labels
    const labelMap = {
      'llava': 'LLaVA',
      'llava-phi3': 'LLaVA Phi3',
      'bakllava': 'BakLLaVA',
      'cogvlm': 'CogVLM',
      'gemma3': 'Gemma 3',
      'gemma2': 'Gemma 2',
      'minicpm': 'MiniCPM-V',
      'internvl': 'InternVL',
      'qwen-vl': 'Qwen-VL',
      'yi-vl': 'Yi-VL'
    };
    
    const friendlyName = labelMap[baseName] || baseName.toUpperCase();
    
    if (variant === 'latest') {
      return `${friendlyName} Latest`;
    } else {
      return `${friendlyName} ${variant.toUpperCase()}`;
    }
  }

  // Test Ollama connection
  static async testConnection(ollamaUrl = 'http://localhost:11434') {
    try {
      const response = await LocalOllamaProvider.makeHttpRequest(`${ollamaUrl}/api/tags`, {
        method: 'GET',
        timeout: 5000
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Unable to connect to Ollama`);
      }

      const data = response.data;
      const modelCount = data.models ? data.models.length : 0;

      return {
        success: true,
        message: `Ollama connection successful. Found ${modelCount} models.`,
        models_available: modelCount > 0,
        ollama_url: ollamaUrl
      };
    } catch (error) {
      return {
        success: false,
        message: `Ollama connection failed: ${error.message}`,
        ollama_url: ollamaUrl,
        suggestions: [
          'Verify Ollama is running and accessible',
          'Check if the Ollama URL is correct',
          'Ensure Ollama API is enabled',
          'Try restarting the Ollama service'
        ]
      };
    }
  }
}

class GoogleGeminiProvider extends BaseAIProvider {
  constructor(config) {
    super(config);
    // Google Gemini pricing model
    this.modelPricing = {
      'gemini-pro-vision': { input: 0.00025, output: 0.00075 }, // per 1K tokens
      'gemini-1.5-pro': { input: 0.00125, output: 0.005 },
      'gemini-1.5-flash': { input: 0.000075, output: 0.0003 }
    };
  }

  async detectFaces(imageUrl, visitorEventId = null) {
    if (!this.config.api_key) {
      throw new Error('Google Gemini API key not configured');
    }

    const startTime = Date.now();
    const model = this.config.gemini_model || 'gemini-1.5-flash';

    try {
      // Convert image to base64 if needed
      const imageBase64 = await this.convertImageToBase64(imageUrl);

      const prompt = `Analyze this doorbell camera image and provide a comprehensive analysis. Look carefully at what you actually see in the image.

INSTRUCTIONS:
1. FACE DETECTION: Identify all human faces visible in the image. For each face, provide:
   - Exact bounding box coordinates as percentages (x, y, width, height)
   - Confidence level (0-100) based on clarity and visibility
   - Detailed description of what you observe
   - Quality assessment (clear/good/fair/poor)
   - Any distinctive features you can identify

2. OBJECT DETECTION: Identify all significant objects, people, vehicles, packages, animals, etc. that you can see. Provide confidence levels based on how certain you are about each identification.

3. SCENE ANALYSIS: Provide your overall assessment of the image quality, lighting conditions, and general scene description.

IMPORTANT: Analyze what you actually see in THIS specific image. Do not use generic examples or placeholder data.

Return ONLY valid JSON in this structure:
{
  "faces_detected": [number of faces you actually detected],
  "faces": [
    {
      "id": [sequential number],
      "bounding_box": {"x": [actual x%], "y": [actual y%], "width": [actual width%], "height": [actual height%]},
      "confidence": [your confidence 0-100],
      "description": "[describe what you actually see]",
      "quality": "[your assessment of image quality]",
      "distinctive_features": ["list", "actual", "features", "you", "observe"]
    }
  ],
  "objects_detected": [
    {
      "object": "[actual object type you see]",
      "confidence": [your confidence 0-100],
      "description": "[describe the specific object you see]"
    }
  ],
  "scene_analysis": {
    "overall_confidence": [your overall confidence in the analysis],
    "description": "[describe the actual scene you observe]",
    "lighting": "[describe actual lighting conditions]",
    "image_quality": "[assess actual image quality]"
  }
}

If no faces are detected, set faces_detected to 0 and faces to empty array. Always include objects_detected and scene_analysis based on what you actually observe.`;

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.config.api_key}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: imageBase64
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1000
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Gemini API error ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const processingTime = Date.now() - startTime;

      // Track usage and costs
      await this.trackUsage({
        model,
        operation_type: 'face_detection',
        visitor_event_id: visitorEventId,
        input_tokens: data.usageMetadata?.promptTokenCount || 0,
        output_tokens: data.usageMetadata?.candidatesTokenCount || 0,
        processing_time_ms: processingTime,
        success: true
      });

      // Parse and validate the response
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const result = this.parseGeminiResponse(content);
      
      console.log(`Gemini ${model} face detection completed in ${processingTime}ms`);
      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      // Track failed usage
      await this.trackUsage({
        model,
        operation_type: 'face_detection',
        visitor_event_id: visitorEventId,
        processing_time_ms: processingTime,
        success: false,
        error_message: error.message
      });

      console.error('Gemini face detection error:', error);
      throw new Error(`Failed to detect faces with Gemini: ${error.message}`);
    }
  }

  async convertImageToBase64(imageUrl) {
    const fs = require('fs').promises;
    const path = require('path');
    
    try {
      let imageBuffer;
      
      if (imageUrl.startsWith('/uploads/')) {
        // Local file path
        const imagePath = path.join(__dirname, '..', imageUrl);
        imageBuffer = await fs.readFile(imagePath);
      } else if (imageUrl.startsWith('http')) {
        // Remote URL - download the image
        console.log('Downloading remote image for Gemini:', imageUrl);
        imageBuffer = await this.downloadImage(imageUrl);
      } else {
        // Direct file path
        imageBuffer = await fs.readFile(imageUrl);
      }
      
      return imageBuffer.toString('base64');
    } catch (error) {
      console.error('Error converting image to base64 for Gemini:', error);
      throw error;
    }
  }

  async downloadImage(url) {
    const http = require('http');
    const https = require('https');
    const { URL } = require('url');
    
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;
      
      const request = client.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Doorbell-Face-Detection/1.0'
        }
      }, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download image: HTTP ${response.statusCode}`));
          return;
        }
        
        const chunks = [];
        
        response.on('data', (chunk) => {
          chunks.push(chunk);
        });
        
        response.on('end', () => {
          const buffer = Buffer.concat(chunks);
          console.log(`Downloaded image for Gemini: ${buffer.length} bytes`);
          resolve(buffer);
        });
        
        response.on('error', (error) => {
          reject(error);
        });
      });
      
      request.on('error', (error) => {
        reject(error);
      });
      
      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Image download timeout'));
      });
    });
  }

  parseGeminiResponse(responseText) {
    try {
      console.log('Raw Gemini response:', responseText);
      
      // ENHANCED: Handle multiple JSON blocks that Gemini sometimes returns
      let parsed;
      
      if (typeof responseText === 'string') {
        // Try to parse as direct JSON first
        try {
          parsed = JSON.parse(responseText);
          console.log('✅ Gemini returned clean JSON');
        } catch (parseError) {
          // Fallback to regex parsing - but handle multiple JSON blocks
          console.log('⚠️  Gemini response not clean JSON, extracting with regex');
          
          // Find complete JSON documents (not nested objects)
          // Look for JSON that starts with { and has balanced braces
          const jsonMatches = [];
          let braceCount = 0;
          let startIndex = -1;
          
          for (let i = 0; i < responseText.length; i++) {
            const char = responseText[i];
            
            if (char === '{') {
              if (braceCount === 0) {
                startIndex = i; // Start of a new JSON document
              }
              braceCount++;
            } else if (char === '}') {
              braceCount--;
              if (braceCount === 0 && startIndex !== -1) {
                // Complete JSON document found
                const jsonStr = responseText.substring(startIndex, i + 1);
                jsonMatches.push(jsonStr);
                startIndex = -1;
              }
            }
          }
          
          if (!jsonMatches || jsonMatches.length === 0) {
            throw new Error('No JSON found in response');
          }
          
          // If multiple JSON blocks found, this might be the duplicate issue!
          if (jsonMatches.length > 1) {
            console.warn(`🚨 GEMINI DUPLICATE ISSUE DETECTED: Found ${jsonMatches.length} JSON blocks in response!`);
            console.warn('JSON blocks:', jsonMatches);
            
            // Try to parse each block and merge them intelligently
            const parsedBlocks = [];
            for (const jsonStr of jsonMatches) {
              try {
                const block = JSON.parse(jsonStr);
                parsedBlocks.push(block);
              } catch (blockError) {
                console.warn('Failed to parse JSON block:', jsonStr, blockError);
              }
            }
            
            if (parsedBlocks.length > 0) {
              // Use the first valid block as base, but log the issue
              parsed = parsedBlocks[0];
              console.log(`🔧 Using first valid JSON block, ignoring ${parsedBlocks.length - 1} duplicates`);
            } else {
              throw new Error('No valid JSON blocks found');
            }
          } else {
            // Single JSON block - normal case
            parsed = JSON.parse(jsonMatches[0]);
          }
        }
      } else if (typeof responseText === 'object') {
        // If it's already an object, use it directly
        parsed = responseText;
        console.log('✅ Gemini returned structured object');
      } else {
        throw new Error('Unexpected response format');
      }
      
      // Validate and normalize the response structure
      return this.validateAndNormalizeResponse(parsed);
      
    } catch (error) {
      console.error('Error parsing Gemini response:', error);
      console.error('Response text:', responseText);
      return {
        faces_detected: 0,
        faces: [],
        objects_detected: [],
        scene_analysis: {
          overall_confidence: 0,
          description: 'Error in analysis - JSON parsing failed',
          lighting: 'unknown',
          image_quality: 'unknown'
        }
      };
    }
  }

  validateAndNormalizeResponse(parsed) {
    // Use the same validation logic as other providers
    if (typeof parsed.faces_detected !== 'number') {
      parsed.faces_detected = parsed.faces ? parsed.faces.length : 0;
    }
    
    if (!Array.isArray(parsed.faces)) {
      parsed.faces = [];
    }
    
    // Validate each face object
    parsed.faces = parsed.faces.map((face, index) => {
      return {
        id: face.id || index + 1,
        bounding_box: face.bounding_box || { x: 25, y: 25, width: 50, height: 50 },
        confidence: Math.min(100, Math.max(0, face.confidence || 70)),
        description: face.description || 'Person detected',
        quality: face.quality || 'unknown',
        distinctive_features: Array.isArray(face.distinctive_features) ? face.distinctive_features : []
      };
    });
    
    // ENHANCED: Apply face deduplication for Gemini (which tends to produce duplicates)
    if (parsed.faces.length > 1) {
      console.log(`🔍 Gemini detected ${parsed.faces.length} faces, checking for duplicates...`);
      
      const faceDeduplicationService = require('./faceDeduplication');
      const originalCount = parsed.faces.length;
      
      // Deduplicate faces
      parsed.faces = faceDeduplicationService.deduplicateFaces(parsed.faces);
      
      // Update faces_detected count after deduplication
      parsed.faces_detected = parsed.faces.length;
      
      // Log deduplication results
      const stats = faceDeduplicationService.getDeduplicationStats(
        { length: originalCount }, 
        parsed.faces
      );
      
      if (stats.duplicatesRemoved > 0) {
        console.log(`🎯 Gemini deduplication: ${originalCount} → ${parsed.faces.length} faces (removed ${stats.duplicatesRemoved} duplicates)`);
        
        // Update scene analysis to reflect deduplication
        if (parsed.scene_analysis) {
          parsed.scene_analysis.description = `${parsed.scene_analysis.description} (${stats.duplicatesRemoved} duplicate faces merged)`;
        }
      }
    }
    
    // Validate objects_detected array
    if (!Array.isArray(parsed.objects_detected)) {
      parsed.objects_detected = [];
    }
    
    // Validate each object
    parsed.objects_detected = parsed.objects_detected.map((obj, index) => {
      return {
        object: obj.object || 'unknown',
        confidence: Math.min(100, Math.max(0, obj.confidence || 50)),
        description: obj.description || 'Object detected'
      };
    });
    
    // Validate scene_analysis
    if (!parsed.scene_analysis || typeof parsed.scene_analysis !== 'object') {
      parsed.scene_analysis = {
        overall_confidence: 70,
        description: 'Scene analysis completed',
        lighting: 'unknown',
        image_quality: 'unknown'
      };
    } else {
      parsed.scene_analysis = {
        overall_confidence: Math.min(100, Math.max(0, parsed.scene_analysis.overall_confidence || 70)),
        description: parsed.scene_analysis.description || 'Scene analysis completed',
        lighting: parsed.scene_analysis.lighting || 'unknown',
        image_quality: parsed.scene_analysis.image_quality || 'unknown'
      };
    }
    
    return parsed;
  }

  async trackUsage(usageData) {
    if (!this.config.cost_tracking_enabled) {
      return;
    }

    try {
      const db = require('../config/database').getDatabase();
      
      // Calculate cost based on token usage and model pricing
      const pricing = this.modelPricing[usageData.model] || this.modelPricing['gemini-pro-vision'];
      const inputCost = (usageData.input_tokens / 1000) * pricing.input;
      const outputCost = (usageData.output_tokens / 1000) * pricing.output;
      const totalCost = inputCost + outputCost;

      const stmt = db.prepare(`
        INSERT INTO ai_usage_tracking (
          provider, model, operation_type, visitor_event_id,
          input_tokens, output_tokens, total_tokens, cost_usd,
          processing_time_ms, success, error_message, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        'gemini',
        usageData.model,
        usageData.operation_type,
        usageData.visitor_event_id,
        usageData.input_tokens || 0,
        usageData.output_tokens || 0,
        (usageData.input_tokens || 0) + (usageData.output_tokens || 0),
        totalCost,
        usageData.processing_time_ms,
        usageData.success ? 1 : 0,
        usageData.error_message || null,
        new Date().toISOString()
      );

      console.log(`Tracked Gemini usage: ${(usageData.input_tokens || 0) + (usageData.output_tokens || 0)} tokens, $${totalCost.toFixed(4)}`);
    } catch (error) {
      console.error('Error tracking Gemini usage:', error);
    }
  }

  async generateFaceEncoding(imageUrl, faceData) {
    // Use the face cropping service to generate proper embeddings
    const faceCroppingService = require('./faceCroppingService');
    
    try {
      const embeddingResult = await faceCroppingService.generateFaceEmbedding(
        imageUrl, 
        faceData.description
      );
      
      return JSON.stringify(embeddingResult.embedding);
    } catch (error) {
      console.error('Error generating face encoding:', error);
      // Fallback to simple hash
      const crypto = require('crypto');
      return crypto.createHash('sha256').update(imageUrl + JSON.stringify(faceData)).digest('hex');
    }
  }

  // Static method to get available Gemini models with deprecation awareness
  static async getAvailableModels(apiKey, useCache = true) {
    try {
      // Check cache first if enabled
      if (useCache) {
        const cachedModels = await OpenAIVisionProvider.getCachedModels('gemini');
        if (cachedModels && cachedModels.length > 0) {
          console.log('Using cached Gemini models');
          return cachedModels;
        }
      }

      console.log('Fetching fresh Gemini models...');
      
      // Gemini doesn't have a models list endpoint, so we return current known models
      // with deprecation awareness
      const currentModels = [
        { 
          value: 'gemini-1.5-flash', 
          label: 'Gemini 1.5 Flash (Recommended)',
          pricing: { input: 0.000075, output: 0.0003 },
          deprecated: false,
          recommended: true
        },
        { 
          value: 'gemini-1.5-pro', 
          label: 'Gemini 1.5 Pro (Most Capable)',
          pricing: { input: 0.00125, output: 0.005 },
          deprecated: false,
          recommended: false
        },
        { 
          value: 'gemini-1.5-flash-8b', 
          label: 'Gemini 1.5 Flash 8B (Ultra Fast)',
          pricing: { input: 0.0000375, output: 0.00015 },
          deprecated: false,
          recommended: false
        }
      ];

      // Filter out deprecated models and add warnings
      const deprecatedModels = [
        'gemini-pro-vision',
        'gemini-1.0-pro-vision',
        'gemini-1.0-pro'
      ];

      // Add deprecated models with warnings for reference
      const deprecatedModelsList = [
        { 
          value: 'gemini-pro-vision', 
          label: 'Gemini Pro Vision (DEPRECATED - Use 1.5 Flash)',
          pricing: { input: 0.00025, output: 0.00075 },
          deprecated: true,
          recommended: false,
          deprecation_message: 'Deprecated July 12, 2024. Use gemini-1.5-flash instead.'
        }
      ];

      // Combine current and deprecated (for migration purposes)
      const allModels = [...currentModels, ...deprecatedModelsList];

      // Cache the results
      if (useCache && currentModels.length > 0) {
        await OpenAIVisionProvider.cacheModels('gemini', allModels);
      }

      console.log(`Found ${currentModels.length} current Gemini models`);
      return allModels;

    } catch (error) {
      console.error('Error fetching Gemini models:', error);
      
      // Return updated fallback models (no deprecated ones by default)
      const fallbackModels = [
        { 
          value: 'gemini-1.5-flash', 
          label: 'Gemini 1.5 Flash (Recommended)', 
          recommended: true, 
          deprecated: false 
        },
        { 
          value: 'gemini-1.5-pro', 
          label: 'Gemini 1.5 Pro (Most Capable)', 
          recommended: false, 
          deprecated: false 
        }
      ];
      
      console.log('Using fallback Gemini models');
      return fallbackModels;
    }
  }

  // Test API connection
  static async testConnection(apiKey, model = 'gemini-pro-vision') {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: 'Test connection' }]
          }]
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API key validation failed: ${errorData.error?.message || 'Invalid API key'}`);
      }

      return {
        success: true,
        message: 'Gemini API connection successful',
        models_available: true
      };
    } catch (error) {
      return {
        success: false,
        message: `Gemini connection failed: ${error.message}`
      };
    }
  }
}

class GoogleCloudVisionProvider extends BaseAIProvider {
  constructor(config) {
    super(config);
    // Google Cloud Vision pricing: $1.50 per 1K images = $0.0015 per image
    this.costPerImage = 0.0015;
  }

  async detectFaces(imageUrl, visitorEventId = null) {
    if (!this.config.api_key) {
      throw new Error('Google Cloud Vision API key not configured');
    }

    const startTime = Date.now();

    try {
      // Convert image to base64 if needed
      const imageBase64 = await this.convertImageToBase64(imageUrl);

      // Google Cloud Vision Face Detection API
      const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${this.config.api_key}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requests: [{
            image: {
              content: imageBase64
            },
            features: [
              {
                type: 'FACE_DETECTION',
                maxResults: 50
              },
              {
                type: 'OBJECT_LOCALIZATION',
                maxResults: 50
              }
            ]
          }]
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Google Cloud Vision API error ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const processingTime = Date.now() - startTime;

      // Track usage and costs
      await this.trackUsage({
        operation_type: 'face_detection',
        visitor_event_id: visitorEventId,
        processing_time_ms: processingTime,
        success: true
      });

      // Parse and validate the response
      const result = this.parseGoogleCloudResponse(data.responses[0]);
      
      console.log(`Google Cloud Vision face detection completed in ${processingTime}ms`);
      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      // Track failed usage
      await this.trackUsage({
        operation_type: 'face_detection',
        visitor_event_id: visitorEventId,
        processing_time_ms: processingTime,
        success: false,
        error_message: error.message
      });

      console.error('Google Cloud Vision face detection error:', error);
      throw new Error(`Failed to detect faces with Google Cloud Vision: ${error.message}`);
    }
  }

  async convertImageToBase64(imageUrl) {
    const fs = require('fs').promises;
    const path = require('path');
    
    try {
      let imageBuffer;
      
      if (imageUrl.startsWith('/uploads/')) {
        // Local file path
        const imagePath = path.join(__dirname, '..', imageUrl);
        imageBuffer = await fs.readFile(imagePath);
      } else if (imageUrl.startsWith('http')) {
        // Remote URL - download the image
        console.log('Downloading remote image for Google Cloud Vision:', imageUrl);
        imageBuffer = await this.downloadImage(imageUrl);
      } else {
        // Direct file path
        imageBuffer = await fs.readFile(imageUrl);
      }
      
      return imageBuffer.toString('base64');
    } catch (error) {
      console.error('Error converting image to base64 for Google Cloud Vision:', error);
      throw error;
    }
  }

  async downloadImage(url) {
    const http = require('http');
    const https = require('https');
    const { URL } = require('url');
    
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;
      
      const request = client.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Doorbell-Face-Detection/1.0'
        }
      }, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download image: HTTP ${response.statusCode}`));
          return;
        }
        
        const chunks = [];
        
        response.on('data', (chunk) => {
          chunks.push(chunk);
        });
        
        response.on('end', () => {
          const buffer = Buffer.concat(chunks);
          console.log(`Downloaded image for Google Cloud Vision: ${buffer.length} bytes`);
          resolve(buffer);
        });
        
        response.on('error', (error) => {
          reject(error);
        });
      });
      
      request.on('error', (error) => {
        reject(error);
      });
      
      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Image download timeout'));
      });
    });
  }

  parseGoogleCloudResponse(response) {
    try {
      console.log('Raw Google Cloud Vision response:', JSON.stringify(response, null, 2));
      
      const faces = response.faceAnnotations || [];
      const objects = response.localizedObjectAnnotations || [];
      
      // Convert Google Cloud Vision faces to our format
      const convertedFaces = faces.map((face, index) => {
        // Google Cloud Vision provides normalized coordinates (0-1)
        // Convert to percentages (0-100)
        const boundingPoly = face.boundingPoly || face.fdBoundingPoly;
        let boundingBox = { x: 25, y: 25, width: 50, height: 50 }; // default
        
        if (boundingPoly && boundingPoly.vertices && boundingPoly.vertices.length >= 2) {
          const vertices = boundingPoly.vertices;
          const x1 = Math.min(...vertices.map(v => v.x || 0));
          const y1 = Math.min(...vertices.map(v => v.y || 0));
          const x2 = Math.max(...vertices.map(v => v.x || 0));
          const y2 = Math.max(...vertices.map(v => v.y || 0));
          
          // Assume image dimensions for percentage calculation (will be approximate)
          boundingBox = {
            x: (x1 / 1000) * 100, // Rough estimation
            y: (y1 / 1000) * 100,
            width: ((x2 - x1) / 1000) * 100,
            height: ((y2 - y1) / 1000) * 100
          };
        }
        
        // Convert Google's confidence (VERY_LIKELY, LIKELY, etc.) to numeric
        const confidence = this.convertGoogleConfidence(face.detectionConfidence);
        
        return {
          id: index + 1,
          bounding_box: boundingBox,
          confidence: confidence,
          description: `Person detected with ${confidence}% confidence`,
          quality: face.detectionConfidence === 'VERY_LIKELY' ? 'high' : 
                   face.detectionConfidence === 'LIKELY' ? 'good' : 'fair',
          distinctive_features: this.extractGoogleFeatures(face)
        };
      });

      // Convert Google Cloud Vision objects to our format
      const convertedObjects = objects.map((obj, index) => {
        return {
          object: obj.name || 'unknown',
          confidence: Math.round((obj.score || 0.5) * 100),
          description: `${obj.name} detected`
        };
      });

      // Add person objects from face detection
      if (faces.length > 0) {
        convertedObjects.unshift({
          object: 'person',
          confidence: Math.round(faces.reduce((sum, face) => sum + this.convertGoogleConfidence(face.detectionConfidence), 0) / faces.length),
          description: `${faces.length} person(s) detected`
        });
      }

      return {
        faces_detected: faces.length,
        faces: convertedFaces,
        objects_detected: convertedObjects,
        scene_analysis: {
          overall_confidence: faces.length > 0 ? 85 : 70,
          description: faces.length > 0 ? 
            `Detected ${faces.length} face(s) and ${objects.length} object(s)` :
            `Detected ${objects.length} object(s), no faces found`,
          lighting: 'unknown',
          image_quality: faces.length > 0 ? 'good' : 'unknown'
        }
      };
    } catch (error) {
      console.error('Error parsing Google Cloud Vision response:', error);
      return {
        faces_detected: 0,
        faces: [],
        objects_detected: [],
        scene_analysis: {
          overall_confidence: 0,
          description: 'Error in analysis',
          lighting: 'unknown',
          image_quality: 'unknown'
        }
      };
    }
  }

  convertGoogleConfidence(likelihood) {
    // Convert Google's likelihood to numeric confidence
    switch (likelihood) {
      case 'VERY_LIKELY': return 95;
      case 'LIKELY': return 80;
      case 'POSSIBLE': return 60;
      case 'UNLIKELY': return 30;
      case 'VERY_UNLIKELY': return 10;
      default: return 70;
    }
  }

  extractGoogleFeatures(face) {
    const features = [];
    
    // Check for various facial features based on Google's response
    if (face.headwearLikelihood === 'LIKELY' || face.headwearLikelihood === 'VERY_LIKELY') {
      features.push('headwear');
    }
    if (face.joyLikelihood === 'LIKELY' || face.joyLikelihood === 'VERY_LIKELY') {
      features.push('smiling');
    }
    if (face.angerLikelihood === 'LIKELY' || face.angerLikelihood === 'VERY_LIKELY') {
      features.push('angry expression');
    }
    if (face.surpriseLikelihood === 'LIKELY' || face.surpriseLikelihood === 'VERY_LIKELY') {
      features.push('surprised expression');
    }
    
    return features;
  }

  async trackUsage(usageData) {
    if (!this.config.cost_tracking_enabled) {
      return;
    }

    try {
      const db = require('../config/database').getDatabase();
      
      // Google Cloud Vision charges per image
      const totalCost = this.costPerImage;

      const stmt = db.prepare(`
        INSERT INTO ai_usage_tracking (
          provider, model, operation_type, visitor_event_id,
          input_tokens, output_tokens, total_tokens, cost_usd,
          processing_time_ms, success, error_message, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        'google-cloud-vision',
        'vision-api',
        usageData.operation_type,
        usageData.visitor_event_id,
        1, // 1 "input token" representing 1 image
        0, // No output tokens for image analysis
        1, // 1 total "token" representing 1 image processed
        totalCost,
        usageData.processing_time_ms,
        usageData.success ? 1 : 0,
        usageData.error_message || null,
        new Date().toISOString()
      );

      console.log(`Tracked Google Cloud Vision usage: 1 image processed, $${totalCost.toFixed(4)}`);
    } catch (error) {
      console.error('Error tracking Google Cloud Vision usage:', error);
    }
  }

  async generateFaceEncoding(imageUrl, faceData) {
    // Use the face cropping service to generate proper embeddings
    const faceCroppingService = require('./faceCroppingService');
    
    try {
      const embeddingResult = await faceCroppingService.generateFaceEmbedding(
        imageUrl, 
        faceData.description
      );
      
      return JSON.stringify(embeddingResult.embedding);
    } catch (error) {
      console.error('Error generating face encoding:', error);
      // Fallback to simple hash
      const crypto = require('crypto');
      return crypto.createHash('sha256').update(imageUrl + JSON.stringify(faceData)).digest('hex');
    }
  }

  // Static method to get available Google Cloud Vision models
  static async getAvailableModels(apiKey) {
    // Google Cloud Vision has a single API, not multiple models
    return [
      { 
        value: 'vision-api', 
        label: 'Google Cloud Vision API',
        pricing: { per_image: 0.0015 }
      }
    ];
  }

  // Test API connection
  static async testConnection(apiKey) {
    try {
      // Test with a simple request
      const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requests: [{
            image: {
              content: '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=' // 1x1 pixel test image
            },
            features: [{
              type: 'FACE_DETECTION',
              maxResults: 1
            }]
          }]
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API key validation failed: ${errorData.error?.message || 'Invalid API key'}`);
      }

      return {
        success: true,
        message: 'Google Cloud Vision API connection successful',
        models_available: true
      };
    } catch (error) {
      return {
        success: false,
        message: `Google Cloud Vision connection failed: ${error.message}`
      };
    }
  }
}

class ClaudeVisionProvider extends BaseAIProvider {
  constructor(config) {
    super(config);
    // Claude pricing model (Claude 3 Sonnet)
    this.modelPricing = {
      'claude-3-sonnet-20240229': { input: 0.003, output: 0.015 }, // per 1K tokens
      'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
      'claude-3-opus-20240229': { input: 0.015, output: 0.075 }
    };
  }

  async detectFaces(imageUrl, visitorEventId = null) {
    if (!this.config.api_key) {
      throw new Error('Claude API key not configured');
    }

    const startTime = Date.now();
    const model = this.config.claude_model || 'claude-3-sonnet-20240229';

    try {
      // Convert image to base64 if needed
      const imageBase64 = await this.convertImageToBase64(imageUrl);

      const prompt = `Analyze this doorbell camera image and provide a comprehensive analysis. Look carefully at what you actually see in the image.

INSTRUCTIONS:
1. FACE DETECTION: Identify all human faces visible in the image. For each face, provide:
   - Exact bounding box coordinates as percentages (x, y, width, height)
   - Confidence level (0-100) based on clarity and visibility
   - Detailed description of what you observe
   - Quality assessment (clear/good/fair/poor)
   - Any distinctive features you can identify

2. OBJECT DETECTION: Identify all significant objects, people, vehicles, packages, animals, etc. that you can see. Provide confidence levels based on how certain you are about each identification.

3. SCENE ANALYSIS: Provide your overall assessment of the image quality, lighting conditions, and general scene description.

IMPORTANT: Analyze what you actually see in THIS specific image. Do not use generic examples or placeholder data.

Return ONLY valid JSON in this structure:
{
  "faces_detected": [number of faces you actually detected],
  "faces": [
    {
      "id": [sequential number],
      "bounding_box": {"x": [actual x%], "y": [actual y%], "width": [actual width%], "height": [actual height%]},
      "confidence": [your confidence 0-100],
      "description": "[describe what you actually see]",
      "quality": "[your assessment of image quality]",
      "distinctive_features": ["list", "actual", "features", "you", "observe"]
    }
  ],
  "objects_detected": [
    {
      "object": "[actual object type you see]",
      "confidence": [your confidence 0-100],
      "description": "[describe the specific object you see]"
    }
  ],
  "scene_analysis": {
    "overall_confidence": [your overall confidence in the analysis],
    "description": "[describe the actual scene you observe]",
    "lighting": "[describe actual lighting conditions]",
    "image_quality": "[assess actual image quality]"
  }
}

If no faces are detected, set faces_detected to 0 and faces to empty array. Always include objects_detected and scene_analysis based on what you actually observe.`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': this.config.api_key,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: model,
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: [{
              type: 'text',
              text: prompt
            }, {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: imageBase64
              }
            }]
          }]
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Claude API error ${response.status}: ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const processingTime = Date.now() - startTime;

      // Track usage and costs
      await this.trackUsage({
        model,
        operation_type: 'face_detection',
        visitor_event_id: visitorEventId,
        input_tokens: data.usage?.input_tokens || 0,
        output_tokens: data.usage?.output_tokens || 0,
        processing_time_ms: processingTime,
        success: true
      });

      // Parse and validate the response
      const content = data.content[0].text;
      const result = this.parseClaudeResponse(content);
      
      console.log(`Claude ${model} face detection completed in ${processingTime}ms`);
      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      // Track failed usage
      await this.trackUsage({
        model,
        operation_type: 'face_detection',
        visitor_event_id: visitorEventId,
        processing_time_ms: processingTime,
        success: false,
        error_message: error.message
      });

      console.error('Claude face detection error:', error);
      throw new Error(`Failed to detect faces with Claude: ${error.message}`);
    }
  }

  async convertImageToBase64(imageUrl) {
    const fs = require('fs').promises;
    const path = require('path');
    
    try {
      let imageBuffer;
      
      if (imageUrl.startsWith('/uploads/')) {
        // Local file path
        const imagePath = path.join(__dirname, '..', imageUrl);
        imageBuffer = await fs.readFile(imagePath);
      } else if (imageUrl.startsWith('http')) {
        // Remote URL - download the image
        console.log('Downloading remote image for Claude:', imageUrl);
        imageBuffer = await this.downloadImage(imageUrl);
      } else {
        // Direct file path
        imageBuffer = await fs.readFile(imageUrl);
      }
      
      return imageBuffer.toString('base64');
    } catch (error) {
      console.error('Error converting image to base64 for Claude:', error);
      throw error;
    }
  }

  async downloadImage(url) {
    const http = require('http');
    const https = require('https');
    const { URL } = require('url');
    
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const client = urlObj.protocol === 'https:' ? https : http;
      
      const request = client.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Doorbell-Face-Detection/1.0'
        }
      }, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download image: HTTP ${response.statusCode}`));
          return;
        }
        
        const chunks = [];
        
        response.on('data', (chunk) => {
          chunks.push(chunk);
        });
        
        response.on('end', () => {
          const buffer = Buffer.concat(chunks);
          console.log(`Downloaded image for Claude: ${buffer.length} bytes`);
          resolve(buffer);
        });
        
        response.on('error', (error) => {
          reject(error);
        });
      });
      
      request.on('error', (error) => {
        reject(error);
      });
      
      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Image download timeout'));
      });
    });
  }

  parseClaudeResponse(responseText) {
    try {
      console.log('Raw Claude response:', responseText);
      
      // Try to extract JSON from the response
      let jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.log('No JSON found in Claude response, creating default');
        return {
          faces_detected: 0,
          faces: [],
          objects_detected: [],
          scene_analysis: {
            overall_confidence: 0,
            description: 'No analysis available',
            lighting: 'unknown',
            image_quality: 'unknown'
          }
        };
      }
      
      const jsonStr = jsonMatch[0];
      const parsed = JSON.parse(jsonStr);
      
      // Validate and normalize the response structure (same as OpenAI/Ollama)
      return this.validateAndNormalizeResponse(parsed);
    } catch (error) {
      console.error('Error parsing Claude response:', error);
      return {
        faces_detected: 0,
        faces: [],
        objects_detected: [],
        scene_analysis: {
          overall_confidence: 0,
          description: 'Error in analysis',
          lighting: 'unknown',
          image_quality: 'unknown'
        }
      };
    }
  }

  validateAndNormalizeResponse(parsed) {
    // Validate the response structure (same validation as OpenAI)
    if (typeof parsed.faces_detected !== 'number') {
      parsed.faces_detected = parsed.faces ? parsed.faces.length : 0;
    }
    
    if (!Array.isArray(parsed.faces)) {
      parsed.faces = [];
    }
    
    // Validate each face object
    parsed.faces = parsed.faces.map((face, index) => {
      return {
        id: face.id || index + 1,
        bounding_box: face.bounding_box || { x: 25, y: 25, width: 50, height: 50 },
        confidence: Math.min(100, Math.max(0, face.confidence || 70)),
        description: face.description || 'Person detected',
        quality: face.quality || 'unknown',
        distinctive_features: Array.isArray(face.distinctive_features) ? face.distinctive_features : []
      };
    });
    
    // Validate objects_detected array
    if (!Array.isArray(parsed.objects_detected)) {
      parsed.objects_detected = [];
    }
    
    // Validate each object
    parsed.objects_detected = parsed.objects_detected.map((obj, index) => {
      return {
        object: obj.object || 'unknown',
        confidence: Math.min(100, Math.max(0, obj.confidence || 50)),
        description: obj.description || 'Object detected'
      };
    });
    
    // Validate scene_analysis
    if (!parsed.scene_analysis || typeof parsed.scene_analysis !== 'object') {
      parsed.scene_analysis = {
        overall_confidence: 70,
        description: 'Scene analysis completed',
        lighting: 'unknown',
        image_quality: 'unknown'
      };
    } else {
      parsed.scene_analysis = {
        overall_confidence: Math.min(100, Math.max(0, parsed.scene_analysis.overall_confidence || 70)),
        description: parsed.scene_analysis.description || 'Scene analysis completed',
        lighting: parsed.scene_analysis.lighting || 'unknown',
        image_quality: parsed.scene_analysis.image_quality || 'unknown'
      };
    }
    
    return parsed;
  }

  async trackUsage(usageData) {
    if (!this.config.cost_tracking_enabled) {
      return;
    }

    try {
      const db = require('../config/database').getDatabase();
      
      // Calculate cost based on token usage and model pricing
      const pricing = this.modelPricing[usageData.model] || this.modelPricing['claude-3-sonnet-20240229'];
      const inputCost = (usageData.input_tokens / 1000) * pricing.input;
      const outputCost = (usageData.output_tokens / 1000) * pricing.output;
      const totalCost = inputCost + outputCost;

      const stmt = db.prepare(`
        INSERT INTO ai_usage_tracking (
          provider, model, operation_type, visitor_event_id,
          input_tokens, output_tokens, total_tokens, cost_usd,
          processing_time_ms, success, error_message, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        'claude',
        usageData.model,
        usageData.operation_type,
        usageData.visitor_event_id,
        usageData.input_tokens || 0,
        usageData.output_tokens || 0,
        (usageData.input_tokens || 0) + (usageData.output_tokens || 0),
        totalCost,
        usageData.processing_time_ms,
        usageData.success ? 1 : 0,
        usageData.error_message || null,
        new Date().toISOString()
      );

      console.log(`Tracked Claude usage: ${(usageData.input_tokens || 0) + (usageData.output_tokens || 0)} tokens, $${totalCost.toFixed(4)}`);
    } catch (error) {
      console.error('Error tracking Claude usage:', error);
    }
  }

  async generateFaceEncoding(imageUrl, faceData) {
    // Use the face cropping service to generate proper embeddings
    const faceCroppingService = require('./faceCroppingService');
    
    try {
      const embeddingResult = await faceCroppingService.generateFaceEmbedding(
        imageUrl, 
        faceData.description
      );
      
      return JSON.stringify(embeddingResult.embedding);
    } catch (error) {
      console.error('Error generating face encoding:', error);
      // Fallback to simple hash
      const crypto = require('crypto');
      return crypto.createHash('sha256').update(imageUrl + JSON.stringify(faceData)).digest('hex');
    }
  }

  // Static method to get available Claude models
  static async getAvailableModels(apiKey) {
    // Claude doesn't have a models endpoint, so return known models
    return [
      { 
        value: 'claude-3-sonnet-20240229', 
        label: 'Claude 3 Sonnet (Recommended)',
        pricing: { input: 0.003, output: 0.015 }
      },
      { 
        value: 'claude-3-haiku-20240307', 
        label: 'Claude 3 Haiku (Fast & Cost-effective)',
        pricing: { input: 0.00025, output: 0.00125 }
      },
      { 
        value: 'claude-3-opus-20240229', 
        label: 'Claude 3 Opus (Most Capable)',
        pricing: { input: 0.015, output: 0.075 }
      }
    ];
  }

  // Test API connection
  static async testConnection(apiKey, model = 'claude-3-sonnet-20240229') {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: model,
          max_tokens: 10,
          messages: [{
            role: 'user',
            content: 'Test connection'
          }]
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API key validation failed: ${errorData.error?.message || 'Invalid API key'}`);
      }

      return {
        success: true,
        message: 'Claude API connection successful',
        models_available: true
      };
    } catch (error) {
      return {
        success: false,
        message: `Claude connection failed: ${error.message}`
      };
    }
  }
}

function createAIProvider(providerType, config) {
  switch (providerType) {
    case 'openai':
      return new OpenAIVisionProvider(config);
    case 'local':
      return new LocalOllamaProvider(config);
    case 'claude':
      return new ClaudeVisionProvider(config);
    case 'gemini':
      return new GoogleGeminiProvider(config);
    case 'google-cloud-vision':
      return new GoogleCloudVisionProvider(config);
    default:
      throw new Error(`Unsupported AI provider: ${providerType}`);
  }
}

module.exports = {
  createAIProvider,
  BaseAIProvider,
  OpenAIVisionProvider,
  LocalOllamaProvider,
  GoogleGeminiProvider,
  GoogleCloudVisionProvider,
  ClaudeVisionProvider
};
