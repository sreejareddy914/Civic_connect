import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const models = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite',
  'gemini-3.1-pro-preview',
  'gemini-flash-latest',
  'gemini-pro-latest'
];

async function testAll() {
  for (const model of models) {
    try {
      console.log(`Testing model: ${model}...`);
      const response = await ai.models.generateContent({
        model: model,
        contents: 'Say hello',
      });
      console.log(`SUCCESS for ${model}: ${response.text}`);
    } catch (error: any) {
      console.error(`FAILED for ${model}:`, error.message);
    }
  }
}
testAll();
