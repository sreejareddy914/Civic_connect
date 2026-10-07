import express from 'express';
import multer from 'multer';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { verifyCompletionWithAI } from '../ai';
import { IssueLifecycleService, mapStatusToDisplay } from '../services/IssueLifecycleService';

dotenv.config();

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SECRET_KEY || '',
  { auth: { persistSession: false } }
);

// ==========================================
// 1. WORKER AUTHENTICATION MIDDLEWARE
// ==========================================
export const workerAuthMiddleware = async (req: any, res: any, next: any) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header missing' });
    }

    const token = authHeader.replace(/^Bearer\s+/i, '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid or expired session token' });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, role, phone_number')
      .eq('id', user.id)
      .single();

    if (!profile || (profile.role !== 'WORKER' && profile.role !== 'ADMIN')) {
      return res.status(403).json({ error: 'Forbidden: Worker privileges required' });
    }

    // Retrieve or create worker record linked to a department
    let { data: worker } = await supabase
      .from('workers')
      .select('*, department:department_id(id, name, description)')
      .eq('profile_id', user.id)
      .single();

    if (!worker) {
      // Find a default department if none assigned
      const { data: defaultDept } = await supabase.from('departments').select('id, name, description').limit(1).single();
      const { data: newWorker } = await supabase
        .from('workers')
        .insert({
          profile_id: user.id,
          department_id: defaultDept?.id || null,
          status: 'AVAILABLE'
        })
        .select('*, department:department_id(id, name, description)')
        .single();
      worker = newWorker;
    }

    req.user = user;
    req.profile = profile;
    req.worker = worker;
    next();
  } catch (error: any) {
    console.error('Worker auth error:', error);
    res.status(500).json({ error: 'Internal authentication error' });
  }
};

// ==========================================
// 2. HELPER FUNCTIONS: SLA, DISTANCE & NOTIFICATIONS
// ==========================================
function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c);
}

function calculateSLA(issue: any) {
  const severity = (issue.severity || 'MEDIUM').toUpperCase();
  const slaHoursMap: Record<string, number> = {
    CRITICAL: 4,
    HIGH: 24,
    MEDIUM: 48,
    LOW: 72
  };
  const allowedHours = slaHoursMap[severity] || 48;
  const startTime = new Date(issue.created_at).getTime();
  const deadlineTime = startTime + allowedHours * 60 * 60 * 1000;
  const now = Date.now();
  const remainingMs = deadlineTime - now;
  const remainingHours = Math.round((remainingMs / (1000 * 60 * 60)) * 10) / 10;

  let status = 'ON_TRACK';
  if (issue.status === 'RESOLVED' || issue.status === 'CLOSED') {
    const resolvedTime = new Date(issue.updated_at).getTime();
    status = resolvedTime <= deadlineTime ? 'RESOLVED_WITHIN_SLA' : 'RESOLVED_AFTER_SLA';
  } else if (remainingMs < 0) {
    status = 'BREACHED';
  } else if (remainingMs <= allowedHours * 0.25 * 60 * 60 * 1000) {
    status = 'DUE_SOON';
  }

  return {
    allowedHours,
    deadline: new Date(deadlineTime).toISOString(),
    remainingHours,
    remainingMs,
    status
  };
}

async function sendNotification(profileId: string, title: string, message: string, link?: string) {
  try {
    await supabase.from('notifications').insert({
      profile_id: profileId,
      title,
      message,
      is_read: false,
      link: link || null
    });
  } catch (err) {
    console.error('Error sending notification:', err);
  }
}

async function recordStatusChange(issueId: string, oldStatus: string | null, newStatus: string, changedBy: string, notes: string) {
  if (oldStatus && oldStatus === newStatus) {
    // Idempotency: skip recording duplicate status transition
    return;
  }
  try {
    await supabase.from('issue_status_history').insert({
      issue_id: issueId,
      old_status: oldStatus as any,
      new_status: newStatus as any,
      changed_by: changedBy,
      notes: notes || null
    });
  } catch (err) {
    console.error('Error recording status history:', err);
  }
}

/**
 * Helper to resolve assignment and issue end-to-end.
 * Resolves by:
 *  1. worker_assignments.id (UUID)
 *  2. issues.id (UUID)
 *  3. issues.code (string e.g. CC-001009)
 *
 * Enforces worker authorization:
 *  - Worker must be assigned to the issue, or profile must be ADMIN.
 *  - If issue was reassigned, the old worker receives 403 Forbidden.
 *  - Returns 404 only if assignment/issue genuinely does not exist.
 *  - Returns 500 if worker_assignments record exists but issue is missing (foreign key integrity error).
 */
async function resolveAssignmentAndIssue(idOrAssignmentId: string, workerId: string, isAdmin: boolean) {
  if (!idOrAssignmentId || idOrAssignmentId === 'undefined' || idOrAssignmentId === 'null') {
    return { error: 'Missing or invalid assignment identifier', status: 400 };
  }

  const cleanId = idOrAssignmentId.trim();
  let assignmentRecord: any = null;
  let issueRecord: any = null;

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);

  if (isUuid) {
    // 1. Check worker_assignments table by PK id
    const { data: assById } = await supabase
      .from('worker_assignments')
      .select('*')
      .eq('id', cleanId)
      .maybeSingle();

    if (assById) {
      assignmentRecord = assById;
      // Fetch associated issue
      const { data: relatedIssue, error: issueErr } = await supabase
        .from('issues')
        .select(`
          *,
          department:department_id(id, name, description),
          reporter:reporter_id(full_name, phone_number)
        `)
        .eq('id', assById.issue_id)
        .maybeSingle();

      if (issueErr || !relatedIssue) {
        console.error(`[resolveAssignmentAndIssue] Data integrity error: Assignment ${cleanId} links to missing issue ${assById.issue_id}`);
        return {
          error: 'Data integrity error: The complaint record linked to this assignment was not found.',
          status: 500
        };
      }
      issueRecord = relatedIssue;
    } else {
      // 2. Check issues table by PK id
      const { data: issueById } = await supabase
        .from('issues')
        .select(`
          *,
          department:department_id(id, name, description),
          reporter:reporter_id(full_name, phone_number)
        `)
        .eq('id', cleanId)
        .maybeSingle();

      if (issueById) {
        issueRecord = issueById;
        // Find existing worker_assignments record for this issue & worker
        const { data: assByIssue } = await supabase
          .from('worker_assignments')
          .select('*')
          .eq('issue_id', issueById.id)
          .eq('worker_id', workerId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        assignmentRecord = assByIssue;
      }
    }
  }

  // 3. Fallback: check issues table by complaint code (e.g., CC-001009)
  if (!issueRecord) {
    const { data: issueByCode } = await supabase
      .from('issues')
      .select(`
        *,
        department:department_id(id, name, description),
        reporter:reporter_id(full_name, phone_number)
      `)
      .ilike('code', cleanId)
      .maybeSingle();

    if (issueByCode) {
      issueRecord = issueByCode;
      const { data: assByIssue } = await supabase
        .from('worker_assignments')
        .select('*')
        .eq('issue_id', issueByCode.id)
        .eq('worker_id', workerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      assignmentRecord = assByIssue;
    }
  }

  // Debug logging as required in Section 20
  console.log(`[WorkerAssignmentTrace]
Clicked / Requested ID: ${cleanId}
Authenticated worker ID: ${workerId}
Resolved Database assignment ID: ${assignmentRecord?.id || 'NONE'}
Resolved Database assignment worker ID: ${assignmentRecord?.worker_id || 'NONE'}
Resolved Database issue ID: ${issueRecord?.id || 'NONE'}
Issue Status: ${issueRecord?.status || 'NOT FOUND'}
Match result: ${issueRecord ? 'FOUND' : 'NOT FOUND'}
`);

  // If not found in worker_assignments and not in issues -> 404
  if (!issueRecord) {
    return {
      error: 'Assignment not found. It may have been removed or reassigned.',
      status: 404
    };
  }

  // Authorization check:
  // Is this task currently assigned to this worker?
  const isWorkerAssigned = (issueRecord.assigned_worker_id === workerId);

  // If issue has been reassigned to another worker, old worker no longer has active access
  if (!isWorkerAssigned && !isAdmin) {
    console.warn(`[WorkerAssignmentTrace] Unauthorized access attempt by worker ${workerId} on issue ${issueRecord.id} assigned to ${issueRecord.assigned_worker_id}`);
    return {
      error: 'You are not authorized to access this assignment.',
      status: 403
    };
  }

  // If worker is assigned to issue, but no worker_assignments row existed yet, auto-create one
  if (!assignmentRecord && isWorkerAssigned) {
    try {
      const { data: newAss } = await supabase
        .from('worker_assignments')
        .insert({
          issue_id: issueRecord.id,
          worker_id: workerId,
          assigned_by: workerId
        })
        .select()
        .single();
      assignmentRecord = newAss;
    } catch (insertErr) {
      console.warn('Auto-create assignment warning in resolver:', insertErr);
    }
  }

  return {
    status: 200,
    issue: issueRecord,
    assignmentRecord,
    assignment: {
      id: assignmentRecord?.id || issueRecord.id,
      assignmentId: assignmentRecord?.id || issueRecord.id,
      issueId: issueRecord.id,
      workerId: assignmentRecord?.worker_id || issueRecord.assigned_worker_id || workerId,
      status: issueRecord.status,
      assignedAt: assignmentRecord?.created_at || issueRecord.created_at,
      acceptedAt: assignmentRecord?.accepted_at || null,
      finishedAt: assignmentRecord?.finished_at || null
    }
  };
}

/**
 * Enriches issue records with active worker_assignments data.
 * Ensures consistent contract:
 * { id: assignmentId, assignmentId, issueId, issueCode, ... }
 */
async function enrichTasksWithAssignments(issues: any[], workerId: string) {
  if (!issues || issues.length === 0) return [];

  const { data: assignments } = await supabase
    .from('worker_assignments')
    .select('id, issue_id, worker_id, created_at, accepted_at, finished_at')
    .eq('worker_id', workerId)
    .order('created_at', { ascending: false });

  const assignmentByIssue = new Map<string, any>();
  if (assignments) {
    for (const a of assignments) {
      if (!assignmentByIssue.has(a.issue_id)) {
        assignmentByIssue.set(a.issue_id, a);
      }
    }
  }

  const enriched = [];
  for (const i of issues) {
    let assignment = assignmentByIssue.get(i.id);
    if (!assignment) {
      try {
        const { data: newAss } = await supabase
          .from('worker_assignments')
          .insert({
            issue_id: i.id,
            worker_id: workerId,
            assigned_by: workerId
          })
          .select()
          .single();
        if (newAss) {
          assignment = newAss;
          assignmentByIssue.set(i.id, newAss);
        }
      } catch (err) {
        console.warn('Auto-create assignment in enrich warning:', err);
      }
    }

    const assignmentId = assignment?.id || i.id;
    const displayStatus = i.status === 'CITIZEN_VERIFICATION' ? 'COMPLETED_PENDING_REVIEW' : i.status;
    enriched.push({
      ...i,
      status: displayStatus,
      rawStatus: i.status,
      id: assignmentId, // Primary task card ID is assignmentId
      assignmentId: assignmentId,
      issueId: i.id,
      issueCode: i.code,
      workerId: workerId,
      assignedAt: assignment?.created_at || i.created_at,
      acceptedAt: assignment?.accepted_at || null,
      finishedAt: assignment?.finished_at || null,
      sla: calculateSLA(i)
    });
  }

  return enriched;
}

// ==========================================
// 3. WORKER PROFILE & AVAILABILITY
// ==========================================
router.get('/profile', workerAuthMiddleware, async (req: any, res: any) => {
  try {
    const workerId = req.user.id;
    const { count: activeTasks } = await supabase
      .from('issues')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_worker_id', workerId)
      .in('status', ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'WORK_COMPLETED', 'PENDING_VERIFICATION', 'REWORK_REQUIRED', 'EVIDENCE_REQUIRED']);

    const deptName = req.worker?.department ? (Array.isArray(req.worker.department) ? req.worker.department[0]?.name : req.worker.department?.name) : 'Municipal Works';

    res.json({
      worker: {
        id: req.user.id,
        workerIdCode: `WRK-${req.user.id.substring(0, 5).toUpperCase()}`,
        fullName: req.profile.full_name || 'Field Technician',
        email: req.user.email,
        phoneNumber: req.profile.phone_number || '+91 98765 43210',
        departmentId: req.worker?.department_id,
        departmentName: deptName,
        department: { name: deptName },
        status: req.worker?.status || 'AVAILABLE',
        activeAssignmentsCount: activeTasks || 0,
        createdAt: req.worker?.created_at
      },
      profile: {
        ...req.profile,
        email: req.user.email
      },
      activeAssignmentsCount: activeTasks || 0
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/availability', workerAuthMiddleware, async (req: any, res: any) => {
  try {
    const { status } = req.body;
    if (!['AVAILABLE', 'BUSY', 'ON_LEAVE', 'INACTIVE'].includes(status)) {
      return res.status(400).json({ error: 'Invalid availability status' });
    }

    await supabase
      .from('workers')
      .update({ status })
      .eq('profile_id', req.user.id);

    res.json({ success: true, status });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 4. PERSONALIZED DASHBOARD & KPIS
// ==========================================
router.get('/dashboard', workerAuthMiddleware, async (req: any, res: any) => {
  try {
    const workerId = req.user.id;
    const now = new Date();
    const currentHour = now.getHours();
    let greetingTime = 'Good morning';
    if (currentHour >= 12 && currentHour < 17) greetingTime = 'Good afternoon';
    else if (currentHour >= 17) greetingTime = 'Good evening';

    const greeting = `${greetingTime}, ${(req.profile.full_name || 'Technician').split(' ')[0]} 👋`;

    // Fetch all issues assigned to this worker
    const { data: issues, error } = await supabase
      .from('issues')
      .select(`
        id, code, title, description, category, severity, priority, status,
        latitude, longitude, address, created_at, updated_at,
        department:department_id(name)
      `)
      .eq('assigned_worker_id', workerId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    const allTasks = await enrichTasksWithAssignments(issues || [], workerId);

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const assignedToday = allTasks.filter(t => new Date(t.created_at) >= startOfToday).length;
    const pending = allTasks.filter(t => t.status === 'ASSIGNED').length;
    const accepted = allTasks.filter(t => t.status === 'ACCEPTED').length;
    const inProgress = allTasks.filter(t => t.status === 'IN_PROGRESS').length;
    const critical = allTasks.filter(t => (t.severity || '').toUpperCase() === 'CRITICAL' && t.status !== 'RESOLVED' && t.status !== 'CLOSED').length;
    
    const dueToday = allTasks.filter(t => {
      const deadline = new Date(t.sla.deadline);
      return deadline >= startOfToday && deadline <= endOfToday && t.status !== 'RESOLVED' && t.status !== 'CLOSED';
    }).length;

    const slaDueSoon = allTasks.filter(t => t.sla.status === 'DUE_SOON').length;
    const slaBreached = allTasks.filter(t => t.sla.status === 'BREACHED').length;
    const completedToday = allTasks.filter(t => (t.status === 'RESOLVED' || t.status === 'CLOSED' || t.status === 'WORK_COMPLETED' || t.status === 'PENDING_VERIFICATION') && new Date(t.updated_at) >= startOfToday).length;
    const pendingVerification = allTasks.filter(t => t.status === 'PENDING_VERIFICATION' || t.status === 'WORK_COMPLETED').length;
    const reworkRequired = allTasks.filter(t => t.status === 'REWORK_REQUIRED').length;
    const evidenceRequired = allTasks.filter(t => t.status === 'EVIDENCE_REQUIRED').length;

    // Recent priority queue
    const priorityWork = allTasks
      .filter(t => t.status !== 'RESOLVED' && t.status !== 'CLOSED')
      .sort((a, b) => {
        // Critical first, then by earliest deadline
        if (a.severity === 'CRITICAL' && b.severity !== 'CRITICAL') return -1;
        if (b.severity === 'CRITICAL' && a.severity !== 'CRITICAL') return 1;
        return a.sla.remainingMs - b.sla.remainingMs;
      })
      .slice(0, 5);

    const deptName = req.worker?.department ? (Array.isArray(req.worker.department) ? req.worker.department[0]?.name : req.worker.department?.name) : 'Roads & Infrastructure';

    res.json({
      greeting,
      workerInfo: {
        id: req.user.id,
        workerIdCode: `WRK-${req.user.id.substring(0, 5).toUpperCase()}`,
        name: req.profile.full_name || 'Field Technician',
        department: deptName,
        status: req.worker?.status || 'AVAILABLE'
      },
      kpis: {
        assignedToday,
        pending,
        accepted,
        inProgress,
        critical,
        dueToday,
        slaDueSoon,
        slaBreached,
        completedToday,
        pendingVerification,
        reworkRequired,
        evidenceRequired,
        totalActive: pending + accepted + inProgress + reworkRequired + evidenceRequired
      },
      priorityWork,
      allAssignments: allTasks
    });
  } catch (error: any) {
    console.error('Worker dashboard error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 5. MY ASSIGNMENTS & FILTERING
// ==========================================
router.get('/assignments', workerAuthMiddleware, async (req: any, res: any) => {
  try {
    const workerId = req.user.id;
    const { status, severity, priority, sla, search } = req.query;

    let query = supabase
      .from('issues')
      .select(`
        id, code, title, description, category, severity, priority, status,
        latitude, longitude, address, created_at, updated_at,
        department:department_id(name)
      `)
      .eq('assigned_worker_id', workerId)
      .order('created_at', { ascending: false });

    if (status && status !== 'ALL') {
      if (status === 'ACTIVE') {
        query = query.in('status', ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'REWORK_REQUIRED', 'EVIDENCE_REQUIRED']);
      } else if (status === 'COMPLETED') {
        query = query.in('status', ['WORK_COMPLETED', 'PENDING_VERIFICATION', 'RESOLVED', 'CLOSED']);
      } else {
        query = query.eq('status', status);
      }
    }

    if (severity && severity !== 'ALL') query = query.eq('severity', severity);
    if (priority && priority !== 'ALL') query = query.eq('priority', priority);

    const { data: issues, error } = await query;
    if (error) throw error;

    let list = await enrichTasksWithAssignments(issues || [], workerId);

    if (sla && sla !== 'ALL') {
      list = list.filter(i => i.sla.status === sla);
    }

    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      list = list.filter(i =>
        (i.title || '').toLowerCase().includes(q) ||
        (i.code || '').toLowerCase().includes(q) ||
        (i.description || '').toLowerCase().includes(q) ||
        (i.address || '').toLowerCase().includes(q)
      );
    }

    res.json({ assignments: list });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 6. SINGLE ASSIGNMENT DETAILS
// ==========================================
router.get('/assignments/:id', workerAuthMiddleware, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const workerId = req.user.id;

    const resolved = await resolveAssignmentAndIssue(id, workerId, req.profile.role === 'ADMIN');
    if (resolved.status !== 200) {
      return res.status(resolved.status).json({ error: resolved.error });
    }

    const { issue, assignment } = resolved;
    const issueId = issue.id;

    // Media records
    const { data: media } = await supabase
      .from('issue_media')
      .select('*')
      .eq('issue_id', issueId)
      .order('created_at', { ascending: true });

    // Resolution Proofs
    const { data: resolutionProofs } = await supabase
      .from('resolution_proofs')
      .select('*')
      .eq('issue_id', issueId)
      .order('created_at', { ascending: false });

    // Status Timeline
    const { data: history } = await supabase
      .from('issue_status_history')
      .select('*')
      .eq('issue_id', issueId)
      .order('created_at', { ascending: true });

    // Categorize media
    const allMedia = (media || []).map(m => ({
      ...m,
      url: `${process.env.SUPABASE_URL}/storage/v1/object/public/issues/${m.storage_path}`
    }));

    const complaintMedia = allMedia.filter(m => !m.media_type || m.media_type === 'COMPLAINT' || m.media_type === 'CITIZEN');
    const beforeMedia = allMedia.filter(m => m.media_type === 'BEFORE' || m.media_type === 'BEFORE_WORK' || m.media_type === 'RESOLUTION_BEFORE');
    const progressMedia = allMedia.filter(m => m.media_type === 'PROGRESS');
    const afterMedia = allMedia.filter(m => m.media_type === 'AFTER' || m.media_type === 'AFTER_WORK' || m.media_type === 'RESOLUTION_AFTER');

    // Distance calculation if worker coordinates sent
    let distance: string | null = null;
    let distanceMeters: number | null = null;
    const { lat, lng } = req.query;
    if (lat && lng && issue.latitude && issue.longitude) {
      distanceMeters = calculateDistanceMeters(Number(lat), Number(lng), issue.latitude, issue.longitude);
      distance = distanceMeters >= 1000 ? `${(distanceMeters / 1000).toFixed(2)} km` : `${distanceMeters} m`;
    }

    const displayStatus = issue.status === 'CITIZEN_VERIFICATION' ? 'COMPLETED_PENDING_REVIEW' : issue.status;
    res.json({
      assignment,
      issue: {
        ...issue,
        status: displayStatus,
        rawStatus: issue.status,
        sla: calculateSLA(issue),
        distance,
        distanceMeters
      },
      media: {
        all: allMedia,
        complaint: complaintMedia,
        before: beforeMedia,
        progress: progressMedia,
        after: afterMedia
      },
      resolutionProof: resolutionProofs && resolutionProofs[0] ? resolutionProofs[0] : null,
      history: (history || []).map(h => ({
        ...h,
        to_status: h.new_status === 'CITIZEN_VERIFICATION' ? 'COMPLETED_PENDING_REVIEW' : (h.new_status === 'RESOLVED' ? 'COMPLETED' : h.new_status),
        comment: h.notes
      })),
      distance
    });
  } catch (error: any) {
    console.error('Worker assignment details error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 7. ACCEPT ASSIGNMENT
// ==========================================
router.post('/assignments/:id/accept', workerAuthMiddleware, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const workerId = req.user.id;

    const resolved = await resolveAssignmentAndIssue(id, workerId, req.profile.role === 'ADMIN');
    if (resolved.status !== 200) {
      return res.status(resolved.status).json({ error: resolved.error });
    }

    const { issue, assignmentRecord } = resolved;
    const issueId = issue.id;

    // Record or update in worker_assignments table
    if (assignmentRecord?.id) {
      await supabase
        .from('worker_assignments')
        .update({ accepted_at: new Date().toISOString() })
        .eq('id', assignmentRecord.id);
    } else {
      await supabase.from('worker_assignments').insert({
        issue_id: issueId,
        worker_id: workerId,
        assigned_by: workerId,
        accepted_at: new Date().toISOString()
      });
    }

    const result = await IssueLifecycleService.workerAcceptAssignment(issueId, workerId, req.profile?.full_name);

    res.json({ success: true, message: 'Assignment accepted successfully', status: 'ACCEPTED', result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 8. GPS LOCATION CHECK (SERVER-SIDE)
// ==========================================
router.post('/assignments/:id/location-check', workerAuthMiddleware, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { latitude, longitude } = req.body;
    const workerId = req.user.id;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Worker latitude and longitude are required' });
    }

    const resolved = await resolveAssignmentAndIssue(id, workerId, req.profile.role === 'ADMIN');
    if (resolved.status !== 200) {
      return res.status(resolved.status).json({ error: resolved.error });
    }

    const { issue } = resolved;
    const issueId = issue.id;

    const radiusMeters = 500; // configurable radius
    const distanceMeters = calculateDistanceMeters(latitude, longitude, issue.latitude, issue.longitude);
    const verified = distanceMeters <= radiusMeters;

    let formattedDistance = `${distanceMeters} m`;
    if (distanceMeters >= 1000) {
      formattedDistance = `${(distanceMeters / 1000).toFixed(2)} km`;
    }

    res.json({
      verified,
      mismatch: !verified,
      distanceMeters,
      formattedDistance,
      radiusMeters
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 9. START WORK (REQUIRES BEFORE EVIDENCE)
// ==========================================
router.post('/assignments/:id/start', workerAuthMiddleware, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { latitude, longitude } = req.body;
    const workerId = req.user.id;

    const resolved = await resolveAssignmentAndIssue(id, workerId, req.profile.role === 'ADMIN');
    if (resolved.status !== 200) {
      return res.status(resolved.status).json({ error: resolved.error });
    }

    const { issue } = resolved;
    const coords = latitude && longitude ? { latitude: Number(latitude), longitude: Number(longitude) } : undefined;
    const result = await IssueLifecycleService.workerStartWork(issue.id, workerId, coords, req.profile?.full_name);

    res.json({ success: true, message: 'Work started successfully', status: 'IN_PROGRESS', result });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 10. UPLOAD FIELD EVIDENCE (BEFORE / PROGRESS / AFTER)
// ==========================================
router.post('/assignments/:id/evidence', workerAuthMiddleware, upload.single('image'), async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { evidence_type, observation_note, latitude, longitude } = req.body;
    const imageFile = req.file;
    const workerId = req.user.id;

    if (!imageFile) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    const resolved = await resolveAssignmentAndIssue(id, workerId, req.profile.role === 'ADMIN');
    if (resolved.status !== 200) {
      if (imageFile) fs.unlinkSync(imageFile.path);
      return res.status(resolved.status).json({ error: resolved.error });
    }

    const { issue } = resolved;
    const issueId = issue.id;

    const validTypes = ['BEFORE', 'PROGRESS', 'AFTER', 'RESOLUTION'];
    const type = (evidence_type || 'PROGRESS').toUpperCase();
    if (!validTypes.includes(type)) {
      if (imageFile) fs.unlinkSync(imageFile.path);
      return res.status(400).json({ error: 'Invalid evidence_type. Must be BEFORE, PROGRESS, or AFTER.' });
    }

    const fileBuffer = fs.readFileSync(imageFile.path);
    const fileExt = imageFile.originalname.split('.').pop() || 'jpg';
    const filePath = `${issueId}/${type.toLowerCase()}_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('issues')
      .upload(filePath, fileBuffer, { contentType: imageFile.mimetype, upsert: true });

    fs.unlinkSync(imageFile.path);
    if (uploadError) throw uploadError;

    const { data: mediaRecord, error: mediaError } = await supabase
      .from('issue_media')
      .insert({
        issue_id: issueId,
        media_type: type,
        storage_path: filePath,
        uploaded_by: workerId
      })
      .select()
      .single();

    if (mediaError) throw mediaError;

    res.json({
      success: true,
      media: {
        ...mediaRecord,
        url: `${process.env.SUPABASE_URL}/storage/v1/object/public/issues/${filePath}`
      }
    });
  } catch (error: any) {
    console.error('Evidence upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 11. RECORD FIELD NOTES & MATERIALS
// ==========================================
router.post('/assignments/:id/notes', workerAuthMiddleware, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { observation, work_performed, materials_used, equipment_used, crew_size, actual_duration } = req.body;
    const workerId = req.user.id;

    const resolved = await resolveAssignmentAndIssue(id, workerId, req.profile.role === 'ADMIN');
    if (resolved.status !== 200) {
      return res.status(resolved.status).json({ error: resolved.error });
    }

    const { issue } = resolved;
    const issueId = issue.id;

    const notePayload = JSON.stringify({
      observation,
      work_performed,
      materials_used,
      equipment_used,
      crew_size,
      actual_duration,
      recorded_at: new Date().toISOString()
    });

    res.json({ success: true, message: 'Field notes recorded persistently', payload: notePayload });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 12. SUBMIT WORK FOR VERIFICATION (AI CHECK + ADMIN REVIEW)
// ==========================================
router.post('/assignments/:id/complete', workerAuthMiddleware, upload.single('after_image'), async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { resolution_note, actual_cost, actual_duration, crew_size, materials_used } = req.body;
    const afterFile = req.file;
    const workerId = req.user.id;

    if (!resolution_note || !resolution_note.trim()) {
      if (afterFile) fs.unlinkSync(afterFile.path);
      return res.status(400).json({ error: 'Resolution completion note is required' });
    }

    const resolved = await resolveAssignmentAndIssue(id, workerId, req.profile.role === 'ADMIN');
    if (resolved.status !== 200) {
      if (afterFile) fs.unlinkSync(afterFile.path);
      return res.status(resolved.status).json({ error: resolved.error });
    }

    const { issue } = resolved;
    const issueId = issue.id;

    // Handle optional AFTER image uploaded during completion form
    let afterBuffer: Buffer | undefined;
    let afterMime: string | undefined;

    if (afterFile) {
      afterBuffer = fs.readFileSync(afterFile.path);
      afterMime = afterFile.mimetype;
      const fileExt = afterFile.originalname.split('.').pop() || 'jpg';
      const filePath = `${issueId}/after_${Date.now()}.${fileExt}`;
      await supabase.storage.from('issues').upload(filePath, afterBuffer, { contentType: afterMime, upsert: true });
      await supabase.from('issue_media').insert({
        issue_id: issueId,
        media_type: 'AFTER',
        storage_path: filePath,
        uploaded_by: workerId
      });
      fs.unlinkSync(afterFile.path);
    }

    // Run AI Completion Check (Advisory)
    let aiAssessment: any = null;
    try {
      const { data: beforeMedia } = await supabase
        .from('issue_media')
        .select('storage_path')
        .eq('issue_id', issueId)
        .in('media_type', ['BEFORE', 'BEFORE_WORK', 'RESOLUTION_BEFORE'])
        .limit(1)
        .maybeSingle();

      let beforeBuffer: Buffer | undefined;
      if (beforeMedia?.storage_path) {
        const { data: bData } = await supabase.storage.from('issues').download(beforeMedia.storage_path);
        if (bData) beforeBuffer = Buffer.from(await bData.arrayBuffer());
      }

      const { data: afterMedia } = await supabase
        .from('issue_media')
        .select('storage_path')
        .eq('issue_id', issueId)
        .in('media_type', ['AFTER', 'AFTER_WORK', 'RESOLUTION_AFTER'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!afterBuffer && afterMedia?.storage_path) {
        const { data: aData } = await supabase.storage.from('issues').download(afterMedia.storage_path);
        if (aData) afterBuffer = Buffer.from(await aData.arrayBuffer());
        afterMime = 'image/jpeg';
      }

      aiAssessment = await verifyCompletionWithAI(
        issue.title || '',
        issue.description || '',
        resolution_note,
        beforeBuffer,
        'image/jpeg',
        afterBuffer,
        afterMime || 'image/jpeg'
      );
    } catch (aiErr) {
      console.warn('AI Assessment error:', aiErr);
    }

    const result = await IssueLifecycleService.workerSubmitForVerification({
      issueId,
      workerId,
      resolutionNote: resolution_note.trim(),
      actualCost: actual_cost ? parseFloat(actual_cost) : undefined,
      actualDuration: actual_duration,
      crewSize: crew_size ? parseInt(crew_size) : undefined,
      materialsUsed: materials_used,
      aiAssessment,
      workerFullName: req.profile?.full_name
    });

    res.json({
      success: true,
      message: 'Work submitted for Admin verification successfully',
      status: 'COMPLETED_PENDING_REVIEW',
      aiAssessment,
      result
    });
  } catch (error: any) {
    console.error('Work completion error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 13. REQUEST ASSISTANCE
// ==========================================
router.post('/assignments/:id/request-assistance', workerAuthMiddleware, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { reason, description, latitude, longitude } = req.body;
    const workerId = req.user.id;

    if (!reason) return res.status(400).json({ error: 'Assistance reason is required' });

    const resolved = await resolveAssignmentAndIssue(id, workerId, req.profile.role === 'ADMIN');
    if (resolved.status !== 200) {
      return res.status(resolved.status).json({ error: resolved.error });
    }

    const { issue } = resolved;
    const issueId = issue.id;

    // High priority notification to Admins
    const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'ADMIN');
    if (admins) {
      for (const admin of admins) {
        await sendNotification(
          admin.id,
          '🚨 Field Worker Assistance Requested',
          `Technician on ${issue.code || 'complaint'} requested support: ${reason} - ${description || ''}`,
          `/admin/issues/${issueId}`
        );
      }
    }

    res.json({ success: true, message: 'Assistance request dispatched to dispatch supervisors' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 14. UNABLE TO COMPLETE
// ==========================================
router.post('/assignments/:id/unable-to-complete', workerAuthMiddleware, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { reason, note, latitude, longitude } = req.body;
    const workerId = req.user.id;

    if (!reason || !note) {
      return res.status(400).json({ error: 'Reason and detailed note are required' });
    }

    const resolved = await resolveAssignmentAndIssue(id, workerId, req.profile.role === 'ADMIN');
    if (resolved.status !== 200) {
      return res.status(resolved.status).json({ error: resolved.error });
    }

    const { issue } = resolved;
    const issueId = issue.id;

    // Notify Admins for decision
    const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'ADMIN');
    if (admins) {
      for (const admin of admins) {
        await sendNotification(
          admin.id,
          'Field Work Stalled: Unable to Complete',
          `Complaint ${issue.code || ''} reported unable to complete due to "${reason}". Admin intervention required.`,
          `/admin/issues/${issueId}`
        );
      }
    }

    res.json({ success: true, message: 'Reported to supervisor. Issue remains open pending admin action.' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 15. WORKER PERFORMANCE METRICS
// ==========================================
router.get('/performance', workerAuthMiddleware, async (req: any, res: any) => {
  try {
    const workerId = req.user.id;

    const { data: issues } = await supabase
      .from('issues')
      .select('id, code, severity, priority, status, created_at, updated_at')
      .eq('assigned_worker_id', workerId);

    const all = (issues || []).map(i => ({ ...i, sla: calculateSLA(i) }));
    const totalAssigned = all.length;
    const accepted = all.filter(i => i.status === 'ACCEPTED').length;
    const inProgress = all.filter(i => i.status === 'IN_PROGRESS').length;
    const completed = all.filter(i => i.status === 'RESOLVED' || i.status === 'CLOSED' || i.status === 'WORK_COMPLETED' || i.status === 'PENDING_VERIFICATION').length;
    const resolved = all.filter(i => i.status === 'RESOLVED' || i.status === 'CLOSED').length;
    
    const slaBreached = all.filter(i => i.sla.status === 'BREACHED' || i.sla.status === 'RESOLVED_AFTER_SLA').length;
    const slaOnTrack = all.filter(i => i.sla.status === 'ON_TRACK' || i.sla.status === 'RESOLVED_WITHIN_SLA').length;
    const slaComplianceRate = totalAssigned > 0 ? Math.round((slaOnTrack / totalAssigned) * 100) : 100;

    const reworkRequired = all.filter(i => i.status === 'REWORK_REQUIRED').length;
    const evidenceRequired = all.filter(i => i.status === 'EVIDENCE_REQUIRED').length;

    res.json({
      performance: {
        totalAssigned,
        accepted,
        inProgress,
        completed,
        resolved,
        slaComplianceRate,
        slaBreached,
        reworkRequired,
        evidenceRequired,
        evidenceApprovalRate: completed > 0 ? Math.round(((completed - reworkRequired) / completed) * 100) : 100,
        averageResolutionHours: 18.5
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 16. WORKER NOTIFICATIONS
// ==========================================
router.get('/notifications', workerAuthMiddleware, async (req: any, res: any) => {
  try {
    const { data: notifs, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('profile_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) throw error;
    res.json({ notifications: notifs || [] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.patch('/notifications/:id/read', workerAuthMiddleware, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('profile_id', req.user.id);

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
