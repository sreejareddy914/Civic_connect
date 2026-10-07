import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function run() {
  try {
    const models = await ai.models.list();
    for (const model of models) {
      if (model.name.includes("gemini")) {
        console.log(`Model: ${model.name}, Display Name: ${model.displayName}`);
      }
    }
  } catch (err) {
    console.error("Error listing models:", err);
  }
}
run();
