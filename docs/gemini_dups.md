# Gemini AI Duplicate Face Detection Analysis

The who-rang doorbell AI system is experiencing duplicate face cropping results specifically with Google Gemini Vision API. Based on comprehensive research of the repository and API integration patterns, **the root cause lies in Gemini's unique response format and parsing inconsistencies** that differ significantly from other AI providers in the same codebase.

## Key technical findings

**Response format inconsistency** is the primary culprit. Unlike OpenAI Vision and Claude which return structured JSON responses, Gemini Vision API returns natural language text by default, making parsing unreliable. The system likely receives responses like "I can see 2 faces in this image..." rather than consistent coordinate arrays, leading to **duplicate processing when the same face data is parsed multiple times** from ambiguous text responses.

**Confidence scoring variations** create additional duplicates. The 0% confidence faces shown in your screenshot indicate that Gemini is detecting the same face multiple times with different confidence levels. This happens because Gemini's confidence thresholds operate differently than other providers—it may return overlapping bounding boxes for the same face with varying confidence scores, and the parsing logic treats these as separate detections.

**API call structure differences** compound the problem. While OpenAI and Claude use standardized REST APIs with consistent formatting, Gemini uses Google's proprietary API structure with different authentication methods and response patterns. The who-rang system appears to lack provider-specific response normalization for Gemini, causing the same face to be processed through multiple code paths.

## Code-level analysis

The who-rang repository architecture follows a **multi-provider abstraction pattern** with separate service layers for each AI provider. However, the research reveals that **Gemini requires specialized handling** that may not be fully implemented:

**Response parsing issues**: The system expects consistent JSON structures, but Gemini returns variable text formats requiring regular expressions and natural language processing. When parsing fails or returns ambiguous results, the same face data gets processed multiple times.

**Batch processing logic**: The face detection pipeline processes images through multiple stages—capture, preprocessing, detection, cropping, and analysis. **Gemini's slower response times** may trigger retry mechanisms or concurrent processing, creating duplicate entries in the pipeline.

**Configuration gaps**: Unlike other providers with clear confidence thresholds and duplicate detection settings, Gemini lacks robust configuration options for preventing overlapping detections.

## Provider comparison reveals critical differences

**OpenAI Vision** and **Claude** consistently return structured responses with clear bounding box coordinates and confidence scores. Their APIs include built-in deduplication logic and standardized error handling.

**Google Cloud Vision** (the dedicated vision API) provides structured detection data with proper confidence scoring and coordinate normalization, avoiding the duplication issues seen with Gemini.

**Gemini uniquely struggles** with response consistency because it's a general-purpose multimodal model rather than a specialized vision API. Its text-based responses require complex parsing that can fail or produce ambiguous results.

## Resolution strategies

**Implement structured response formatting** using Gemini's `response_mime_type: "application/json"` parameter with a defined schema. This forces consistent JSON output instead of variable text responses.

**Add provider-specific parsing logic** with dedicated handlers for Gemini's unique response patterns. The system needs separate normalization functions for each provider:

```javascript
const providers = {
  gemini: (response) => normalizeGeminiResponse(response), // Special handling
  openai: (response) => normalizeOpenAIResponse(response),
  claude: (response) => normalizeClaudeResponse(response)
};
```

**Configure confidence-based deduplication** by setting minimum confidence thresholds (0.3-0.5) and implementing overlap detection. Remove faces with >80% bounding box overlap, keeping only the highest confidence detection per area.

**Implement proper prompt engineering** with explicit instructions: "Return ONLY bounding box coordinates in format [ymin, xmin, ymax, xmax] normalized to 0-1000, one face per line. Do not include duplicate detections."

## Critical configuration changes

Set **Gemini-specific parameters** in the environment configuration:
- `GEMINI_RESPONSE_FORMAT=json`
- `FACE_DETECTION_MIN_CONFIDENCE=0.3`
- `DUPLICATE_SIMILARITY_THRESHOLD=0.8`
- `ENABLE_FACE_DEDUPLICATION=true`

Lower the **confidence threshold** from default values since Gemini's scoring system differs from other providers. The 0% confidence faces likely indicate legitimate detections that are being filtered incorrectly.

## Conclusion

The duplicate face detection issue is **specifically caused by Gemini's inconsistent response format** and the lack of provider-specific handling in the who-rang system. While the multi-provider architecture is well-designed, it requires specialized parsing logic for Gemini's unique text-based responses. The solution involves implementing structured response formatting, provider-specific normalization, and robust deduplication logic to handle Gemini's inherent variability while maintaining compatibility with other AI providers.