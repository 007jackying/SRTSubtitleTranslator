import { GoogleGenAI, Type } from "@google/genai";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const translateBatch = async (
  texts: string[], 
  apiKey: string, 
  targetLanguage: string, 
  modelName: string,
  onStatusUpdate?: (message: string) => void
): Promise<string[]> => {
  const ai = new GoogleGenAI({ apiKey });
  
  // Retry configuration
  const maxRetries = 5; // Increased retries for better reliability
  const baseDelay = 1000; // Start with 1 second

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const prompt = `
        You are a professional subtitle translator. 
        Translate the following array of subtitle texts into ${targetLanguage}.
        Detect the source language automatically.
        Maintain the nuance, tone, and brevity suitable for subtitles.
        Return ONLY a JSON array of strings corresponding strictly to the input order.
        Do not merge lines. The output array length must match the input array length.
      `;

      const response = await ai.models.generateContent({
        model: modelName,
        contents: [
          { role: 'user', parts: [{ text: prompt }] },
          { role: 'user', parts: [{ text: JSON.stringify(texts) }] }
        ],
        config: {
          responseMimeType: "application/json",
          maxOutputTokens: 8192,
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.STRING
            }
          }
        }
      });

      let jsonStr = response.text || "[]";
      
      // Clean up markdown
      jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');

      // Attempt to extract JSON array if there's extra text
      const match = jsonStr.match(/\[[\s\S]*\]/); 
      if (match) {
        jsonStr = match[0];
      }

      let translatedArray;
      try {
        translatedArray = JSON.parse(jsonStr);
      } catch (e) {
        // If parsing fails, it might be a truncated response or hallucination. 
        // Treating this as a transient error to retry often helps.
        throw new Error(`JSON Parse Error: ${e instanceof Error ? e.message : String(e)}`);
      }

      if (Array.isArray(translatedArray)) {
        return translatedArray;
      } else {
        throw new Error(`Model returned invalid format. Expected Array, got: ${typeof translatedArray}`);
      }

    } catch (error: any) {
      // Analyze error for retry eligibility
      const msg = error.message || error.toString();
      const status = error.status || error.response?.status;
      
      const isRateLimit = msg.includes('429') || status === 429 || msg.includes('Quota exceeded') || msg.includes('RESOURCE_EXHAUSTED');
      const isServerError = msg.includes('500') || msg.includes('503') || status === 500 || status === 503 || msg.includes('Internal Server Error') || msg.includes('Overloaded');
      const isParseError = msg.includes('JSON Parse Error') || msg.includes('SyntaxError');

      const errorDetail = isRateLimit ? 'Rate Limit Exceeded (429)' : 
                          isServerError ? `Server Error (${status || '5xx'})` : 
                          isParseError ? 'Response Parsing Failed' : 
                          `Error: ${msg.substring(0, 50)}...`;

      if ((isRateLimit || isServerError || isParseError) && attempt < maxRetries) {
        // Calculate delay with exponential backoff and jitter
        // Jitter helps prevent thundering herd if multiple clients retry at once (less relevant for single client, but good practice)
        const backoff = baseDelay * Math.pow(2, attempt - 1);
        const jitter = Math.random() * 1000;
        const waitTime = backoff + jitter;

        const retryMsg = `${errorDetail}. Retrying in ${(waitTime/1000).toFixed(1)}s (Attempt ${attempt}/${maxRetries})`;
        console.warn(retryMsg);
        
        if (onStatusUpdate) {
            onStatusUpdate(retryMsg);
        }
        
        await delay(waitTime);
        continue;
      }

      // If we've exhausted retries or it's a non-retriable error, propagate it
      throw error;
    }
  }

  throw new Error("Max retries exceeded");
};