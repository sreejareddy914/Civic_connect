export declare function analyzeIssue(title: string, description: string, latitude: number | string, longitude: number | string, imageBuffer: Buffer | null, imageMimeType: string | null, candidateIssues: any[]): Promise<{
    category: string;
    severity: "HIGH" | "LOW" | "MEDIUM";
    priority: "HIGH" | "LOW" | "MEDIUM";
    confidence: number;
    imageAnalysis?: string | undefined;
    polishedDescription: string;
    duplicate: {
        isDuplicate: boolean;
        matchedReportId?: string | null | undefined;
        reason?: string | null | undefined;
    };
} | null>;
//# sourceMappingURL=ai.d.ts.map