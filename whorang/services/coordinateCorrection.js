/**
 * Coordinate Correction Service
 * Fixes known coordinate accuracy issues with different AI providers
 */

class CoordinateCorrection {
  constructor() {
    // Coordinate validation and format correction (NO FIXED SPATIAL CORRECTIONS)
    this.corrections = {
      openai: {
        enabled: true,
        description: 'OpenAI coordinate format validation only',
        corrections: [
          {
            name: 'bounds_validation',
            description: 'Ensure coordinates are within valid bounds',
            condition: (coords, imageWidth, imageHeight) => {
              // Only validate bounds, no spatial corrections
              return true;
            },
            transform: (coords, imageWidth, imageHeight) => {
              // ONLY validate bounds and format - NO spatial transformations
              let validatedCoords = { ...coords };
              
              // Ensure coordinates are within 0-100 range for percentage format
              if (coords.x > 100 || coords.y > 100 || coords.width > 100 || coords.height > 100) {
                console.warn('Coordinate correction: Coordinates exceed 100% - may be pixel coordinates');
              }
              
              // Ensure minimum reasonable size (but don't force specific values)
              if (coords.width < 1) validatedCoords.width = 5;
              if (coords.height < 1) validatedCoords.height = 5;
              
              // Ensure coordinates don't exceed image bounds
              validatedCoords.x = Math.max(0, Math.min(validatedCoords.x, 95));
              validatedCoords.y = Math.max(0, Math.min(validatedCoords.y, 95));
              
              return {
                ...validatedCoords,
                correctionApplied: false, // No spatial correction applied
                correctionType: 'bounds_validation_only'
              };
            }
          }
        ]
      },
      ollama: {
        enabled: true,
        description: 'Ollama coordinate format validation only',
        corrections: [
          {
            name: 'bounds_validation',
            description: 'Ensure coordinates are within valid bounds',
            condition: () => true,
            transform: (coords) => {
              // Same validation-only approach for Ollama
              let validatedCoords = { ...coords };
              
              if (coords.width < 0.01) validatedCoords.width = 0.05;
              if (coords.height < 0.01) validatedCoords.height = 0.05;
              
              validatedCoords.x = Math.max(0, Math.min(validatedCoords.x, 0.95));
              validatedCoords.y = Math.max(0, Math.min(validatedCoords.y, 0.95));
              
              return {
                ...validatedCoords,
                correctionApplied: false,
                correctionType: 'bounds_validation_only'
              };
            }
          }
        ]
      }
    };
  }

  /**
   * Apply coordinate corrections for a specific AI provider
   * @param {string} provider - AI provider name (openai, ollama, etc.)
   * @param {Object} coordinates - Original coordinates {x, y, width, height}
   * @param {number} imageWidth - Image width in pixels
   * @param {number} imageHeight - Image height in pixels
   * @returns {Object} Corrected coordinates with metadata
   */
  correctCoordinates(provider, coordinates, imageWidth, imageHeight) {
    const providerCorrections = this.corrections[provider.toLowerCase()];
    
    if (!providerCorrections || !providerCorrections.enabled) {
      console.log(`Coordinate correction: No corrections enabled for ${provider}`);
      return {
        ...coordinates,
        correctionApplied: false,
        provider: provider
      };
    }

    console.log(`Coordinate correction: Applying ${provider} corrections`);
    console.log(`Original coordinates: x=${coordinates.x}, y=${coordinates.y}, w=${coordinates.width}, h=${coordinates.height}`);

    let correctedCoords = { ...coordinates };
    const appliedCorrections = [];

    // Apply each correction that matches the condition
    for (const correction of providerCorrections.corrections) {
      if (correction.condition(correctedCoords, imageWidth, imageHeight)) {
        console.log(`Applying correction: ${correction.name}`);
        correctedCoords = correction.transform(correctedCoords, imageWidth, imageHeight);
        appliedCorrections.push(correction.name);
      }
    }

    if (appliedCorrections.length > 0) {
      console.log(`Coordinate correction: Applied ${appliedCorrections.join(', ')}`);
      console.log(`Corrected coordinates: x=${correctedCoords.x}, y=${correctedCoords.y}, w=${correctedCoords.width}, h=${correctedCoords.height}`);
    }

    return {
      ...correctedCoords,
      correctionApplied: appliedCorrections.length > 0,
      appliedCorrections: appliedCorrections,
      provider: provider,
      originalCoordinates: coordinates
    };
  }

  /**
   * Validate coordinates make spatial sense
   * @param {Object} coordinates - Coordinates to validate
   * @param {number} imageWidth - Image width
   * @param {number} imageHeight - Image height
   * @returns {Object} Validation result
   */
  validateCoordinates(coordinates, imageWidth, imageHeight) {
    const issues = [];
    const warnings = [];

    // Convert to pixel coordinates for validation
    let pixelCoords;
    if (coordinates.x <= 1.0 && coordinates.y <= 1.0) {
      // Normalized coordinates
      pixelCoords = {
        x: coordinates.x * imageWidth,
        y: coordinates.y * imageHeight,
        width: coordinates.width * imageWidth,
        height: coordinates.height * imageHeight
      };
    } else {
      // Percentage coordinates
      pixelCoords = {
        x: (coordinates.x / 100) * imageWidth,
        y: (coordinates.y / 100) * imageHeight,
        width: (coordinates.width / 100) * imageWidth,
        height: (coordinates.height / 100) * imageHeight
      };
    }

    // Check bounds
    if (pixelCoords.x < 0 || pixelCoords.y < 0) {
      issues.push('Coordinates have negative values');
    }

    if (pixelCoords.x + pixelCoords.width > imageWidth || 
        pixelCoords.y + pixelCoords.height > imageHeight) {
      issues.push('Coordinates extend beyond image bounds');
    }

    // Check size reasonableness
    if (pixelCoords.width < 10 || pixelCoords.height < 10) {
      warnings.push('Face crop very small - may indicate coordinate error');
    }

    if (pixelCoords.width > imageWidth * 0.8 || pixelCoords.height > imageHeight * 0.8) {
      warnings.push('Face crop very large - may indicate coordinate error');
    }

    // Check aspect ratio
    const aspectRatio = pixelCoords.width / pixelCoords.height;
    if (aspectRatio < 0.3 || aspectRatio > 3.0) {
      warnings.push('Unusual face aspect ratio - may indicate coordinate error');
    }

    return {
      valid: issues.length === 0,
      issues: issues,
      warnings: warnings,
      pixelCoordinates: pixelCoords,
      confidence: issues.length === 0 ? (warnings.length === 0 ? 1.0 : 0.7) : 0.3
    };
  }

  /**
   * Get correction statistics for a provider
   * @param {string} provider - AI provider name
   * @returns {Object} Correction statistics
   */
  getCorrectionStats(provider) {
    const providerCorrections = this.corrections[provider.toLowerCase()];
    
    if (!providerCorrections) {
      return { enabled: false, corrections: 0 };
    }

    return {
      enabled: providerCorrections.enabled,
      corrections: providerCorrections.corrections?.length || 0,
      description: providerCorrections.description
    };
  }
}

// Create singleton instance
const coordinateCorrection = new CoordinateCorrection();

module.exports = coordinateCorrection;
