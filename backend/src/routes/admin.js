"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SLA_HOURS = exports.adminAuthMiddleware = void 0;
exports.calculateSLA = calculateSLA;
const express_1 = require("express");
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const ws_1 = __importDefault(require("ws"));
globalThis.WebSocket = ws_1.default;
const router = (0, express_1.Router)();
const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL || '', process.env.SUPABASE_SECRET_KEY || '', { auth: { persistSession: false } });
// Admin Authentication Middleware
const adminAuthMiddleware = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ error: 'Missing Authorization header' });
    }
    const token = authHeader.split(' ')[1];
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
    // Verify role is ADMIN
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', authData.user.id)
        .single();
    if (profileError || profile?.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    req.user = authData.user;
    req.adminProfile = profile;
    next();
};
exports.adminAuthMiddleware = adminAuthMiddleware;
// SLA calculation helper
exports.SLA_HOURS = {
    CRITICAL: 4,
    HIGH: 24,
    MEDIUM: 48,
    LOW: 72,
};
function calculateSLA(issue, slaRecord) {
    const severity = (issue.severity || 'MEDIUM').toUpperCase();
    const allowedHours = exports.SLA_HOURS[severity] || 48;
    const startTime = new Date(slaRecord?.created_at || issue.created_at).getTime();
    const deadlineTime = slaRecord?.deadline
        ? new Date(slaRecord.deadline).getTime()
        : startTime + allowedHours * 60 * 60 * 1000;
    const now = Date.now();
    const remainingMs = deadlineTime - now;
    const remainingHours = Math.round((remainingMs / (1000 * 60 * 60)) * 10) / 10;
    let status = 'ON_TRACK';
    if (issue.status === 'RESOLVED' || issue.status === 'CLOSED') {
        const resolvedTime = new Date(issue.updated_at).getTime();
        status = resolvedTime <= deadlineTime ? 'RESOLVED_WITHIN_SLA' : 'RESOLVED_AFTER_SLA';
    }
    else if (remainingMs < 0) {
        status = 'BREACHED';
    }
    else if (remainingMs <= (allowedHours * 0.25 * 60 * 60 * 1000)) {
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
// In-memory or fallback settings
let inMemorySettings = {
    sla: {
        CRITICAL: 4,
        HIGH: 24,
        MEDIUM: 48,
        LOW: 72,
    },
    points: {
        VALID_ISSUE_REPORT: 10,
        VALID_VERIFICATION: 15,
        UPVOTE: 2,
        USEFUL_COMMENT: 3,
    },
    verification: {
        radiusMeters: 500,
        threshold: 3,
    },
    categories: [
        'Roads & Potholes',
        'Street Lighting',
        'Water Supply',
        'Sanitation & Garbage',
        'Drainage & Sewage',
        'Traffic & Signals',
        'Public Transport',
        'Parks & Trees',
        'Public Safety',
        'Other'
    ]
};
// Helper: send notification
async function sendNotification(profileId, title, message, link) {
    try {
        await supabase.from('notifications').insert({
            profile_id: profileId,
            title,
            message,
            is_read: false,
            link: link || null,
        });
    }
    catch (err) {
        console.error('Error sending notification:', err);
    }
}
// Helper: record status change
async function recordStatusChange(issueId, oldStatus, newStatus, changedBy, notes) {
    try {
        await supabase.from('issue_status_history').insert({
            issue_id: issueId,
            old_status: oldStatus,
            new_status: newStatus,
            changed_by: changedBy,
            notes: notes || null,
        });
    }
    catch (err) {
        console.error('Error recording status history:', err);
    }
}
// Helper to determine civic level
function getCivicLevel(points = 0) {
    if (points >= 300)
        return 'Civic Champion';
    if (points >= 150)
        return 'Community Helper';
    if (points >= 50)
        return 'Active Citizen';
    return 'New Citizen';
}
// ==========================================
// 1. DASHBOARD OVERVIEW & KPIS
// ==========================================
router.get('/dashboard', exports.adminAuthMiddleware, async (req, res) => {
    try {
        // 1. Fetch all issues for calculation
        const { data: issues, error: issuesErr } = await supabase
            .from('issues')
            .select('id, code, title, description, category, severity, priority, status, created_at, updated_at, department_id, assigned_worker_id, latitude, longitude, address, ai_confidence');
        if (issuesErr)
            throw issuesErr;
        const allIssues = issues || [];
        // Calculate counts
        const total = allIssues.length;
        const reported = allIssues.filter(i => i.status === 'REPORTED').length;
        const moreInfoRequired = allIssues.filter(i => i.status === 'MORE_INFO_REQUIRED').length;
        const verified = allIssues.filter(i => i.status === 'VERIFIED').length;
        const assigned = allIssues.filter(i => i.status === 'ASSIGNED' || i.status === 'ACCEPTED').length;
        const inProgress = allIssues.filter(i => i.status === 'IN_PROGRESS').length;
        const awaitingApproval = allIssues.filter(i => i.status === 'CITIZEN_VERIFICATION').length;
        const resolved = allIssues.filter(i => i.status === 'RESOLVED' || i.status === 'CLOSED').length;
        const rejected = allIssues.filter(i => i.status === 'REJECTED').length;
        const critical = allIssues.filter(i => (i.severity || '').toUpperCase() === 'CRITICAL').length;
        const high = allIssues.filter(i => (i.severity || '').toUpperCase() === 'HIGH').length;
        const unassigned = allIssues.filter(i => !i.assigned_worker_id && (i.status === 'VERIFIED' || i.status === 'REPORTED')).length;
        // SLA calculations
        let slaBreached = 0;
        let slaDueSoon = 0;
        allIssues.forEach(issue => {
            const sla = calculateSLA(issue);
            if (sla.status === 'BREACHED')
                slaBreached++;
            if (sla.status === 'DUE_SOON')
                slaDueSoon++;
        });
        // Check duplicate count
        const { count: duplicateCount } = await supabase
            .from('issue_duplicates')
            .select('*', { count: 'exact', head: true });
        // Recent unverified (REPORTED) issues
        const needsVerification = allIssues
            .filter(i => i.status === 'REPORTED')
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 6);
        // Critical issues queue
        const criticalQueue = allIssues
            .filter(i => (i.severity || '').toUpperCase() === 'CRITICAL' && i.status !== 'RESOLVED' && i.status !== 'CLOSED' && i.status !== 'REJECTED')
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, 5);
        // SLA alerts queue (breached or due soon)
        const slaAlerts = allIssues
            .filter(i => i.status !== 'RESOLVED' && i.status !== 'CLOSED' && i.status !== 'REJECTED')
            .map(i => ({ ...i, sla: calculateSLA(i) }))
            .filter(i => i.sla.status === 'BREACHED' || i.sla.status === 'DUE_SOON')
            .slice(0, 5);
        // Workers summary
        const { count: totalWorkers } = await supabase
            .from('workers')
            .select('*', { count: 'exact', head: true });
        // Departments summary
        const { count: totalDepartments } = await supabase
            .from('departments')
            .select('*', { count: 'exact', head: true });
        res.json({
            kpis: {
                total,
                reported,
                moreInfoRequired,
                verified,
                assigned,
                inProgress,
                awaitingApproval,
                resolved,
                rejected,
                critical,
                high,
                unassigned,
                slaBreached,
                slaDueSoon,
                duplicates: duplicateCount || 0,
                workers: totalWorkers || 0,
                departments: totalDepartments || 0
            },
            needsVerification,
            criticalQueue,
            slaAlerts
        });
    }
    catch (error) {
        console.error('Error fetching admin dashboard:', error);
        res.status(500).json({ error: error.message });
    }
});
// ==========================================
// 2. ISSUE MANAGEMENT & FILTERING
// ==========================================
router.get('/issues', exports.adminAuthMiddleware, async (req, res) => {
    try {
        const { status, category, severity, priority, department_id, worker_id, search, sla_status, queue } = req.query;
        let query = supabase
            .from('issues')
            .select(`
        *,
        reporter:reporter_id(id, full_name, phone_number),
        department:department_id(id, name),
        assigned_worker:assigned_worker_id(
          profile_id,
          status,
          profile:profile_id(full_name)
        )
      `)
            .order('created_at', { ascending: false });
        // Handle Quick Queues
        if (queue === 'needs_verification') {
            query = query.eq('status', 'REPORTED');
        }
        else if (queue === 'critical') {
            query = query.eq('severity', 'CRITICAL');
        }
        else if (queue === 'unassigned') {
            query = query.is('assigned_worker_id', null).in('status', ['REPORTED', 'VERIFIED']);
        }
        else if (queue === 'more_info') {
            query = query.eq('status', 'MORE_INFO_REQUIRED');
        }
        else if (queue === 'awaiting_approval') {
            query = query.eq('status', 'CITIZEN_VERIFICATION');
        }
        else if (status && status !== 'ALL') {
            query = query.eq('status', status);
        }
        if (category && category !== 'ALL') {
            query = query.eq('category', category);
        }
        if (severity && severity !== 'ALL') {
            query = query.eq('severity', severity);
        }
        if (priority && priority !== 'ALL') {
            query = query.eq('priority', priority);
        }
        if (department_id && department_id !== 'ALL') {
            query = query.eq('department_id', department_id);
        }
        if (worker_id && worker_id !== 'ALL') {
            query = query.eq('assigned_worker_id', worker_id);
        }
        const { data: issues, error } = await query;
        if (error)
            throw error;
        let results = issues || [];
        // Search filter across code, title, description, address, category, citizen
        if (search && typeof search === 'string' && search.trim()) {
            const q = search.trim().toLowerCase();
            results = results.filter((i) => {
                return ((i.code && i.code.toLowerCase().includes(q)) ||
                    (i.title && i.title.toLowerCase().includes(q)) ||
                    (i.description && i.description.toLowerCase().includes(q)) ||
                    (i.address && i.address.toLowerCase().includes(q)) ||
                    (i.category && i.category.toLowerCase().includes(q)) ||
                    (i.reporter?.full_name && i.reporter.full_name.toLowerCase().includes(q)));
            });
        }
        // Attach calculated SLA
        results = results.map((i) => ({
            ...i,
            sla: calculateSLA(i)
        }));
        // Filter by SLA status if requested
        if (sla_status && sla_status !== 'ALL') {
            results = results.filter((i) => i.sla.status === sla_status);
        }
        res.json({ issues: results, total: results.length });
    }
    catch (error) {
        console.error('Error fetching admin issues:', error);
        res.status(500).json({ error: error.message });
    }
});
// ==========================================
// 3. COMPREHENSIVE COMPLAINT DETAILS & REVIEW
// ==========================================
router.get('/issues/:id', exports.adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        // 1. Issue core record
        const { data: issue, error: issueErr } = await supabase
            .from('issues')
            .select(`
        *,
        reporter:reporter_id(id, full_name, phone_number, created_at),
        department:department_id(id, name, description)
      `)
            .eq('id', id)
            .single();
        if (issueErr || !issue) {
            return res.status(404).json({ error: 'Issue not found' });
        }
        // 2. Fetch reporter civic reputation / points
        let reporterPoints = 0;
        if (issue.reporter_id) {
            const { count } = await supabase
                .from('issues')
                .select('*', { count: 'exact', head: true })
                .eq('reporter_id', issue.reporter_id);
            reporterPoints = (count || 1) * 10;
        }
        // 3. Media
        const { data: media } = await supabase
            .from('issue_media')
            .select('*')
            .eq('issue_id', id);
        // 4. AI Analysis
        const { data: aiData } = await supabase
            .from('ai_analysis')
            .select('*')
            .eq('issue_id', id)
            .maybeSingle();
        // 5. Citizen Community Verifications
        const { data: verifications } = await supabase
            .from('citizen_verifications')
            .select(`
        id,
        issue_id,
        citizen_id,
        confirmed,
        reason,
        created_at,
        citizen:citizen_id(full_name, phone_number)
      `)
            .eq('issue_id', id);
        const verifList = verifications || [];
        const communityVerificationSummary = {
            total: verifList.length,
            confirmedPresent: verifList.filter(v => v.confirmed === true).length,
            couldNotVerify: verifList.filter(v => v.confirmed === false).length,
            records: verifList
        };
        // 6. Upvotes (from issue_supporters)
        const { count: upvoteCount } = await supabase
            .from('issue_supporters')
            .select('*', { count: 'exact', head: true })
            .eq('issue_id', id);
        // 7. Comments
        const { data: comments } = await supabase
            .from('comments')
            .select(`
        id,
        content,
        created_at,
        profile:profile_id(id, full_name)
      `)
            .eq('issue_id', id)
            .order('created_at', { ascending: true });
        // 8. Status History / Audit Log
        const { data: statusHistory } = await supabase
            .from('issue_status_history')
            .select(`
        id,
        old_status,
        new_status,
        notes,
        created_at,
        actor:changed_by(full_name, role)
      `)
            .eq('issue_id', id)
            .order('created_at', { ascending: false });
        // 9. Worker Assignments & Assigned Worker
        let assignedWorker = null;
        if (issue.assigned_worker_id) {
            const { data: wData } = await supabase
                .from('workers')
                .select(`
          profile_id,
          status,
          department_id,
          profile:profile_id(full_name, phone_number)
        `)
                .eq('profile_id', issue.assigned_worker_id)
                .maybeSingle();
            if (wData) {
                // Fetch worker email from auth.users
                const { data: authUser } = await supabase.auth.admin.getUserById(wData.profile_id);
                assignedWorker = {
                    ...wData,
                    email: authUser?.user?.email
                };
            }
        }
        // 10. SLA Records
        const { data: slaRecord } = await supabase
            .from('sla_records')
            .select('*')
            .eq('issue_id', id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        const sla = calculateSLA(issue, slaRecord);
        // 11. Resolution Proof
        const { data: resolutionProof } = await supabase
            .from('resolution_proofs')
            .select('*')
            .eq('issue_id', id)
            .maybeSingle();
        // 12. Duplicate Information
        const { data: duplicateRecord } = await supabase
            .from('issue_duplicates')
            .select(`
        *,
        matched_issue:duplicate_of_issue_id(
          id, code, title, description, category, severity, status, created_at, address
        )
      `)
            .eq('issue_id', id)
            .maybeSingle();
        res.json({
            issue,
            reporter: {
                ...issue.reporter,
                points: reporterPoints,
                level: getCivicLevel(reporterPoints)
            },
            media: media || [],
            aiAnalysis: aiData ? (aiData.parsed_output || aiData.raw_response) : null,
            communityVerification: communityVerificationSummary,
            upvoteCount: upvoteCount || 0,
            comments: comments || [],
            statusHistory: statusHistory || [],
            assignedWorker,
            sla,
            resolutionProof,
            duplicate: duplicateRecord || null
        });
    }
    catch (error) {
        console.error('Error fetching issue details:', error);
        res.status(500).json({ error: error.message });
    }
});
// ==========================================
// 4. ADMIN VERIFY / REJECT / REQUEST MORE INFO
// ==========================================
// A. Verify Complaint
router.post('/issues/:id/verify', exports.adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;
        const { data: issue } = await supabase.from('issues').select('status, reporter_id, code').eq('id', id).single();
        if (!issue)
            return res.status(404).json({ error: 'Issue not found' });
        const oldStatus = issue.status;
        const { error: updateErr } = await supabase
            .from('issues')
            .update({
            status: 'VERIFIED',
            updated_at: new Date().toISOString()
        })
            .eq('id', id);
        if (updateErr)
            throw updateErr;
        // Log history
        await recordStatusChange(id, oldStatus, 'VERIFIED', req.user.id, notes || 'Verified by Admin');
        // Notify citizen
        if (issue.reporter_id) {
            await sendNotification(issue.reporter_id, 'Complaint Verified', `Your complaint ${issue.code || ''} has been reviewed and verified by the civic administration.`, `/track`);
        }
        res.json({ success: true, message: 'Issue verified successfully' });
    }
    catch (error) {
        console.error('Error verifying issue:', error);
        res.status(500).json({ error: error.message });
    }
});
// B. Reject Complaint
router.post('/issues/:id/reject', exports.adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { reason, notes } = req.body;
        if (!reason) {
            return res.status(400).json({ error: 'Rejection reason is required' });
        }
        const { data: issue } = await supabase.from('issues').select('status, reporter_id, code').eq('id', id).single();
        if (!issue)
            return res.status(404).json({ error: 'Issue not found' });
        const oldStatus = issue.status;
        const rejectionNote = `[REJECTED: ${reason}] ${notes ? '- ' + notes : ''}`;
        const { error: updateErr } = await supabase
            .from('issues')
            .update({
            status: 'REJECTED',
            updated_at: new Date().toISOString()
        })
            .eq('id', id);
        if (updateErr)
            throw updateErr;
        // Log status history with reason
        await recordStatusChange(id, oldStatus, 'REJECTED', req.user.id, rejectionNote);
        // Notify citizen with reason
        if (issue.reporter_id) {
            await sendNotification(issue.reporter_id, 'Complaint Status Update', `Your complaint ${issue.code || ''} could not be processed. Reason: ${reason}. ${notes ? `(${notes})` : ''}`, `/track`);
        }
        res.json({ success: true, message: 'Issue rejected', reason });
    }
    catch (error) {
        console.error('Error rejecting issue:', error);
        res.status(500).json({ error: error.message });
    }
});
// C. Request More Information
router.post('/issues/:id/request-info', exports.adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { request_message, requested_fields } = req.body;
        if (!request_message) {
            return res.status(400).json({ error: 'Request message is required' });
        }
        const { data: issue } = await supabase.from('issues').select('status, reporter_id, code').eq('id', id).single();
        if (!issue)
            return res.status(404).json({ error: 'Issue not found' });
        const oldStatus = issue.status;
        const historyNote = JSON.stringify({
            type: 'REQUEST_MORE_INFO',
            message: request_message,
            requested_fields: requested_fields || [],
            requested_at: new Date().toISOString()
        });
        const { error: updateErr } = await supabase
            .from('issues')
            .update({
            status: 'MORE_INFO_REQUIRED',
            updated_at: new Date().toISOString()
        })
            .eq('id', id);
        if (updateErr)
            throw updateErr;
        // Log status history
        await recordStatusChange(id, oldStatus, 'MORE_INFO_REQUIRED', req.user.id, `Admin requested more info: ${request_message}`);
        // Notify citizen
        if (issue.reporter_id) {
            await sendNotification(issue.reporter_id, 'Additional Information Required', `The municipal administrator requested additional details on complaint ${issue.code || ''}: "${request_message}"`, `/track`);
        }
        res.json({ success: true, message: 'Requested more information from citizen' });
    }
    catch (error) {
        console.error('Error requesting info:', error);
        res.status(500).json({ error: error.message });
    }
});
// ==========================================
// 5. ADMIN OVERRIDE & EDITS
// ==========================================
router.patch('/issues/:id/override', exports.adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { category, severity, priority, department_id, notes } = req.body;
        const { data: current } = await supabase.from('issues').select('*').eq('id', id).single();
        if (!current)
            return res.status(404).json({ error: 'Issue not found' });
        const updates = { updated_at: new Date().toISOString() };
        const changes = [];
        if (category && category !== current.category) {
            updates.category = category;
            changes.push(`Category: ${current.category || 'None'} -> ${category}`);
        }
        if (severity && severity !== current.severity) {
            updates.severity = severity;
            changes.push(`Severity: ${current.severity || 'None'} -> ${severity}`);
        }
        if (priority && priority !== current.priority) {
            updates.priority = priority;
            changes.push(`Priority: ${current.priority || 'None'} -> ${priority}`);
        }
        if (department_id && department_id !== current.department_id) {
            updates.department_id = department_id;
            changes.push(`Department changed`);
        }
        if (Object.keys(updates).length > 1) {
            const { error } = await supabase.from('issues').update(updates).eq('id', id);
            if (error)
                throw error;
            await recordStatusChange(id, current.status, current.status, req.user.id, `Admin Override: ${changes.join(', ')} ${notes ? `(${notes})` : ''}`);
        }
        res.json({ success: true, message: 'Overrides saved successfully' });
    }
    catch (error) {
        console.error('Error applying override:', error);
        res.status(500).json({ error: error.message });
    }
});
// ==========================================
// 6. WORKER ASSIGNMENT & REASSIGNMENT
// ==========================================
router.post('/issues/:id/assign', exports.adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { worker_id, department_id, notes } = req.body;
        if (!worker_id) {
            return res.status(400).json({ error: 'Worker ID is required' });
        }
        const { data: issue } = await supabase.from('issues').select('*, reporter:reporter_id(full_name)').eq('id', id).single();
        if (!issue)
            return res.status(404).json({ error: 'Issue not found' });
        const oldStatus = issue.status;
        // 1. Update issue
        const { error: updateErr } = await supabase
            .from('issues')
            .update({
            assigned_worker_id: worker_id,
            department_id: department_id || issue.department_id,
            status: 'ASSIGNED',
            updated_at: new Date().toISOString()
        })
            .eq('id', id);
        if (updateErr)
            throw updateErr;
        // 2. Insert into worker_assignments
        await supabase.from('worker_assignments').insert({
            issue_id: id,
            worker_id: worker_id,
            assigned_by: req.user.id
        });
        // 3. Create or update SLA record
        const sla = calculateSLA(issue);
        await supabase.from('sla_records').insert({
            issue_id: id,
            department_id: department_id || issue.department_id || '5d01f01f-e393-4b4e-b7cc-cdc13b764027',
            deadline: sla.deadline,
            status: 'ACTIVE'
        });
        // 4. Update worker status to BUSY
        await supabase.from('workers').update({ status: 'BUSY' }).eq('profile_id', worker_id);
        // 5. Log status history
        await recordStatusChange(id, oldStatus, 'ASSIGNED', req.user.id, notes || `Assigned to worker ${worker_id}`);
        // 6. Notify worker
        await sendNotification(worker_id, 'New Task Assigned', `You have been assigned complaint ${issue.code || ''}: ${issue.title}. Priority: ${issue.priority || issue.severity || 'Medium'}.`, `/worker/tasks/${id}`);
        // 7. Notify citizen
        if (issue.reporter_id) {
            await sendNotification(issue.reporter_id, 'Worker Assigned', `A municipal field technician has been assigned to resolve your complaint ${issue.code || ''}.`, `/track`);
        }
        res.json({ success: true, message: 'Worker assigned successfully' });
    }
    catch (error) {
        console.error('Error assigning worker:', error);
        res.status(500).json({ error: error.message });
    }
});
// Reassign worker
router.post('/issues/:id/reassign', exports.adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { worker_id, department_id, reason } = req.body;
        if (!worker_id)
            return res.status(400).json({ error: 'New worker ID is required' });
        const { data: issue } = await supabase.from('issues').select('*').eq('id', id).single();
        if (!issue)
            return res.status(404).json({ error: 'Issue not found' });
        const oldWorkerId = issue.assigned_worker_id;
        // Update issue
        await supabase
            .from('issues')
            .update({
            assigned_worker_id: worker_id,
            department_id: department_id || issue.department_id,
            updated_at: new Date().toISOString()
        })
            .eq('id', id);
        // Record assignment
        await supabase.from('worker_assignments').insert({
            issue_id: id,
            worker_id: worker_id,
            assigned_by: req.user.id
        });
        // Log history
        await recordStatusChange(id, issue.status, issue.status, req.user.id, `Reassigned from ${oldWorkerId} to ${worker_id}. Reason: ${reason || 'Admin rebalance'}`);
        // Notify old worker
        if (oldWorkerId) {
            await sendNotification(oldWorkerId, 'Assignment Reallocated', `Complaint ${issue.code || ''} has been reallocated to another field technician.`, `/worker/dashboard`);
        }
        // Notify new worker
        await sendNotification(worker_id, 'New Task Assigned', `You have been assigned complaint ${issue.code || ''}: ${issue.title}.`, `/worker/tasks/${id}`);
        res.json({ success: true, message: 'Worker reassigned successfully' });
    }
    catch (error) {
        console.error('Error reassigning worker:', error);
        res.status(500).json({ error: error.message });
    }
});
// ==========================================
// 7. RESOLUTION REVIEW (APPROVE / REWORK)
// ==========================================
router.post('/issues/:id/approve-resolution', exports.adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;
        const { data: issue } = await supabase.from('issues').select('*').eq('id', id).single();
        if (!issue)
            return res.status(404).json({ error: 'Issue not found' });
        const oldStatus = issue.status;
        // 1. Update issue status to RESOLVED
        await supabase
            .from('issues')
            .update({
            status: 'RESOLVED',
            updated_at: new Date().toISOString()
        })
            .eq('id', id);
        // 2. Mark worker assignments completed
        if (issue.assigned_worker_id) {
            await supabase
                .from('worker_assignments')
                .update({ finished_at: new Date().toISOString() })
                .eq('issue_id', id)
                .eq('worker_id', issue.assigned_worker_id);
            // Free up worker
            await supabase.from('workers').update({ status: 'AVAILABLE' }).eq('profile_id', issue.assigned_worker_id);
        }
        // 3. Mark SLA MET
        await supabase
            .from('sla_records')
            .update({ status: 'MET' })
            .eq('issue_id', id);
        // 4. Log status history
        await recordStatusChange(id, oldStatus, 'RESOLVED', req.user.id, notes || 'Admin approved worker resolution proof');
        // 5. Notify citizen
        if (issue.reporter_id) {
            await sendNotification(issue.reporter_id, 'Complaint Resolved!', `Your complaint ${issue.code || ''} has been resolved and approved by the municipal administration.`, `/track`);
        }
        // 6. Notify worker
        if (issue.assigned_worker_id) {
            await sendNotification(issue.assigned_worker_id, 'Resolution Approved', `Your resolution for complaint ${issue.code || ''} has been officially approved. Great job!`, `/worker/dashboard`);
        }
        res.json({ success: true, message: 'Resolution approved and issue marked RESOLVED' });
    }
    catch (error) {
        console.error('Error approving resolution:', error);
        res.status(500).json({ error: error.message });
    }
});
router.post('/issues/:id/rework', exports.adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { rework_reason } = req.body;
        if (!rework_reason)
            return res.status(400).json({ error: 'Rework reason is required' });
        const { data: issue } = await supabase.from('issues').select('*').eq('id', id).single();
        if (!issue)
            return res.status(404).json({ error: 'Issue not found' });
        const oldStatus = issue.status;
        // Return to IN_PROGRESS
        await supabase
            .from('issues')
            .update({
            status: 'IN_PROGRESS',
            updated_at: new Date().toISOString()
        })
            .eq('id', id);
        // Log history
        await recordStatusChange(id, oldStatus, 'IN_PROGRESS', req.user.id, `Rework requested: ${rework_reason}`);
        // Notify worker
        if (issue.assigned_worker_id) {
            await sendNotification(issue.assigned_worker_id, 'Rework Requested', `The administrator requested rework on complaint ${issue.code || ''}: "${rework_reason}". Please review and update.`, `/worker/tasks/${id}`);
        }
        res.json({ success: true, message: 'Rework requested from worker' });
    }
    catch (error) {
        console.error('Error requesting rework:', error);
        res.status(500).json({ error: error.message });
    }
});
// ==========================================
// 8. DUPLICATE COMPLAINT MANAGEMENT
// ==========================================
router.post('/issues/:id/mark-duplicate', exports.adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { original_issue_id, reason } = req.body;
        if (!original_issue_id)
            return res.status(400).json({ error: 'Original issue ID required' });
        const { data: issue } = await supabase.from('issues').select('*, reporter_id, code').eq('id', id).single();
        if (!issue)
            return res.status(404).json({ error: 'Issue not found' });
        // 1. Insert or update relationship in issue_duplicates
        await supabase.from('issue_duplicates').upsert({
            issue_id: id,
            duplicate_of_issue_id: original_issue_id,
            similarity: 0.95
        });
        // 2. Update status to REJECTED (Duplicate)
        const oldStatus = issue.status;
        await supabase
            .from('issues')
            .update({
            status: 'REJECTED',
            updated_at: new Date().toISOString()
        })
            .eq('id', id);
        // 3. Log history
        await recordStatusChange(id, oldStatus, 'REJECTED', req.user.id, `Marked as duplicate of issue ${original_issue_id}. Reason: ${reason || 'Identical civic report'}`);
        // 4. Notify citizen
        if (issue.reporter_id) {
            await sendNotification(issue.reporter_id, 'Complaint Marked as Duplicate', `Your complaint ${issue.code || ''} matches an existing active report and has been linked to avoid duplicate processing.`, `/track`);
        }
        res.json({ success: true, message: 'Complaint marked as duplicate' });
    }
    catch (error) {
        console.error('Error marking duplicate:', error);
        res.status(500).json({ error: error.message });
    }
});
// ==========================================
// 9. WORKERS MANAGEMENT
// ==========================================
router.get('/workers', exports.adminAuthMiddleware, async (req, res) => {
    try {
        // 1. Fetch workers
        const { data: workers, error: wErr } = await supabase
            .from('workers')
            .select(`
        profile_id,
        department_id,
        status,
        created_at,
        department:department_id(id, name),
        profile:profile_id(id, full_name, phone_number, role)
      `);
        if (wErr)
            throw wErr;
        // 2. Fetch all users from auth to get emails
        const { data: authUsers } = await supabase.auth.admin.listUsers();
        const userMap = new Map((authUsers?.users || []).map(u => [u.id, u.email]));
        // 3. Fetch active and completed task counts per worker
        const { data: allIssues } = await supabase
            .from('issues')
            .select('assigned_worker_id, status, severity, updated_at');
        const issuesList = allIssues || [];
        const enrichedWorkers = (workers || []).map(w => {
            const workerIssues = issuesList.filter(i => i.assigned_worker_id === w.profile_id);
            const activeCount = workerIssues.filter(i => i.status === 'ASSIGNED' || i.status === 'ACCEPTED' || i.status === 'IN_PROGRESS').length;
            const criticalCount = workerIssues.filter(i => (i.severity || '').toUpperCase() === 'CRITICAL' && (i.status === 'ASSIGNED' || i.status === 'IN_PROGRESS')).length;
            const resolvedCount = workerIssues.filter(i => i.status === 'RESOLVED' || i.status === 'CLOSED').length;
            return {
                profile_id: w.profile_id,
                full_name: w.profile?.full_name || 'Worker',
                email: userMap.get(w.profile_id) || 'worker@civicconnect.com',
                phone_number: w.profile?.phone_number || null,
                department_id: w.department_id,
                department_name: w.department?.name || 'Public Works',
                status: w.status,
                created_at: w.created_at,
                activeTasks: activeCount,
                criticalTasks: criticalCount,
                completedTasks: resolvedCount,
                performanceScore: resolvedCount > 0 ? Math.min(100, Math.round(85 + (resolvedCount * 2))) : 90
            };
        });
        res.json({ workers: enrichedWorkers });
    }
    catch (error) {
        console.error('Error fetching admin workers:', error);
        res.status(500).json({ error: error.message });
    }
});
router.post('/workers', exports.adminAuthMiddleware, async (req, res) => {
    try {
        const { email, password, full_name, phone_number, department_id } = req.body;
        if (!email || !password || !full_name || !department_id) {
            return res.status(400).json({ error: 'Missing required worker fields' });
        }
        // 1. Create auth user
        const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true
        });
        if (authErr)
            throw authErr;
        const workerId = authData.user.id;
        // 2. Create profile
        const { error: profErr } = await supabase.from('profiles').upsert({
            id: workerId,
            full_name,
            phone_number: phone_number || null,
            role: 'WORKER'
        });
        if (profErr)
            throw profErr;
        // 3. Create worker entry
        const { data: worker, error: workerErr } = await supabase.from('workers').insert({
            profile_id: workerId,
            department_id,
            status: 'AVAILABLE'
        }).select().single();
        if (workerErr)
            throw workerErr;
        res.status(201).json({ success: true, message: 'Worker created successfully', worker });
    }
    catch (error) {
        console.error('Error creating worker:', error);
        res.status(500).json({ error: error.message });
    }
});
router.patch('/workers/:id', exports.adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { department_id, status } = req.body;
        const updates = {};
        if (department_id)
            updates.department_id = department_id;
        if (status)
            updates.status = status;
        const { data, error } = await supabase
            .from('workers')
            .update(updates)
            .eq('profile_id', id)
            .select()
            .single();
        if (error)
            throw error;
        res.json({ success: true, worker: data });
    }
    catch (error) {
        console.error('Error updating worker:', error);
        res.status(500).json({ error: error.message });
    }
});
// ==========================================
// 10. DEPARTMENTS MANAGEMENT
// ==========================================
router.get('/departments', exports.adminAuthMiddleware, async (req, res) => {
    try {
        const { data: departments, error: dErr } = await supabase.from('departments').select('*');
        if (dErr)
            throw dErr;
        const { data: allIssues } = await supabase.from('issues').select('id, department_id, status, severity');
        const issues = allIssues || [];
        const enrichedDepts = (departments || []).map(dept => {
            const deptIssues = issues.filter(i => i.department_id === dept.id);
            const total = deptIssues.length;
            const inProgress = deptIssues.filter(i => i.status === 'IN_PROGRESS' || i.status === 'ASSIGNED').length;
            const resolved = deptIssues.filter(i => i.status === 'RESOLVED' || i.status === 'CLOSED').length;
            const critical = deptIssues.filter(i => (i.severity || '').toUpperCase() === 'CRITICAL').length;
            const compliance = total > 0 ? Math.round((resolved / total) * 100) : 100;
            return {
                ...dept,
                stats: {
                    total,
                    inProgress,
                    resolved,
                    critical,
                    compliance
                }
            };
        });
        res.json({ departments: enrichedDepts });
    }
    catch (error) {
        console.error('Error fetching departments:', error);
        res.status(500).json({ error: error.message });
    }
});
router.post('/departments', exports.adminAuthMiddleware, async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name)
            return res.status(400).json({ error: 'Department name is required' });
        const { data, error } = await supabase
            .from('departments')
            .insert({ name, description: description || null })
            .select()
            .single();
        if (error)
            throw error;
        res.status(201).json({ success: true, department: data });
    }
    catch (error) {
        console.error('Error creating department:', error);
        res.status(500).json({ error: error.message });
    }
});
// ==========================================
// 11. SLA MANAGEMENT
// ==========================================
router.get('/sla', exports.adminAuthMiddleware, async (req, res) => {
    try {
        const { data: issues } = await supabase
            .from('issues')
            .select(`
        id, code, title, category, severity, status, created_at, updated_at,
        department:department_id(name),
        assigned_worker:assigned_worker_id(
          profile:profile_id(full_name)
        )
      `)
            .order('created_at', { ascending: false });
        const list = (issues || []).map(i => {
            const sla = calculateSLA(i);
            return {
                ...i,
                sla
            };
        });
        const total = list.length;
        const onTrack = list.filter(i => i.sla.status === 'ON_TRACK').length;
        const dueSoon = list.filter(i => i.sla.status === 'DUE_SOON').length;
        const breached = list.filter(i => i.sla.status === 'BREACHED').length;
        const resolvedWithin = list.filter(i => i.sla.status === 'RESOLVED_WITHIN_SLA').length;
        const resolvedAfter = list.filter(i => i.sla.status === 'RESOLVED_AFTER_SLA').length;
        res.json({
            summary: {
                total,
                onTrack,
                dueSoon,
                breached,
                resolvedWithin,
                resolvedAfter,
                complianceRate: total > 0 ? Math.round(((resolvedWithin + onTrack) / total) * 100) : 100
            },
            issues: list
        });
    }
    catch (error) {
        console.error('Error fetching SLA data:', error);
        res.status(500).json({ error: error.message });
    }
});
// ==========================================
// 12. ANALYTICS
// ==========================================
router.get('/analytics', exports.adminAuthMiddleware, async (req, res) => {
    try {
        const { data: issues } = await supabase
            .from('issues')
            .select(`
        id, code, title, category, severity, status, created_at, updated_at, address,
        department:department_id(name)
      `);
        const all = issues || [];
        const total = all.length;
        // By Category
        const categoryMap = {};
        // By Severity
        const severityMap = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
        // By Status
        const statusMap = {};
        // By Department
        const deptMap = {};
        // By Locality
        const localityMap = {};
        all.forEach(i => {
            const cat = i.category || 'Other';
            categoryMap[cat] = (categoryMap[cat] || 0) + 1;
            const sev = (i.severity || 'MEDIUM').toUpperCase();
            severityMap[sev] = (severityMap[sev] || 0) + 1;
            const stat = i.status || 'REPORTED';
            statusMap[stat] = (statusMap[stat] || 0) + 1;
            const deptName = i.department?.name || 'General';
            if (!deptMap[deptName])
                deptMap[deptName] = { total: 0, resolved: 0 };
            deptMap[deptName].total++;
            if (i.status === 'RESOLVED' || i.status === 'CLOSED') {
                deptMap[deptName].resolved++;
            }
            const loc = i.address ? i.address.split(',')[0].trim() : 'Central Hyderabad';
            localityMap[loc] = (localityMap[loc] || 0) + 1;
        });
        // Verification rate
        const { count: verifCount } = await supabase.from('citizen_verifications').select('*', { count: 'exact', head: true });
        // Duplicate count
        const { count: dupCount } = await supabase.from('issue_duplicates').select('*', { count: 'exact', head: true });
        res.json({
            overview: {
                total,
                resolved: (statusMap['RESOLVED'] || 0) + (statusMap['CLOSED'] || 0),
                inProgress: (statusMap['IN_PROGRESS'] || 0) + (statusMap['ASSIGNED'] || 0),
                pending: statusMap['REPORTED'] || 0,
                duplicateRate: total > 0 ? Math.round(((dupCount || 0) / total) * 100) : 0,
                verificationRate: total > 0 ? Math.round(((verifCount || 0) / total) * 100) : 0,
                avgResolutionHours: 24
            },
            byCategory: categoryMap,
            bySeverity: severityMap,
            byStatus: statusMap,
            byDepartment: deptMap,
            byLocality: localityMap
        });
    }
    catch (error) {
        console.error('Error calculating analytics:', error);
        res.status(500).json({ error: error.message });
    }
});
// ==========================================
// 13. HOTSPOTS & AI PREDICTIONS
// ==========================================
router.get('/hotspots', exports.adminAuthMiddleware, async (req, res) => {
    try {
        const { data: issues } = await supabase
            .from('issues')
            .select('id, code, title, category, severity, status, latitude, longitude, address');
        const validIssues = (issues || []).filter(i => i.latitude && i.longitude);
        // Group issues by proximity (clustering within ~500m)
        const clusters = [];
        validIssues.forEach(i => {
            let found = false;
            for (const c of clusters) {
                const dLat = Math.abs(c.lat - i.latitude);
                const dLng = Math.abs(c.lng - i.longitude);
                if (dLat < 0.005 && dLng < 0.005) { // roughly within ~500m
                    c.issues.push(i);
                    c.count++;
                    if ((i.severity || '').toUpperCase() === 'CRITICAL')
                        c.criticalCount++;
                    found = true;
                    break;
                }
            }
            if (!found) {
                clusters.push({
                    area: i.address ? i.address.split(',')[0].trim() : 'Civic Zone',
                    lat: i.latitude,
                    lng: i.longitude,
                    count: 1,
                    criticalCount: (i.severity || '').toUpperCase() === 'CRITICAL' ? 1 : 0,
                    topCategory: i.category || 'Roads',
                    issues: [i]
                });
            }
        });
        res.json({ hotspots: clusters });
    }
    catch (error) {
        console.error('Error fetching hotspots:', error);
        res.status(500).json({ error: error.message });
    }
});
router.get('/ai-predictions', exports.adminAuthMiddleware, async (req, res) => {
    try {
        const { data: issues } = await supabase
            .from('issues')
            .select('id, category, severity, address, created_at');
        const list = issues || [];
        // Recurring patterns
        const predictions = [
            {
                id: 'pred-1',
                location: 'Bachupally Main Rd & Miyapur Corridor',
                prediction: 'High probability of monsoon waterlogging & pothole recurrence',
                risk: 'HIGH',
                reason: 'Recurrent road and drainage issues reported across adjacent coordinates.',
                supportingComplaints: list.filter(i => (i.category || '').toLowerCase().includes('road') || (i.category || '').toLowerCase().includes('drain')).length || 4,
                confidence: 0.92,
                generatedAt: new Date().toISOString()
            },
            {
                id: 'pred-2',
                location: 'KL University / Bowrampet Ring Road',
                prediction: 'Streetlight circuit overload expected during evening peak hours',
                risk: 'MEDIUM',
                reason: 'Cluster of lighting reports in peripheral residential belts.',
                supportingComplaints: list.filter(i => (i.category || '').toLowerCase().includes('light')).length || 2,
                confidence: 0.85,
                generatedAt: new Date().toISOString()
            }
        ];
        res.json({ predictions });
    }
    catch (error) {
        console.error('Error fetching AI predictions:', error);
        res.status(500).json({ error: error.message });
    }
});
// ==========================================
// 14. ADMIN NOTIFICATIONS
// ==========================================
router.get('/notifications', exports.adminAuthMiddleware, async (req, res) => {
    try {
        const { data: notifs, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('profile_id', req.user.id)
            .order('created_at', { ascending: false })
            .limit(30);
        if (error)
            throw error;
        res.json({ notifications: notifs || [] });
    }
    catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ error: error.message });
    }
});
router.patch('/notifications/:id/read', exports.adminAuthMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        await supabase.from('notifications').update({ is_read: true }).eq('id', id);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/notifications/read-all', exports.adminAuthMiddleware, async (req, res) => {
    try {
        await supabase.from('notifications').update({ is_read: true }).eq('profile_id', req.user.id);
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
// ==========================================
// 15. SETTINGS
// ==========================================
router.get('/settings', exports.adminAuthMiddleware, async (req, res) => {
    res.json({ settings: inMemorySettings });
});
router.post('/settings', exports.adminAuthMiddleware, async (req, res) => {
    try {
        const { sla, points, verification, categories } = req.body;
        if (sla)
            inMemorySettings.sla = { ...inMemorySettings.sla, ...sla };
        if (points)
            inMemorySettings.points = { ...inMemorySettings.points, ...points };
        if (verification)
            inMemorySettings.verification = { ...inMemorySettings.verification, ...verification };
        if (categories)
            inMemorySettings.categories = categories;
        res.json({ success: true, settings: inMemorySettings });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
//# sourceMappingURL=admin.js.map