import { GoogleGenAI, Type } from "@google/genai";

// Using Pro for best quality on complex translation tasks
const MODEL_NAME = 'gemini-3-pro-preview'; 

export const translateBatch = async (texts: string[], apiKey: string, targetLanguage: string): Promise<string[]> => {
  // Initialize AI with the provided key for this batch request
  const ai = new GoogleGenAI({ apiKey });

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
      model: MODEL_NAME,
      contents: [
        { role: 'user', parts: [{ text: prompt }] },
        { role: 'user', parts: [{ text: JSON.stringify(texts) }] }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING
          }
        }
      }
    });

    let jsonStr = response.text || "[]";
    
    // Clean up potential markdown formatting if the model adds it despite config
    jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');

    const translatedArray = JSON.parse(jsonStr);

    if (Array.isArray(translatedArray)) {
      return translatedArray;
    } else {
      console.error("Gemini returned non-array:", translatedArray);
      return texts; // Fallback to original if parsing fails strictly
    }
  } catch (error) {
    console.error("Translation error:", error);
    // In case of error, return original texts to keep the flow going, 
    // or we could throw to retry. For this UX, we'll mark them as failed visually? 
    // Ideally we retry. For now, returning original text with a marker might be safer.
    return texts.map(t => `[FAILED] ${t}`);
  }
};