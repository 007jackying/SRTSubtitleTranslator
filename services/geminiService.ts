import { GoogleGenAI, Type } from "@google/genai";

export const translateBatch = async (texts: string[], apiKey: string, targetLanguage: string, modelName: string): Promise<string[]> => {
  // Initialize AI with the provided key for this batch request
  const ai = new GoogleGenAI({ apiKey });

  // No try-catch block here; we want errors (429, 400, network) to bubble up 
  // so the App can catch them and display them in the Console Popup.
  
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

  let translatedArray;
  try {
    translatedArray = JSON.parse(jsonStr);
  } catch (e) {
    // Throwing a specific error helps the user understand it's a model output issue
    throw new Error(`Failed to parse model response: ${jsonStr.substring(0, 100)}...`);
  }

  if (Array.isArray(translatedArray)) {
    return translatedArray;
  } else {
    throw new Error(`Model returned invalid format. Expected Array, got: ${typeof translatedArray}`);
  }
};