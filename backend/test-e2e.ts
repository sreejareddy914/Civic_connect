import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SECRET_KEY || ''
);

async function runTests() {
  console.log("Starting E2E API Tests...");

  // 0. Create a dummy image file
  const testImagePath = './test-image.jpg';
  fs.writeFileSync(testImagePath, 'fake-image-content-for-testing-bytes');

  let issueId = '';

  // TEST 1: New Issue Submission
  try {
    const formData = new FormData();
    formData.append('title', 'Test Pothole');
    formData.append('description', 'Large pothole on the road');
    formData.append('latitude', '37.7749');
    formData.append('longitude', '-122.4194');
    formData.append('category', 'Roads');
    formData.append('image', fs.createReadStream(testImagePath));

    console.log("Submitting Complaint A...");
    const reportRes = await fetch('http://localhost:3000/api/issues/report', {
      method: 'POST',
      body: formData
    });
    const reportData = await reportRes.json() as any;
    console.log("Report A Result:", reportData.message);
    issueId = reportData.issue.id;

    if (!issueId) throw new Error("Issue ID not returned");
  } catch(e: any) {
    console.error("Test 1 Failed:", e.message);
  }

  // TEST 2: Check Database Persistence
  try {
    console.log("Verifying Database for Complaint A...");
    const { data: media } = await supabase.from('issue_media').select('*').eq('issue_id', issueId);
    if (media && media.length > 0) {
      console.log("Media Record exists:", media[0].storage_path);
    } else {
      console.error("No media record found!");
    }

    const { data: aiData } = await supabase.from('ai_analysis').select('*').eq('issue_id', issueId);
    if (aiData && aiData.length > 0) {
      console.log("AI Record exists");
    } else {
      console.error("No AI record found!");
    }

    const extraRes = await fetch(`http://localhost:3000/api/issues/${issueId}/extra`);
    const extraData = await extraRes.json() as any;
    console.log("Extra API Fetch:", !!extraData.media && !!extraData.media.storage_path ? "SUCCESS" : "FAIL");

  } catch(e: any) {
    console.error("Test 2 Failed:", e.message);
  }

  // TEST 3: Duplicate Detection (Analyze endpoint)
  try {
    const formData = new FormData();
    formData.append('title', 'Test Pothole');
    formData.append('description', 'Large pothole on the road');
    formData.append('latitude', '37.7749');
    formData.append('longitude', '-122.4194');
    formData.append('image', fs.createReadStream(testImagePath)); // EXACT SAME BYTES

    console.log("Analyzing Complaint B (Exact Duplicate)...");
    const analyzeRes = await fetch('http://localhost:3000/api/issues/analyze', {
      method: 'POST',
      body: formData
    });
    
    const analyzeData = await analyzeRes.json() as any;
    const isDuplicate = analyzeData?.analysis?.duplicate?.isDuplicate;
    const matchedReportId = analyzeData?.analysis?.duplicate?.matchedReportId;
    
    console.log(`Duplicate detected: ${isDuplicate}, Matched ID: ${matchedReportId}`);
    if (isDuplicate && matchedReportId === issueId) {
      console.log("Test 3: Duplicate logic passed!");
    } else {
      console.error("Test 3 Failed: Did not detect exact duplicate");
      console.log("Full analysis:", JSON.stringify(analyzeData.analysis, null, 2));
    }

  } catch(e: any) {
    console.error("Test 3 Failed:", e.message);
  }
  
  // Cleanup
  if (fs.existsSync(testImagePath)) {
    fs.unlinkSync(testImagePath);
  }
}

runTests();
