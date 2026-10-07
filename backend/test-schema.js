"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const genai_1 = require("@google/genai");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const ai = new genai_1.GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const issueSchema = {
    type: genai_1.Type.OBJECT,
    properties: {
        category: {
            type: genai_1.Type.STRING,
            enum: [
                "Roads", "Water", "Infrastructure", "Drainage", "Street Lights",
                "Garbage / Waste", "Sanitation", "Traffic", "Public Transport",
                "Electricity", "Sewage", "Parks / Public Spaces", "Environment",
                "Public Safety", "Government Facilities", "Other"
            ],
            description: "The primary category of the issue",
        },
        severity: {
            type: genai_1.Type.STRING,
            enum: ["LOW", "MEDIUM", "HIGH"],
            description: "How serious/dangerous the issue itself is",
        },
        priority: {
            type: genai_1.Type.STRING,
            enum: ["LOW", "MEDIUM", "HIGH"],
            description: "Suggested priority for resolution/urgency",
        },
        confidence: {
            type: genai_1.Type.NUMBER,
            description: "AI confidence score representing certainty from 0 to 100",
        },
        imageAnalysis: {
            type: genai_1.Type.STRING,
            description: "Brief analysis of visible civic issues in the uploaded image, if any.",
        },
        polishedDescription: {
            type: genai_1.Type.STRING,
            description: "A professional, meaning-preserved, factual, and grammatically correct version of the user's description.",
        },
        duplicate: {
            type: genai_1.Type.OBJECT,
            properties: {
                isDuplicate: { type: genai_1.Type.BOOLEAN, description: "True if a highly likely duplicate is found among candidate issues" },
                matchedReportId: { type: genai_1.Type.STRING, description: "The ID of the matched report if duplicate, otherwise null", nullable: true },
                reason: { type: genai_1.Type.STRING, description: "Reason why it is considered a duplicate, or null", nullable: true },
            },
            required: ["isDuplicate"]
        }
    },
    required: ["category", "severity", "priority", "confidence", "polishedDescription", "duplicate"],
};
async function testSchema() {
    try {
        const parts = [{ text: "Analyze the following civic issue report.\n\nTitle: 'pothole'\nDescription: 'large pothole on the road'" }];
        console.log("Calling Gemini API...");
        const response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: parts,
            config: {
                responseMimeType: 'application/json',
                responseSchema: issueSchema,
                temperature: 0.2,
            }
        });
        console.log("SUCCESS:", response.text);
    }
    catch (error) {
        console.error("FAILED:", error.message);
    }
}
testSchema();
//# sourceMappingURL=test-schema.js.map