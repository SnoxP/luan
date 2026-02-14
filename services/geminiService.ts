import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';

export const generateBackgroundImage = async (prompt: string): Promise<string> => {
  if (!apiKey) {
    throw new Error("API Key not found in environment variables");
  }

  const ai = new GoogleGenAI({ apiKey });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          { text: prompt }
        ]
      },
      config: {
        // Image generation specific config
        imageConfig: {
            aspectRatio: "1:1", // Generating a square texture is usually versatile enough to crop/tile
            imageSize: "1K"
        }
      }
    });

    // Extract image data
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
           return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
        }
      }
    }
    
    throw new Error("No image data received from Gemini.");

  } catch (error) {
    console.error("Gemini Image Generation Error:", error);
    throw error;
  }
};