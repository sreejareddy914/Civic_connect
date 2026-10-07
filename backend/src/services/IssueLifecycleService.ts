import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import ws from 'ws';

dotenv.config();

globalThis.WebSocket = ws as any;

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SECRET_KEY || '',
  { auth: { persistSession: false } }
);

// Helper for notifications
export async function sendNotification(
  profileId: string,
  title: string,
  message: string,
  link?: string
) {
  try {
    await supabase.from('notifications').insert({
      profile_id: profileId,
      title,
      message,
      is_read: false,
      link: link || null
    });
  } catch (err) {
    console.error('[IssueLifecycleService] Notification error:', err);
  }
}

/**
 * DB Issue Status Enum (Postgres enforced):
 * 'REPORTED' | 'VERIFIED' | 'ASSIGNED' | 'ACCEPTED' | 'IN_PROGRESS' | 'RESOLVED' | 'CITIZEN_VERIFICATION' | 'CLOSED' | 'REOPENED'
 *
 * Semantic workflow mapping:
 * - COMPLETED_PENDING_REVIEW / PENDING_VERIFICATION -> CITIZEN_VERIFICATION
 * - STARTING_WORK -> IN_PROGRESS
 * - COMPLETED -> RESOLVED
 * - REWORK_REQUIRED -> IN_PROGRESS (with rework note)
 * - EVIDENCE_REQUIRED -> CITIZEN_VERIFICATION (with evidence note)
 */
export function mapStatusToDb(status: string): string {
  switch (status.toUpperCase()) {
    case 'COMPLETED_PENDING_REVIEW':
    case 'PENDING_VERIFICATION':
    case 'AWAITING_REVIEW':
    case 'MORE_INFO_REQUIRED':
    case 'MORE_INFORMATION_REQUIRED':
      return 'CITIZEN_VERIFICATION';
    case 'STARTING_WORK':
    case 'REWORK_REQUIRED':
      return 'IN_PROGRESS';
    case 'COMPLETED':
      return 'RESOLVED';
    case 'EVIDENCE_REQUIRED':
      return 'CITIZEN_VERIFICATION';
    default:
      return status;
  }
}

export function mapStatusToDisplay(dbStatus: string, lastHistoryNote?: string): string {
  if (dbStatus === 'CITIZEN_VERIFICATION') {
    if (
      lastHistoryNote?.includes('Additional Information Required') ||
      lastHistoryNote?.includes('Admin requested more info') ||
      lastHistoryNote?.includes('Admin requested additional information') ||
      lastHistoryNote?.includes('REQUEST_MORE_INFO')
    ) {
      return 'MORE_INFORMATION_REQUIRED';
    }
    if (lastHistoryNote?.includes('Evidence Required by Admin')) {
      return 'EVIDENCE_REQUIRED';
    }
    return 'COMPLETED_PENDING_REVIEW';
  }
  if (dbStatus === 'IN_PROGRESS' && lastHistoryNote?.startsWith('Rework requested by Admin')) {
    return 'REWORK_REQUIRED';
  }
  return dbStatus;
}

export const IssueLifecycleService = {
  /**
   * Centralized, idempotent state transition function.
   * Ensures exactly ONE status transition per legitimate event.
   * Protects against duplicate entries on page loads, re-renders, or repeated requests.
   */
  async transitionIssueStatus(params: {
    issueId: string;
    targetStatus: string;
    actorId: string;
    notes?: string;
    options?: { force?: boolean };
  }): Promise<{
    success: boolean;
    alreadyInState?: boolean;
    oldStatus: string;
    newStatus: string;
    dbStatus: string;
    issue: any;
    error?: string;
  }> {
    const { issueId, targetStatus, actorId, notes, options } = params;

    // 1. Fetch current issue
    const { data: issue, error: fetchErr } = await supabase
      .from('issues')
      .select('id, code, title, status, assigned_worker_id, reporter_id, department_id')
      .eq('id', issueId)
      .single();

    if (fetchErr || !issue) {
      return {
        success: false,
        error: `Issue not found: ${issueId}`,
        oldStatus: '',
        newStatus: targetStatus,
        dbStatus: targetStatus,
        issue: null
      };
    }

    const currentStatus = issue.status;
    const targetDbStatus = mapStatusToDb(targetStatus);

    // 2. Idempotency Check: if already in the target DB status
    if (currentStatus === targetDbStatus && !options?.force) {
      // Check latest history record to ensure we do not duplicate
      const { data: latestHist } = await supabase
        .from('issue_status_history')
        .select('new_status')
        .eq('issue_id', issueId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestHist?.new_status === targetDbStatus) {
        console.log(`[IssueLifecycleService] Idempotent skip: Issue ${issue.code || issueId} is already ${targetDbStatus}`);
        return {
          success: true,
          alreadyInState: true,
          oldStatus: currentStatus,
          newStatus: targetStatus,
          dbStatus: targetDbStatus,
          issue
        };
      }
    }

    // 3. Final State Protection: Once RESOLVED or CLOSED, worker cannot overwrite unless reopened
    if ((currentStatus === 'RESOLVED' || currentStatus === 'CLOSED') && targetDbStatus !== 'REOPENED' && !options?.force) {
      console.warn(`[IssueLifecycleService] Attempted transition on finalized issue ${issue.code || issueId} (${currentStatus} -> ${targetDbStatus})`);
      return {
        success: false,
        error: `Complaint is already finalized (${currentStatus}) and cannot transition to ${targetStatus}`,
        oldStatus: currentStatus,
        newStatus: targetStatus,
        dbStatus: currentStatus,
        issue
      };
    }

    // 4. Update issues table
    const { error: updateErr } = await supabase
      .from('issues')
      .update({
        status: targetDbStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', issueId);

    if (updateErr) {
      console.error('[IssueLifecycleService] DB Update Error:', updateErr);
      return {
        success: false,
        error: updateErr.message,
        oldStatus: currentStatus,
        newStatus: targetStatus,
        dbStatus: targetDbStatus,
        issue
      };
    }

    // 5. Insert exactly ONE status history row
    const transitionNote = notes || `Status changed from ${currentStatus} to ${targetDbStatus}`;
    await supabase.from('issue_status_history').insert({
      issue_id: issueId,
      old_status: currentStatus as any,
      new_status: targetDbStatus as any,
      changed_by: actorId,
      notes: transitionNote
    });

    console.log(`[IssueLifecycleService] Transitioned issue ${issue.code || issueId}: ${currentStatus} -> ${targetDbStatus} (${transitionNote})`);

    return {
      success: true,
      alreadyInState: false,
      oldStatus: currentStatus,
      newStatus: targetStatus,
      dbStatus: targetDbStatus,
      issue: { ...issue, status: targetDbStatus }
    };
  },

  /**
   * Worker: Accept Assignment
   * ASSIGNED -> ACCEPTED
   */
  async workerAcceptAssignment(issueId: string, workerId: string, workerFullName?: string) {
    const { data: issue } = await supabase
      .from('issues')
      .select('id, code, title, status')
      .eq('id', issueId)
      .single();

    if (!issue) throw new Error('Issue not found');

    // If already ACCEPTED or IN_PROGRESS, do not duplicate or downgrade!
    if (['ACCEPTED', 'IN_PROGRESS', 'CITIZEN_VERIFICATION', 'RESOLVED', 'CLOSED'].includes(issue.status)) {
      return { success: true, alreadyAccepted: true, status: issue.status };
    }

    // Record in worker_assignments
    await supabase
      .from('worker_assignments')
      .update({ accepted_at: new Date().toISOString() })
      .eq('issue_id', issueId)
      .eq('worker_id', workerId);

    // Transition status to ACCEPTED
    const res = await this.transitionIssueStatus({
      issueId,
      targetStatus: 'ACCEPTED',
      actorId: workerId,
      notes: 'Field technician accepted assignment'
    });

    // Notify Admins
    const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'ADMIN');
    if (admins) {
      for (const admin of admins) {
        await sendNotification(
          admin.id,
          'Assignment Accepted',
          `${workerFullName || 'Field Worker'} accepted complaint ${issue.code || ''}`,
          `/admin/issues/${issueId}`
        );
      }
    }

    return res;
  },

  /**
   * Worker: Start Work
   * ACCEPTED -> IN_PROGRESS
   */
  async workerStartWork(issueId: string, workerId: string, coords?: { latitude: number; longitude: number }, workerFullName?: string) {
    const { data: issue } = await supabase
      .from('issues')
      .select('id, code, title, status')
      .eq('id', issueId)
      .single();

    if (!issue) throw new Error('Issue not found');

    // Require BEFORE photo
    const { data: beforeMedia } = await supabase
      .from('issue_media')
      .select('id')
      .eq('issue_id', issueId)
      .in('media_type', ['BEFORE', 'BEFORE_WORK', 'RESOLUTION_BEFORE']);

    if (!beforeMedia || beforeMedia.length === 0) {
      throw new Error('BEFORE work photographic evidence is required before starting work. Please upload a BEFORE photo.');
    }

    // If already in progress, handle idempotently
    if (issue.status === 'IN_PROGRESS') {
      return { success: true, alreadyInProgress: true, status: 'IN_PROGRESS' };
    }

    const locNote = coords?.latitude && coords?.longitude
      ? ` [Location: ${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}]`
      : '';

    const res = await this.transitionIssueStatus({
      issueId,
      targetStatus: 'IN_PROGRESS',
      actorId: workerId,
      notes: `Field work started by technician at the reported location.${locNote}`
    });

    // Notify Admins
    const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'ADMIN');
    if (admins) {
      for (const admin of admins) {
        await sendNotification(
          admin.id,
          'Work Started (In Progress)',
          `Technician ${workerFullName || 'Worker'} started repair on ${issue.code || ''}`,
          `/admin/issues/${issueId}`
        );
      }
    }

    return res;
  },

  /**
   * Worker: Submit Work for Verification
   * IN_PROGRESS -> COMPLETED_PENDING_REVIEW (DB: CITIZEN_VERIFICATION)
   */
  async workerSubmitForVerification(params: {
    issueId: string;
    workerId: string;
    resolutionNote: string;
    actualCost?: any;
    actualDuration?: any;
    crewSize?: any;
    materialsUsed?: any;
    aiAssessment?: any;
    workerFullName?: string;
  }) {
    const {
      issueId,
      workerId,
      resolutionNote,
      actualCost,
      actualDuration,
      crewSize,
      materialsUsed,
      aiAssessment,
      workerFullName
    } = params;

    const { data: issue } = await supabase
      .from('issues')
      .select('id, code, title, status')
      .eq('id', issueId)
      .single();

    if (!issue) throw new Error('Issue not found');

    // Verify AFTER evidence exists
    const { data: afterMedia } = await supabase
      .from('issue_media')
      .select('id')
      .eq('issue_id', issueId)
      .in('media_type', ['AFTER', 'AFTER_WORK', 'RESOLUTION_AFTER']);

    if (!afterMedia || afterMedia.length === 0) {
      throw new Error('At least one AFTER repair photo is required before submitting for verification.');
    }

    // Save Resolution Proof
    const fullProofNote = JSON.stringify({
      summary: resolutionNote,
      actual_cost: actualCost || null,
      actual_duration: actualDuration || null,
      crew_size: crewSize || null,
      materials_used: materialsUsed || null,
      ai_assessment: aiAssessment || null,
      submitted_at: new Date().toISOString()
    });

    await supabase.from('resolution_proofs').insert({
      issue_id: issueId,
      worker_id: workerId,
      resolution_note: fullProofNote
    });

    // Update assignment record finished_at
    await supabase
      .from('worker_assignments')
      .update({ finished_at: new Date().toISOString() })
      .eq('issue_id', issueId)
      .eq('worker_id', workerId);

    // Transition to CITIZEN_VERIFICATION (which represents COMPLETED_PENDING_REVIEW)
    const assessmentSummary = aiAssessment?.completionAssessment
      ? `AI Assessment: ${aiAssessment.completionAssessment} (${aiAssessment.confidence || 85}%)`
      : 'Submitted for Admin Review';

    const res = await this.transitionIssueStatus({
      issueId,
      targetStatus: 'CITIZEN_VERIFICATION',
      actorId: workerId,
      notes: `Work completion submitted for Admin verification. ${assessmentSummary}`
    });

    // Notify Admins
    const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'ADMIN');
    if (admins) {
      for (const admin of admins) {
        await sendNotification(
          admin.id,
          'Work Submitted for Verification',
          `Field technician submitted completion evidence for ${issue.code || ''}. Ready for Admin review.`,
          `/admin/issues/${issueId}`
        );
      }
    }

    return res;
  },

  /**
   * Admin: Mark Work Completed
   * COMPLETED_PENDING_REVIEW -> COMPLETED (DB: RESOLVED)
   */
  async adminMarkWorkCompleted(issueId: string, adminId: string, adminNote?: string) {
    const { data: issue } = await supabase
      .from('issues')
      .select('id, code, title, status, assigned_worker_id, reporter_id')
      .eq('id', issueId)
      .single();

    if (!issue) throw new Error('Complaint not found');

    // Validate that resolution proof exists
    const { data: proofs } = await supabase
      .from('resolution_proofs')
      .select('id')
      .eq('issue_id', issueId);

    if (!proofs || proofs.length === 0) {
      throw new Error('Cannot complete work: No worker field completion proof was submitted.');
    }

    // Validate that AFTER evidence exists
    const { data: afterPhotos } = await supabase
      .from('issue_media')
      .select('id')
      .eq('issue_id', issueId)
      .in('media_type', ['AFTER', 'AFTER_WORK', 'RESOLUTION_AFTER']);

    if (!afterPhotos || afterPhotos.length === 0) {
      throw new Error('Cannot complete work: Missing required AFTER repair photos.');
    }

    // Transition to RESOLVED (COMPLETED)
    const completionNote = adminNote?.trim()
      ? `Field work approved by Admin: ${adminNote.trim()}`
      : 'Field work approved and marked completed by Admin';

    const res = await this.transitionIssueStatus({
      issueId,
      targetStatus: 'RESOLVED',
      actorId: adminId,
      notes: completionNote
    });

    if (!res.success) {
      throw new Error(res.error || 'Failed to mark work as completed');
    }

    // 1. Finalize worker assignments finished_at
    if (issue.assigned_worker_id) {
      await supabase
        .from('worker_assignments')
        .update({ finished_at: new Date().toISOString() })
        .eq('issue_id', issueId)
        .eq('worker_id', issue.assigned_worker_id);

      // Make worker AVAILABLE
      await supabase
        .from('workers')
        .update({ status: 'AVAILABLE' })
        .eq('profile_id', issue.assigned_worker_id);
    }

    // 2. Mark SLA MET
    await supabase
      .from('sla_records')
      .update({ status: 'MET' })
      .eq('issue_id', issueId);

    // 3. Notify Worker: "Work for complaint CC-001013 has been marked completed by Admin."
    if (issue.assigned_worker_id) {
      await sendNotification(
        issue.assigned_worker_id,
        'Work Completed & Approved',
        `Work for complaint ${issue.code || ''} has been marked completed by Admin.`,
        `/worker/dashboard`
      );
    }

    // 4. Notify Citizen: "Your complaint CC-001013 has been resolved."
    if (issue.reporter_id) {
      await sendNotification(
        issue.reporter_id,
        'Complaint Resolved!',
        `Your complaint ${issue.code || ''} has been resolved and approved by the municipal administration.`,
        `/track`
      );
    }

    return res;
  },

  /**
   * Admin: Request Rework
   * COMPLETED_PENDING_REVIEW -> IN_PROGRESS (with rework reason)
   */
  async adminRequestRework(issueId: string, adminId: string, reworkReason: string) {
    if (!reworkReason?.trim()) {
      throw new Error('Rework reason is required.');
    }

    const { data: issue } = await supabase
      .from('issues')
      .select('id, code, title, status, assigned_worker_id')
      .eq('id', issueId)
      .single();

    if (!issue) throw new Error('Complaint not found');

    const res = await this.transitionIssueStatus({
      issueId,
      targetStatus: 'IN_PROGRESS',
      actorId: adminId,
      notes: `Rework requested by Admin: ${reworkReason.trim()}`,
      options: { force: true }
    });

    // Reset finished_at so worker can resume work
    if (issue.assigned_worker_id) {
      await supabase
        .from('worker_assignments')
        .update({ finished_at: null })
        .eq('issue_id', issueId)
        .eq('worker_id', issue.assigned_worker_id);

      // Notify Worker
      const { data: activeAssign } = await supabase
        .from('worker_assignments')
        .select('id')
        .eq('issue_id', issueId)
        .eq('worker_id', issue.assigned_worker_id)
        .order('assigned_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const taskLink = activeAssign?.id ? `/worker/tasks/${activeAssign.id}` : `/worker/tasks/${issueId}`;
      await sendNotification(
        issue.assigned_worker_id,
        'Rework Required',
        `The administrator requested rework on complaint ${issue.code || ''}: "${reworkReason.trim()}". Please resume work and resubmit.`,
        taskLink
      );
    }

    return res;
  },

  /**
   * Admin: Request More Evidence
   */
  async adminRequestEvidence(params: {
    issueId: string;
    adminId: string;
    reason: string;
    requestedEvidence?: string;
    adminNote?: string;
  }) {
    const { issueId, adminId, reason, requestedEvidence, adminNote } = params;
    if (!reason?.trim()) throw new Error('Evidence request reason is required.');

    const { data: issue } = await supabase
      .from('issues')
      .select('id, code, title, status, assigned_worker_id')
      .eq('id', issueId)
      .single();

    if (!issue) throw new Error('Complaint not found');

    const noteText = `Evidence Required by Admin: ${reason.trim()}. Requested: ${requestedEvidence || 'Additional field photos'}. ${adminNote ? `Note: ${adminNote}` : ''}`;

    // Status remains in review/pending verification (CITIZEN_VERIFICATION) or transitions
    const res = await this.transitionIssueStatus({
      issueId,
      targetStatus: 'CITIZEN_VERIFICATION',
      actorId: adminId,
      notes: noteText,
      options: { force: true }
    });

    if (issue.assigned_worker_id) {
      const { data: activeAssign } = await supabase
        .from('worker_assignments')
        .select('id')
        .eq('issue_id', issueId)
        .eq('worker_id', issue.assigned_worker_id)
        .order('assigned_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const taskLink = activeAssign?.id ? `/worker/tasks/${activeAssign.id}` : `/worker/tasks/${issueId}`;
      await sendNotification(
        issue.assigned_worker_id,
        'Additional Evidence Requested',
        `Admin requested additional proof for ${issue.code || ''}: "${reason.trim()}".`,
        taskLink
      );
    }

    return res;
  }
};
