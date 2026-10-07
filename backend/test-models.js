"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const genai_1 = require("@google/genai");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const ai = new genai_1.GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
    try {
        const models = await ai.models.list();
        for (const model of models) {
            if (model.name.includes("gemini")) {
                console.log(`Model: ${model.name}, Display Name: ${model.displayName}`);
            }
        }
    }
    catch (err) {
        console.error("Error listing models:", err);
    }
}
run();
//# sourceMappingURL=test-models.js.map