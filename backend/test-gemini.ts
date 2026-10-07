import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const CANDIDATE_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
];

async function testModels() {
  console.log('Testing Gemini models for civic issue processing...\n');
  
  for (const model of CANDIDATE_MODELS) {
    try {
      console.log(`[Testing ${model}]...`);
      const response = await ai.models.generateContent({
        model,
        contents: 'Briefly identify 1 potential hazard of an open pothole in 1 sentence.',
      });
      console.log(`✓ [${model}] Succeeded:`, response.text?.trim(), '\n');
    } catch (error: any) {
      console.error(`✗ [${model}] Failed:`, error.message, '\n');
    }
  }
}

testModels();