"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const ws_1 = __importDefault(require("ws"));
globalThis.WebSocket = ws_1.default;
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL || '', process.env.SUPABASE_SECRET_KEY || '', { auth: { persistSession: false } });
async function test() {
    console.log("Setting up Admin test data...");
    // 1. Create an admin user
    const email = `admin-${Date.now()}@example.com`;
    console.log(`Creating admin ${email}...`);
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: 'password123',
        email_confirm: true
    });
    if (authError) {
        console.error("Error creating user:", authError);
        return;
    }
    const adminId = authData.user.id;
    console.log("Admin User created:", adminId);
    // 2. Create profile
    await supabase.from('profiles').insert({
        id: adminId,
        role: 'ADMIN',
        full_name: 'Chief Administrator'
    });
    console.log("Admin profile created successfully.");
    console.log("\n=================================");
    console.log("USE THESE CREDENTIALS TO TEST ADMIN DASHBOARD:");
    console.log("Email:", email);
    console.log("Password: password123");
    console.log("Route: http://localhost:5174/admin/dashboard");
    console.log("=================================\n");
}
test();
//# sourceMappingURL=test-db.js.map