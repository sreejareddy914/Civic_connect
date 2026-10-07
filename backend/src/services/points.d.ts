import { SupabaseClient } from '@supabase/supabase-js';
export declare const POINT_VALUES: {
    VALID_ISSUE_REPORT: number;
    VALID_VERIFICATION: number;
    UPVOTE: number;
    USEFUL_COMMENT: number;
    VERIFICATION_BONUS: number;
};
export declare const CIVIC_LEVELS: {
    name: string;
    min: number;
    max: number;
}[];
export declare function getCivicLevel(points: number): string;
export declare function awardPoints(supabase: SupabaseClient, userId: string, actionType: keyof typeof POINT_VALUES, referenceId: string, description: string): Promise<{
    success: boolean;
    reason: string;
    error?: never;
    warning?: never;
    pointsAwarded?: never;
    newTotal?: never;
} | {
    reason?: never;
    success: boolean;
    error: import("@supabase/postgrest-js").PostgrestError;
    warning?: never;
    pointsAwarded?: never;
    newTotal?: never;
} | {
    reason?: never;
    error?: never;
    success: boolean;
    warning: string;
    pointsAwarded?: never;
    newTotal?: never;
} | {
    reason?: never;
    error?: never;
    warning?: never;
    success: boolean;
    pointsAwarded: number;
    newTotal: number;
}>;
//# sourceMappingURL=points.d.ts.map