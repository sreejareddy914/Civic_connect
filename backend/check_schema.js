"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
async function check() {
    const { data, error } = await supabase.from('issue_verifications').select('id').limit(1);
    if (error) {
        console.log("Error querying issue_verifications:", error.message);
    }
    else {
        console.log("issue_verifications table exists!");
    }
}
check();
//# sourceMappingURL=check_schema.js.map