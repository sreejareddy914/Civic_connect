"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const genai_1 = require("@google/genai");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const ai = new genai_1.GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
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
        }
        catch (error) {
            console.error(`FAILED for ${model}:`, error.message);
        }
    }
}
testAll();
//# sourceMappingURL=test-all-models.js.map