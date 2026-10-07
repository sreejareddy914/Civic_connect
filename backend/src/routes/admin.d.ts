declare const router: import("express-serve-static-core").Router;
export declare const adminAuthMiddleware: (req: any, res: any, next: any) => Promise<any>;
export declare const SLA_HOURS: Record<string, number>;
export declare function calculateSLA(issue: any, slaRecord?: any): {
    allowedHours: number;
    deadline: string;
    remainingHours: number;
    remainingMs: number;
    status: string;
};
export default router;
//# sourceMappingURL=admin.d.ts.map