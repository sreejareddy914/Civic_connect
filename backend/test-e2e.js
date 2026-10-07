"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv_1 = __importDefault(require("dotenv"));
const fs_1 = __importDefault(require("fs"));
const form_data_1 = __importDefault(require("form-data"));
const node_fetch_1 = __importDefault(require("node-fetch"));
dotenv_1.default.config();
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL || '', process.env.SUPABASE_SECRET_KEY || '');
async function runTests() {
    console.log("Starting E2E API Tests...");
    // 0. Create a dummy image file
    const testImagePath = './test-image.jpg';
    fs_1.default.writeFileSync(testImagePath, 'fake-image-content-for-testing-bytes');
    let issueId = '';
    // TEST 1: New Issue Submission
    try {
        const formData = new form_data_1.default();
        formData.append('title', 'Test Pothole');
        formData.append('description', 'Large pothole on the road');
        formData.append('latitude', '37.7749');
        formData.append('longitude', '-122.4194');
        formData.append('category', 'Roads');
        formData.append('image', fs_1.default.createReadStream(testImagePath));
        console.log("Submitting Complaint A...");
        const reportRes = await (0, node_fetch_1.default)('http://localhost:3000/api/issues/report', {
            method: 'POST',
            body: formData
        });
        const reportData = await reportRes.json();
        console.log("Report A Result:", reportData.message);
        issueId = reportData.issue.id;
        if (!issueId)
            throw new Error("Issue ID not returned");
    }
    catch (e) {
        console.error("Test 1 Failed:", e.message);
    }
    // TEST 2: Check Database Persistence
    try {
        console.log("Verifying Database for Complaint A...");
        const { data: media } = await supabase.from('issue_media').select('*').eq('issue_id', issueId);
        if (media && media.length > 0) {
            console.log("Media Record exists:", media[0].storage_path);
        }
        else {
            console.error("No media record found!");
        }
        const { data: aiData } = await supabase.from('ai_analysis').select('*').eq('issue_id', issueId);
        if (aiData && aiData.length > 0) {
            console.log("AI Record exists");
        }
        else {
            console.error("No AI record found!");
        }
        const extraRes = await (0, node_fetch_1.default)(`http://localhost:3000/api/issues/${issueId}/extra`);
        const extraData = await extraRes.json();
        console.log("Extra API Fetch:", !!extraData.media && !!extraData.media.storage_path ? "SUCCESS" : "FAIL");
    }
    catch (e) {
        console.error("Test 2 Failed:", e.message);
    }
    // TEST 3: Duplicate Detection (Analyze endpoint)
    try {
        const formData = new form_data_1.default();
        formData.append('title', 'Test Pothole');
        formData.append('description', 'Large pothole on the road');
        formData.append('latitude', '37.7749');
        formData.append('longitude', '-122.4194');
        formData.append('image', fs_1.default.createReadStream(testImagePath)); // EXACT SAME BYTES
        console.log("Analyzing Complaint B (Exact Duplicate)...");
        const analyzeRes = await (0, node_fetch_1.default)('http://localhost:3000/api/issues/analyze', {
            method: 'POST',
            body: formData
        });
        const analyzeData = await analyzeRes.json();
        const isDuplicate = analyzeData?.analysis?.duplicate?.isDuplicate;
        const matchedReportId = analyzeData?.analysis?.duplicate?.matchedReportId;
        console.log(`Duplicate detected: ${isDuplicate}, Matched ID: ${matchedReportId}`);
        if (isDuplicate && matchedReportId === issueId) {
            console.log("Test 3: Duplicate logic passed!");
        }
        else {
            console.error("Test 3 Failed: Did not detect exact duplicate");
            console.log("Full analysis:", JSON.stringify(analyzeData.analysis, null, 2));
        }
    }
    catch (e) {
        console.error("Test 3 Failed:", e.message);
    }
    // Cleanup
    if (fs_1.default.existsSync(testImagePath)) {
        fs_1.default.unlinkSync(testImagePath);
    }
}
runTests();
//# sourceMappingURL=test-e2e.js.map