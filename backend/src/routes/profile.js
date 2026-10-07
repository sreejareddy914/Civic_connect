"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const ws_1 = __importDefault(require("ws"));
globalThis.WebSocket = ws_1.default;
const router = (0, express_1.Router)();
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL || '', process.env.SUPABASE_SECRET_KEY || '', { auth: { persistSession: false } });
// This endpoint is called after a user signs up on the frontend
// to bootstrap their record in the 'profiles' table securely.
router.post('/bootstrap', async (req, res) => {
    try {
        const { id, email, full_name, phone_number } = req.body;
        if (!id || !email || !full_name) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        // Insert new profile with 'CITIZEN' role by default
        const { data, error } = await supabase
            .from('profiles')
            .insert({
            id, // This matches the auth.users UUID
            role: 'CITIZEN',
            full_name,
            phone_number: phone_number || null,
        })
            .select()
            .single();
        if (error) {
            // If the profile already exists, just return ok (idempotent)
            if (error.code === '23505') {
                return res.status(200).json({ message: 'Profile already exists' });
            }
            throw error;
        }
        res.status(201).json({ message: 'Profile created', profile: data });
    }
    catch (error) {
        console.error('Error bootstrapping profile:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=profile.js.map