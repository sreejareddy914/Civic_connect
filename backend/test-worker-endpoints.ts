import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import WebSocket from 'ws';

dotenv.config();

// Admin client using service role key
const adminClient = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SECRET_KEY || '',
  {
    auth: { persistSession: false },
    realtime: { transport: WebSocket }
  }
);

// Auth client
const authClient = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SECRET_KEY || '',
  {
    auth: { persistSession: false },
    realtime: { transport: WebSocket }
  }
);

async function runTests() {
  console.log('--- Testing Worker Endpoints ---');

  // List users using admin API
  const { data: usersData, error: usersErr } = await adminClient.auth.admin.listUsers();
  if (usersErr) {
    console.error('Failed to list users:', usersErr);
    return;
  }

  const workerUser = usersData.users.find(u => u.email?.includes('worker'));
  console.log('Found worker user:', workerUser?.email, workerUser?.id);

  if (!workerUser) {
    console.error('No worker user found');
    return;
  }

  // Update password and sign in to get access token
  await adminClient.auth.admin.updateUserById(workerUser.id, { password: 'WorkerPassword123!' });

  const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
    email: workerUser.email!,
    password: 'WorkerPassword123!'
  });

  if (authError || !authData.session) {
    console.error('Failed to log in as worker:', authError?.message);
    return;
  }

  const token = authData.session.access_token;
  const workerUserId = authData.user.id;
  console.log('Worker logged in successfully. User ID:', workerUserId);

  // 2. Fetch worker profile from profiles table
  const { data: workerProfile } = await adminClient
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', workerUserId)
    .single();

  console.log('Worker profile:', workerProfile);

  // 3. Fetch assignments in DB
  const { data: assignments } = await adminClient
    .from('worker_assignments')
    .select('id, issue_id, worker_id')
    .eq('worker_id', workerUserId);

  console.log(`Worker has ${assignments?.length || 0} assignments in worker_assignments`);

  if (!assignments || assignments.length === 0) {
    console.log('No assignments found for worker, cannot test lookup.');
    return;
  }

  const testAssignment = assignments[0];
  console.log('Testing with assignment:', testAssignment);

  const { data: issue } = await adminClient
    .from('issues')
    .select('id, code, title')
    .eq('id', testAssignment.issue_id)
    .single();

  console.log('Associated issue:', issue);

  // TEST 1: Query GET /api/worker/assignments/:id using worker_assignments.id
  console.log('\n[TEST 1] Querying GET /api/worker/assignments/' + testAssignment.id + ' (using worker_assignments.id)...');
  const res1 = await fetch(`http://localhost:3000/api/worker/assignments/${testAssignment.id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Status code:', res1.status);
  const data1: any = await res1.json();
  console.log('Response keys:', Object.keys(data1));
  console.log('Has assignment:', !!data1.assignment, 'ID:', data1.assignment?.id);
  console.log('Has issue:', !!data1.issue, 'Code:', data1.issue?.code, 'Title:', data1.issue?.title);
  if (res1.status === 200 && data1.assignment?.id === testAssignment.id && data1.issue?.id === testAssignment.issue_id) {
    console.log('✓ TEST 1 PASSED: Successfully retrieved assignment using worker_assignments.id');
  } else {
    console.error('✗ TEST 1 FAILED');
  }

  // TEST 2: Query GET /api/worker/assignments/:id using issues.id
  console.log('\n[TEST 2] Querying GET /api/worker/assignments/' + issue.id + ' (using issues.id)...');
  const res2 = await fetch(`http://localhost:3000/api/worker/assignments/${issue.id}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Status code:', res2.status);
  const data2: any = await res2.json();
  if (res2.status === 200 && data2.assignment?.id === testAssignment.id) {
    console.log('✓ TEST 2 PASSED: Successfully retrieved assignment using issues.id');
  } else {
    console.error('✗ TEST 2 FAILED');
  }

  // TEST 3: Query GET /api/worker/assignments/:id using issues.code
  console.log('\n[TEST 3] Querying GET /api/worker/assignments/' + issue.code + ' (using issues.code)...');
  const res3 = await fetch(`http://localhost:3000/api/worker/assignments/${issue.code}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Status code:', res3.status);
  const data3: any = await res3.json();
  if (res3.status === 200 && data3.issue?.code === issue.code) {
    console.log('✓ TEST 3 PASSED: Successfully retrieved assignment using issues.code');
  } else {
    console.error('✗ TEST 3 FAILED');
  }

  // TEST 4: Security test - Query assignment belonging to another worker
  const { data: otherAssign } = await adminClient
    .from('worker_assignments')
    .select('id, issue_id, worker_id')
    .neq('worker_id', workerProfile?.id)
    .limit(1)
    .maybeSingle();

  if (otherAssign) {
    console.log('\n[TEST 4] Security check: Querying assignment of different worker (' + otherAssign.id + ')...');
    const res4 = await fetch(`http://localhost:3000/api/worker/assignments/${otherAssign.id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Status code:', res4.status);
    const data4: any = await res4.json();
    console.log('Response body:', data4);
    if (res4.status === 403) {
      console.log('✓ TEST 4 PASSED: Correctly returned 403 Forbidden for another worker\'s assignment');
    } else {
      console.error('✗ TEST 4 FAILED: Expected 403, got ' + res4.status);
    }
  }

  // TEST 5: Query genuinely non-existent assignment
  console.log('\n[TEST 5] Querying non-existent assignment (00000000-0000-0000-0000-000000000000)...');
  const res5 = await fetch(`http://localhost:3000/api/worker/assignments/00000000-0000-0000-0000-000000000000`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Status code:', res5.status);
  const data5: any = await res5.json();
  console.log('Response body:', data5);
  if (res5.status === 404) {
    console.log('✓ TEST 5 PASSED: Correctly returned 404 Not Found for genuinely non-existent assignment');
  } else {
    console.error('✗ TEST 5 FAILED: Expected 404, got ' + res5.status);
  }

  // TEST 6: Test GET /api/worker/dashboard task board enrichment
  console.log('\n[TEST 6] Querying GET /api/worker/dashboard...');
  const res6 = await fetch('http://localhost:3000/api/worker/dashboard', {
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log('Status code:', res6.status);
  const data6: any = await res6.json();
  console.log('Tasks returned:', data6.assignedTasks?.length);
  if (data6.assignedTasks?.length > 0) {
    const firstTask = data6.assignedTasks[0];
    console.log('First task id:', firstTask.id, 'assignmentId:', firstTask.assignmentId, 'issueId:', firstTask.issueId, 'code:', firstTask.code);
    if (firstTask.id === firstTask.assignmentId && firstTask.issueId) {
      console.log('✓ TEST 6 PASSED: Task card id is properly set to assignmentId with issueId preserved');
    } else {
      console.error('✗ TEST 6 FAILED: Task card did not have proper assignmentId structure');
    }
  }

  console.log('\n--- ALL AUTOMATED API TESTS FINISHED ---');
}

runTests();
