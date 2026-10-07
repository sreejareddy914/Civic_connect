"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeIssue = analyzeIssue;
const genai_1 = require("@google/genai");
const zod_1 = require("zod");
const aiResponseSchema = zod_1.z.object({
    category: zod_1.z.string(),
    severity: zod_1.z.enum(["LOW", "MEDIUM", "HIGH"]),
    priority: zod_1.z.enum(["LOW", "MEDIUM", "HIGH"]),
    confidence: zod_1.z.number(),
    imageAnalysis: zod_1.z.string().optional(),
    polishedDescription: zod_1.z.string(),
    duplicate: zod_1.z.object({
        isDuplicate: zod_1.z.boolean(),
        matchedReportId: zod_1.z.string().nullable().optional(),
        reason: zod_1.z.string().nullable().optional()
    })
});
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
async function analyzeIssue(title, description, latitude, longitude, imageBuffer, imageMimeType, candidateIssues) {
    try {
        let prompt = `Analyze the following NEW civic issue report.\n\nTitle: "${title}"\nDescription: "${description}"\nLatitude: ${latitude}\nLongitude: ${longitude}\n\n`;
        if (candidateIssues.length > 0) {
            prompt += `Check if this new issue is a duplicate of any of these nearby existing candidates.\n`;
            candidateIssues.forEach(issue => {
                prompt += `\n--- CANDIDATE ID: ${issue.id} ---\n`;
                prompt += `Title: "${issue.title}"\n`;
                prompt += `Description: "${issue.description}"\n`;
                prompt += `Category: ${issue.category}\n`;
                prompt += `Latitude: ${issue.latitude}\n`;
                prompt += `Longitude: ${issue.longitude}\n`;
                prompt += `\nPRECOMPUTED SIMILARITY SIGNALS:\n`;
                prompt += `- Location Match: ${issue.locationMatch ? 'TRUE' : 'FALSE'}\n`;
                prompt += `- Distance: ${issue.distance.toFixed(1)} meters\n`;
                prompt += `- Text Similarity: ${issue.textSimilarity}%\n`;
                prompt += `- Image Similarity (Byte Match): ${issue.imageSimilarity}%\n`;
            });
            prompt += `\nDetermine whether the new complaint is a duplicate of any candidate using the complaint text, location, category, and image evidence.\n`;
            prompt += `If a candidate has TRUE location match, HIGH text similarity, or EXACT image similarity (100%), it is an EXACT DUPLICATE and you MUST mark isDuplicate = true and provide the matchedReportId.\n\n`;
        }
        else {
            prompt += `No candidate existing issues nearby to check for duplicates.\n\n`;
        }
        const parts = [{ text: prompt }];
        if (imageBuffer && imageMimeType) {
            parts.push({
                inlineData: {
                    data: imageBuffer.toString("base64"),
                    mimeType: imageMimeType
                }
            });
            parts.push({ text: "\n\nThe above image is for the NEW issue.\n" });
        }
        if (candidateIssues.length > 0) {
            candidateIssues.forEach((issue, index) => {
                if (issue.imageBuffer && issue.imageMimeType) {
                    parts.push({ text: `\n\nImage for Candidate ${index + 1} (ID: ${issue.id}):\n` });
                    parts.push({
                        inlineData: {
                            data: issue.imageBuffer.toString("base64"),
                            mimeType: issue.imageMimeType
                        }
                    });
                }
            });
        }
        let retries = 3;
        let delay = 1000;
        let response;
        while (retries > 0) {
            try {
                console.log(`Calling Gemini API with model: gemini-flash-lite-latest (Retries left: ${retries})`);
                response = await ai.models.generateContent({
                    model: 'gemini-flash-lite-latest',
                    contents: parts,
                    config: {
                        responseMimeType: 'application/json',
                        responseSchema: issueSchema,
                        temperature: 0.2,
                    }
                });
                console.log("Gemini API call completed successfully.");
                break;
            }
            catch (error) {
                console.error(`Gemini API call failed: ${error.message}`);
                if (error.status === 503 || error.message.includes('503') || error.message.includes('UNAVAILABLE') || error.message.includes('high demand') || error.status === 429) {
                    retries--;
                    if (retries === 0) {
                        throw error;
                    }
                    console.log(`Waiting ${delay}ms before retrying...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay *= 2;
                }
                else {
                    throw error;
                }
            }
        }
        if (response && response.text) {
            try {
                const parsed = JSON.parse(response.text);
                const validated = aiResponseSchema.parse(parsed);
                // Deterministic override
                if (candidateIssues && candidateIssues.length > 0) {
                    const exactMatch = candidateIssues.find(c => c.imageSimilarity === 100 && c.locationMatch);
                    if (exactMatch) {
                        validated.duplicate = {
                            isDuplicate: true,
                            matchedReportId: exactMatch.id,
                            reason: `Exact duplicate detected: identical image and location matches report ${exactMatch.id}`
                        };
                    }
                }
                return validated;
            }
            catch (parseError) {
                console.error("Failed to parse or validate AI response:", parseError);
                console.error("Raw response:", response?.text);
                return null; // The routes/issues.ts will catch this and return 500
            }
        }
        console.error("AI Analysis returned no text. Response object:", JSON.stringify(response, null, 2));
        throw new Error("AI Analysis returned no text");
    }
    catch (error) {
        console.error("AI Analysis failed:", error);
        throw error;
    }
}
//# sourceMappingURL=ai.js.map