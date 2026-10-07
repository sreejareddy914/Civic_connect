import { GoogleGenAI, Type, Schema } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function test31Pro() {
  try {
    const parts = [{ text: "Analyze the following civic issue report.\n\nTitle: 'pothole'\nDescription: 'large pothole on the road'" }];
    console.log("Calling Gemini API...");
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: parts,
    });
    console.log("SUCCESS:", response.text);
  } catch (error: any) {
    console.error("FAILED:", error.message);
  }
}
test31Pro();
