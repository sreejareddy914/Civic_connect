"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const genai_1 = require("@google/genai");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const ai = new genai_1.GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function test31Pro() {
    try {
        const parts = [{ text: "Analyze the following civic issue report.\n\nTitle: 'pothole'\nDescription: 'large pothole on the road'" }];
        console.log("Calling Gemini API...");
        const response = await ai.models.generateContent({
            model: 'gemini-3.1-pro-preview',
            contents: parts,
        });
        console.log("SUCCESS:", response.text);
    }
    catch (error) {
        console.error("FAILED:", error.message);
    }
}
test31Pro();
//# sourceMappingURL=test-31-pro.js.map