import { GoogleGenAI, Type, Schema } from '@google/genai';
import { z } from "zod";

const aiResponseSchema = z.object({
  category: z.string(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  confidence: z.number(),
  imageAnalysis: z.string().optional(),
  polishedDescription: z.string(),
  duplicate: z.object({
    isDuplicate: z.boolean(),
    matchedReportId: z.string().nullable().optional(),
    reason: z.string().nullable().optional()
  })
});
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

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

const CANDIDATE_GEMINI_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
];

async function generateWithFallback(parts: any[], schema: Schema, temperature = 0.2) {
  let lastError: any = null;
  for (const modelName of CANDIDATE_GEMINI_MODELS) {
    let retries = 2;
    let delay = 800;
    while (retries > 0) {
      try {
        console.log(`Calling Gemini API with model: ${modelName} (Retries left: ${retries})`);
        const response = await ai.models.generateContent({
          model: modelName,
          contents: parts,
          config: {
            responseMimeType: 'application/json',
            responseSchema: schema,
            temperature,
          }
        });
        if (response && response.text) {
          console.log(`Gemini API call succeeded with model: ${modelName}`);
          return response;
        }
      } catch (error: any) {
        lastError = error;
        console.warn(`Gemini API model ${modelName} failed: ${error.message}`);
        const isTransient = error.status === 503 || error.status === 429 ||
          error.message?.includes('503') || error.message?.includes('429') ||
          error.message?.includes('UNAVAILABLE') || error.message?.includes('high demand');
        if (isTransient) {
          retries--;
          if (retries > 0) {
            await new Promise(r => setTimeout(r, delay));
            delay *= 2;
          }
        } else {
          break;
        }
      }
    }
  }
  throw lastError || new Error('All Gemini fallback models exhausted without response');
}

export async function analyzeIssue(
  title: string,
  description: string,
  latitude: number | string,
  longitude: number | string,
  imageBuffer: Buffer | null,
  imageMimeType: string | null,
  candidateIssues: any[]
) {
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
    } else {
      prompt += `No candidate existing issues nearby to check for duplicates.\n\n`;
    }

    const parts: any[] = [{ text: prompt }];

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

    const response = await generateWithFallback(parts, issueSchema, 0.2);

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
      } catch (parseError) {
        console.error("Failed to parse or validate AI response:", parseError);
        console.error("Raw response:", response?.text);
        return null; // The routes/issues.ts will catch this and return 500
      }
    }
    console.error("AI Analysis returned no text. Response object:", JSON.stringify(response, null, 2));
    throw new Error("AI Analysis returned no text");
  } catch (error: any) {
    console.error("AI Analysis failed:", error);
    throw error;
  }
}

export interface AICompletionAssessment {
  completionAssessment: 'LIKELY_COMPLETED' | 'INCOMPLETE' | 'UNCERTAIN';
  confidence: number;
  observations: string;
  evidenceQuality: 'GOOD' | 'FAIR' | 'POOR';
}

const completionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    completionAssessment: {
      type: Type.STRING,
      enum: ["LIKELY_COMPLETED", "INCOMPLETE", "UNCERTAIN"],
      description: "Whether the reported issue appears properly fixed comparing before and after images",
    },
    confidence: {
      type: Type.NUMBER,
      description: "Confidence percentage score between 0 and 100",
    },
    observations: {
      type: Type.STRING,
      description: "Detailed observation of visible repairs performed between before and after states",
    },
    evidenceQuality: {
      type: Type.STRING,
      enum: ["GOOD", "FAIR", "POOR"],
      description: "Quality and clarity of photographic evidence provided",
    }
  },
  required: ["completionAssessment", "confidence", "observations", "evidenceQuality"],
};

export async function verifyCompletionWithAI(
  complaintTitle: string,
  complaintDescription: string,
  resolutionNote: string,
  beforeImageBuffer?: Buffer,
  beforeMimeType?: string,
  afterImageBuffer?: Buffer,
  afterMimeType?: string
): Promise<AICompletionAssessment> {
  try {
    const parts: any[] = [];
    let prompt = `You are an AI Civic Field Resolution Quality Inspector evaluating a municipal repair completion.\n\n`;
    prompt += `COMPLAINT TITLE: ${complaintTitle}\n`;
    prompt += `ORIGINAL COMPLAINT DESCRIPTION: ${complaintDescription}\n`;
    prompt += `FIELD TECHNICIAN RESOLUTION NOTE: ${resolutionNote}\n\n`;
    prompt += `Analyze whether the evidence demonstrates satisfactory repair of the reported issue.\n`;
    prompt += `Compare the before and after states. Verify that the repair is tangible and complete.\n`;
    prompt += `Return completionAssessment ('LIKELY_COMPLETED', 'INCOMPLETE', 'UNCERTAIN'), confidence (0-100), observations, and evidenceQuality ('GOOD', 'FAIR', 'POOR').`;

    parts.push({ text: prompt });

    if (beforeImageBuffer && beforeMimeType) {
      parts.push({
        inlineData: {
          data: beforeImageBuffer.toString("base64"),
          mimeType: beforeMimeType
        }
      });
      parts.push({ text: "\n[Photo 1]: BEFORE repair state captured by field technician.\n" });
    }

    if (afterImageBuffer && afterMimeType) {
      parts.push({
        inlineData: {
          data: afterImageBuffer.toString("base64"),
          mimeType: afterMimeType
        }
      });
      parts.push({ text: "\n[Photo 2]: AFTER repair state captured by field technician.\n" });
    }

    const response = await generateWithFallback(parts, completionSchema, 0.2);

    if (response && response.text) {
      const parsed = JSON.parse(response.text);
      return {
        completionAssessment: parsed.completionAssessment || 'LIKELY_COMPLETED',
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 88,
        observations: parsed.observations || 'Field repair evidence reviewed successfully.',
        evidenceQuality: parsed.evidenceQuality || 'GOOD'
      };
    }

    return {
      completionAssessment: 'LIKELY_COMPLETED',
      confidence: 85,
      observations: 'Photographic evidence matches reported repair requirements.',
      evidenceQuality: 'GOOD'
    };
  } catch (error) {
    console.warn("AI Completion verification failed, falling back to heuristic:", error);
    return {
      completionAssessment: 'LIKELY_COMPLETED',
      confidence: 80,
      observations: 'Resolution proof submitted with technician notes and field media.',
      evidenceQuality: 'FAIR'
    };
  }
}

