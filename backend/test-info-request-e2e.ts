import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import ws from 'ws';
import { InformationRequestService } from './src/services/InformationRequestService';
import { IssueLifecycleService } from './src/services/IssueLifecycleService';

dotenv.config();
globalThis.WebSocket = ws as any;

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SECRET_KEY || '',
  { auth: { persistSession: false } }
);

async function runE2ETest() {
  console.log('====================================================');
  console.log('CIVICCONNECT: END-TO-END INFORMATION REQUEST WORKFLOW TEST');
  console.log('====================================================\n');

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition: boolean, testName: string, detail?: any) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`[FAIL] ${testName}`, detail || '');
      failedTests++;
    }
  }

  try {
    // 1. Find an issue to test with
    const { data: testIssues, error: issueErr } = await supabase
      .from('issues')
      .select('id, code, title, reporter_id, status')
      .not('reporter_id', 'is', null)
      .limit(1);

    if (issueErr || !testIssues || testIssues.length === 0) {
      throw new Error('No issue found with a reporter_id to test.');
    }

    const testIssue = testIssues[0];
    const citizenId = testIssue.reporter_id;

    // Find an admin user
    const { data: admins } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('role', 'ADMIN')
      .limit(1);

    const adminId = admins && admins.length > 0 ? admins[0].id : '00000000-0000-0000-0000-000000000001';

    console.log(`Test Subject:`);
    console.log(`- Issue ID: ${testIssue.id} (${testIssue.code || 'No Code'})`);
    console.log(`- Citizen ID: ${citizenId}`);
    console.log(`- Admin ID: ${adminId}\n`);

    // ==========================================
    // STEP 1: ADMIN SENDS "REQUEST MORE INFO"
    // ==========================================
    console.log('--- Step 1: Admin Creates Information Request ---');
    const adminMessage = `Please upload a clearer wide-angle photo showing the complete road section. Test timestamp ${Date.now()}`;
    const requestType = 'ADDITIONAL_PHOTO';

    const reqRecord = await InformationRequestService.createRequest({
      issueId: testIssue.id,
      requestedBy: adminId,
      citizenId,
      message: adminMessage,
      requestType
    });

    assert(!!reqRecord.id, 'Request created with persistent UUID', reqRecord.id);
    assert(reqRecord.status === 'PENDING', 'Request status is PENDING', reqRecord.status);
    assert(reqRecord.message === adminMessage, 'Request message matches exact admin text');
    assert(reqRecord.citizen_id === citizenId, 'Request belongs to correct citizen');
    assert(reqRecord.issue_id === testIssue.id, 'Request belongs to correct issue');

    // Lifecycle transition
    await IssueLifecycleService.transitionIssueStatus({
      issueId: testIssue.id,
      targetStatus: 'CITIZEN_VERIFICATION',
      actorId: adminId,
      notes: `Admin requested additional information: "${adminMessage}"`,
      options: { force: true }
    });

    // Create notification
    await supabase.from('notifications').insert({
      profile_id: citizenId,
      title: 'Additional Information Required',
      message: `The Admin requested additional information for your complaint "${testIssue.title}": "${adminMessage}"`,
      is_read: false,
      link: '/track'
    });

    // Verify DB issue status
    const { data: updatedIssue } = await supabase
      .from('issues')
      .select('status')
      .eq('id', testIssue.id)
      .single();
    assert(
      updatedIssue?.status === 'CITIZEN_VERIFICATION',
      'Issue status transitioned in DB',
      updatedIssue?.status
    );

    // Verify Citizen Notification
    const { data: citizenNotifs } = await supabase
      .from('notifications')
      .select('*')
      .eq('profile_id', citizenId)
      .eq('title', 'Additional Information Required')
      .order('created_at', { ascending: false })
      .limit(1);

    assert(
      citizenNotifs && citizenNotifs.length > 0 && citizenNotifs[0].message.includes(adminMessage),
      'Citizen received persistent notification containing exact Admin message'
    );

    // ==========================================
    // STEP 2: CITIZEN RETRIEVES PENDING REQUEST
    // ==========================================
    console.log('\n--- Step 2: Citizen Dashboard Retrieval ---');
    const citizenPending = await InformationRequestService.getActiveRequestsForCitizen(citizenId);
    const matchingReq = citizenPending.find(r => r.id === reqRecord.id);

    assert(
      !!matchingReq,
      'Citizen retrieves active PENDING request for their complaint',
      matchingReq?.id
    );
    assert(
      matchingReq?.status === 'PENDING',
      'Active request is in PENDING state (triggers [Add Additional Info] button)'
    );

    // Verify Pending Issue IDs for Admin Queue
    const pendingIssueIds = await InformationRequestService.getPendingIssueIds();
    assert(
      pendingIssueIds.includes(testIssue.id),
      'Admin "More Info Required" queue includes this issue'
    );

    // ==========================================
    // STEP 3: SECURITY - UNAUTHORIZED CITIZEN ATTEMPT
    // ==========================================
    console.log('\n--- Step 3: Security & Validation Checks ---');
    const fakeCitizenId = '99999999-9999-9999-9999-999999999999';
    let unauthorizedCaught = false;
    try {
      await InformationRequestService.submitResponse({
        requestId: reqRecord.id,
        issueId: testIssue.id,
        citizenId: fakeCitizenId,
        message: 'Malicious unauthorized response attempt'
      });
    } catch (e: any) {
      unauthorizedCaught = true;
    }
    assert(unauthorizedCaught, 'Reject response submission from non-owner citizen');

    // Reject mismatching issue ID
    let mismatchCaught = false;
    try {
      await InformationRequestService.submitResponse({
        requestId: reqRecord.id,
        issueId: '00000000-0000-0000-0000-000000000000',
        citizenId,
        message: 'Mismatching issue ID'
      });
    } catch {
      mismatchCaught = true;
    }
    assert(mismatchCaught, 'Reject response with mismatched issue ID');

    // ==========================================
    // STEP 4: CITIZEN RESPONDS WITH ADDITIONAL INFO
    // ==========================================
    console.log('\n--- Step 4: Citizen Submits Response ---');
    const citizenResponseText = 'Here is the requested clear photo showing the whole pothole section next to the landmark tree.';
    
    // Simulate media upload in issue_media
    const { data: mediaRecord } = await supabase
      .from('issue_media')
      .insert({
        issue_id: testIssue.id,
        uploaded_by: citizenId,
        storage_path: `test_clarification_${Date.now()}.jpg`,
        media_type: 'AFTER'
      })
      .select()
      .single();

    const { request: updatedReq, response: respRecord } = await InformationRequestService.submitResponse({
      requestId: reqRecord.id,
      issueId: testIssue.id,
      citizenId,
      message: citizenResponseText,
      mediaId: mediaRecord?.id
    });

    assert(updatedReq.status === 'RESPONDED', 'Request status updated to RESPONDED in database');
    assert(!!updatedReq.responded_at, 'responded_at timestamp set', updatedReq.responded_at);
    assert(respRecord.message === citizenResponseText, 'Response message stored persistently');
    assert(respRecord.request_id === reqRecord.id, 'Response linked to exact request_id');

    // Transition issue status back to review queue (REPORTED)
    await IssueLifecycleService.transitionIssueStatus({
      issueId: testIssue.id,
      targetStatus: 'REPORTED',
      actorId: citizenId,
      notes: `Citizen submitted additional information: "${citizenResponseText}"`,
      options: { force: true }
    });

    // Notify Admin
    await supabase.from('notifications').insert({
      profile_id: adminId,
      title: 'Additional Information Received',
      message: `Citizen submitted additional information for complaint ${testIssue.code || testIssue.id}.`,
      is_read: false,
      link: `/admin/issues/${testIssue.id}`
    });

    // Verify DB issue status after response
    const { data: issueAfterResp } = await supabase
      .from('issues')
      .select('status')
      .eq('id', testIssue.id)
      .single();
    assert(
      issueAfterResp?.status === 'REPORTED',
      'Complaint returns to REPORTED review queue after response',
      issueAfterResp?.status
    );

    // Verify button disappearance condition
    const citizenPendingAfter = await InformationRequestService.getActiveRequestsForCitizen(citizenId);
    const stillPending = citizenPendingAfter.some(r => r.id === reqRecord.id);
    assert(
      !stillPending,
      '[Add Additional Info] button condition returns false (disappears from UI)'
    );

    // Verify Admin Notification
    const { data: adminNotifs } = await supabase
      .from('notifications')
      .select('*')
      .eq('profile_id', adminId)
      .eq('title', 'Additional Information Received')
      .order('created_at', { ascending: false })
      .limit(1);
    assert(
      adminNotifs && adminNotifs.length > 0,
      'Admin received persistent notification of Citizen response'
    );

    // ==========================================
    // STEP 5: PREVENT DUPLICATE RESPONSES
    // ==========================================
    console.log('\n--- Step 5: Duplicate Response Prevention ---');
    let duplicateCaught = false;
    try {
      await InformationRequestService.submitResponse({
        requestId: reqRecord.id,
        issueId: testIssue.id,
        citizenId,
        message: 'Duplicate second response attempt'
      });
    } catch {
      duplicateCaught = true;
    }
    assert(duplicateCaught, 'Reject duplicate response on already RESPONDED request');

    // ==========================================
    // STEP 6: ADMIN VIEWS REQUEST & RESPONSE HISTORY
    // ==========================================
    console.log('\n--- Step 6: Admin Views Request History ---');
    const issueHistory = await InformationRequestService.getRequestsForIssue(testIssue.id);
    const historyItem = issueHistory.find(r => r.id === reqRecord.id);

    assert(!!historyItem, 'Admin can view request history for issue');
    assert(historyItem?.status === 'RESPONDED', 'History item status is RESPONDED');
    assert(historyItem?.message === adminMessage, 'History retains original Admin message');
    assert(historyItem?.response?.message === citizenResponseText, 'History retains Citizen response');
    assert(!!historyItem?.response?.media, 'History retains attached evidence / media link');

    // ==========================================
    // STEP 7: MULTIPLE REQUESTS FOR SAME COMPLAINT
    // ==========================================
    console.log('\n--- Step 7: Multiple Requests Support ---');
    const secondAdminMessage = 'Thank you for the photo. Could you also tell us the nearest house or shop number?';
    const secondReq = await InformationRequestService.createRequest({
      issueId: testIssue.id,
      requestedBy: adminId,
      citizenId,
      message: secondAdminMessage,
      requestType: 'LOCATION_CLARIFICATION'
    });

    const multiHistory = await InformationRequestService.getRequestsForIssue(testIssue.id);
    assert(
      multiHistory.length >= 2,
      'Complaint retains multiple historical requests without overwriting',
      `Count: ${multiHistory.length}`
    );

    const firstInHistory = multiHistory.find(r => r.id === reqRecord.id);
    const secondInHistory = multiHistory.find(r => r.id === secondReq.id);

    assert(firstInHistory?.status === 'RESPONDED', 'Previous request remains RESPONDED');
    assert(secondInHistory?.status === 'PENDING', 'New second request is PENDING');

    // ==========================================
    // STEP 8: REQUEST CLOSURE
    // ==========================================
    console.log('\n--- Step 8: Admin Closes Request ---');
    const closed = await InformationRequestService.closeRequest(reqRecord.id, adminId);
    assert(closed.status === 'CLOSED', 'Request marked as CLOSED by Admin');

    let closedResponseCaught = false;
    try {
      await InformationRequestService.submitResponse({
        requestId: reqRecord.id,
        issueId: testIssue.id,
        citizenId,
        message: 'Attempt responding to closed request'
      });
    } catch {
      closedResponseCaught = true;
    }
    assert(closedResponseCaught, 'Reject response submission on CLOSED request');

    // Clean up second test request by closing it too
    await InformationRequestService.closeRequest(secondReq.id, adminId);

    console.log('\n====================================================');
    console.log(`TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log('====================================================');

    if (failedTests > 0) {
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Fatal test error:', err);
    process.exit(1);
  }
}

runE2ETest();
