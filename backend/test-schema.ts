import { GoogleGenAI, Type, Schema } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const issueSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    category: {
      type: Type.STRING,
      enum: [
        "Roads", "Water", "Infrastructure", "Drainage", "Street Lights",
        "Garbage / Waste", "Sanitation", "Traffic", "Public Transport",
        "Electricity", "Sewage", "Parks / Public Spaces", "Environment",
        "Public Safety", "Government Facilities", "Other"
      ],
      description: "The primary category of the issue",
    },
    severity: {
      type: Type.STRING,
      enum: ["LOW", "MEDIUM", "HIGH"],
      description: "How serious/dangerous the issue itself is",
    },
    priority: {
      type: Type.STRING,
      enum: ["LOW", "MEDIUM", "HIGH"],
      description: "Suggested priority for resolution/urgency",
    },
    confidence: {
      type: Type.NUMBER,
      description: "AI confidence score representing certainty from 0 to 100",
    },
    imageAnalysis: {
      type: Type.STRING,
      description: "Brief analysis of visible civic issues in the uploaded image, if any.",
    },
    polishedDescription: {
      type: Type.STRING,
      description: "A professional, meaning-preserved, factual, and grammatically correct version of the user's description.",
    },
    duplicate: {
      type: Type.OBJECT,
      properties: {
        isDuplicate: { type: Type.BOOLEAN, description: "True if a highly likely duplicate is found among candidate issues" },
        matchedReportId: { type: Type.STRING, description: "The ID of the matched report if duplicate, otherwise null", nullable: true },
        reason: { type: Type.STRING, description: "Reason why it is considered a duplicate, or null", nullable: true },
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
  } catch (error: any) {
    console.error("FAILED:", error.message);
  }
}
testSchema();
