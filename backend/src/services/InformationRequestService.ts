import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import ws from 'ws';
import crypto from 'crypto';

dotenv.config();

globalThis.WebSocket = ws as any;

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SECRET_KEY || '',
  { auth: { persistSession: false } }
);

export type RequestStatus = 'PENDING' | 'RESPONDED' | 'CLOSED';

export interface InformationRequestRecord {
  id: string;
  issue_id: string;
  requested_by: string;
  citizen_id: string;
  message: string;
  request_type: string;
  status: RequestStatus;
  created_at: string;
  responded_at?: string | null;
  closed_at?: string | null;
  issue?: {
    id: string;
    code: string;
    title: string;
    description: string;
    status: string;
  };
  response?: InformationResponseRecord | null;
}

export interface InformationResponseRecord {
  id: string;
  request_id: string;
  issue_id: string;
  citizen_id: string;
  message: string;
  media_id?: string | null;
  media?: {
    id: string;
    storage_path: string;
    media_type: string;
    created_at: string;
  } | null;
  created_at: string;
  updated_at?: string;
}

// Cached check for whether dedicated tables exist in Supabase
let dedicatedTablesAvailable: boolean | null = null;

async function checkDedicatedTables(): Promise<boolean> {
  if (dedicatedTablesAvailable !== null) return dedicatedTablesAvailable;
  try {
    const { error } = await supabase.from('issue_information_requests').select('id').limit(1);
    dedicatedTablesAvailable = !error;
    return dedicatedTablesAvailable;
  } catch {
    dedicatedTablesAvailable = false;
    return false;
  }
}

export const InformationRequestService = {
  /**
   * Admin creates a new persistent Information Request for an issue
   */
  async createRequest(params: {
    issueId: string;
    requestedBy: string;
    citizenId: string;
    message: string;
    requestType?: string;
  }): Promise<InformationRequestRecord> {
    const { issueId, requestedBy, citizenId, message, requestType = 'GENERAL_CLARIFICATION' } = params;
    const requestId = crypto.randomUUID();
    const now = new Date().toISOString();

    const hasDedicated = await checkDedicatedTables();

    if (hasDedicated) {
      const { data, error } = await supabase
        .from('issue_information_requests')
        .insert({
          id: requestId,
          issue_id: issueId,
          requested_by: requestedBy,
          citizen_id: citizenId,
          message,
          request_type: requestType,
          status: 'PENDING',
          created_at: now
        })
        .select()
        .single();

      if (error) throw new Error(`Failed to insert into issue_information_requests: ${error.message}`);
      return data;
    }

    // Underlying persistent fallback using issue_comments
    const payload = {
      kind: 'INFORMATION_REQUEST',
      id: requestId,
      issue_id: issueId,
      requested_by: requestedBy,
      citizen_id: citizenId,
      message,
      request_type: requestType,
      status: 'PENDING',
      created_at: now,
      responded_at: null,
      closed_at: null
    };

    const { error: commentErr } = await supabase
      .from('issue_comments')
      .insert({
        id: requestId,
        issue_id: issueId,
        author_id: requestedBy,
        body: JSON.stringify(payload),
        created_at: now
      });

    if (commentErr) {
      throw new Error(`Failed to store information request persistently: ${commentErr.message}`);
    }

    return payload as InformationRequestRecord;
  },

  /**
   * Get a request by its unique ID
   */
  async getRequestById(requestId: string): Promise<InformationRequestRecord | null> {
    const hasDedicated = await checkDedicatedTables();

    if (hasDedicated) {
      const { data, error } = await supabase
        .from('issue_information_requests')
        .select('*, issues(id, code, title, description, status)')
        .eq('id', requestId)
        .maybeSingle();

      if (error || !data) return null;

      // Also get response if any
      const { data: resp } = await supabase
        .from('issue_information_responses')
        .select('*, issue_media(*)')
        .eq('request_id', requestId)
        .maybeSingle();

      return {
        ...data,
        issue: data.issues,
        response: resp ? {
          ...resp,
          media: resp.issue_media
        } : null
      };
    }

    // Fallback via issue_comments
    const { data: comment } = await supabase
      .from('issue_comments')
      .select('*')
      .eq('id', requestId)
      .maybeSingle();

    if (!comment) return null;

    try {
      const parsed = JSON.parse(comment.body);
      if (parsed.kind !== 'INFORMATION_REQUEST') return null;

      // Attach issue details
      const { data: issue } = await supabase
        .from('issues')
        .select('id, code, title, description, status')
        .eq('id', parsed.issue_id)
        .single();

      // Find response if exists
      const { data: responses } = await supabase
        .from('issue_comments')
        .select('*')
        .eq('issue_id', parsed.issue_id);

      let responseRecord: InformationResponseRecord | null = null;
      if (responses) {
        for (const r of responses) {
          try {
            const rParsed = JSON.parse(r.body);
            if (rParsed.kind === 'INFORMATION_RESPONSE' && rParsed.request_id === requestId) {
              responseRecord = rParsed;
              if (rParsed.media_id) {
                const { data: media } = await supabase
                  .from('issue_media')
                  .select('*')
                  .eq('id', rParsed.media_id)
                  .single();
                if (media) responseRecord!.media = media;
              }
              break;
            }
          } catch {}
        }
      }

      return {
        ...parsed,
        issue: issue || undefined,
        response: responseRecord
      };
    } catch {
      return null;
    }
  },

  /**
   * Get all requests for a specific issue (history of requests & citizen responses)
   */
  async getRequestsForIssue(issueId: string): Promise<InformationRequestRecord[]> {
    const hasDedicated = await checkDedicatedTables();

    if (hasDedicated) {
      const { data, error } = await supabase
        .from('issue_information_requests')
        .select('*')
        .eq('issue_id', issueId)
        .order('created_at', { ascending: false });

      if (error || !data) return [];

      const results: InformationRequestRecord[] = [];
      for (const req of data) {
        const { data: resp } = await supabase
          .from('issue_information_responses')
          .select('*, issue_media(*)')
          .eq('request_id', req.id)
          .maybeSingle();

        results.push({
          ...req,
          response: resp ? { ...resp, media: resp.issue_media } : null
        });
      }
      return results;
    }

    // Fallback via issue_comments
    const { data: rows } = await supabase
      .from('issue_comments')
      .select('*')
      .eq('issue_id', issueId)
      .order('created_at', { ascending: false });

    if (!rows) return [];

    const requestMap = new Map<string, InformationRequestRecord>();
    const responseMap = new Map<string, InformationResponseRecord>();

    for (const r of rows) {
      try {
        const parsed = JSON.parse(r.body);
        if (parsed.kind === 'INFORMATION_REQUEST') {
          requestMap.set(parsed.id, parsed);
        } else if (parsed.kind === 'INFORMATION_RESPONSE') {
          responseMap.set(parsed.request_id, parsed);
        }
      } catch {}
    }

    const results: InformationRequestRecord[] = [];
    for (const [id, req] of requestMap.entries()) {
      const resp = responseMap.get(id);
      if (resp && resp.media_id && !resp.media) {
        const { data: media } = await supabase
          .from('issue_media')
          .select('*')
          .eq('id', resp.media_id)
          .maybeSingle();
        if (media) resp.media = media;
      }
      results.push({
        ...req,
        response: resp || null
      });
    }

    return results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  /**
   * Get active (PENDING) requests for a citizen across all their complaints
   */
  async getActiveRequestsForCitizen(citizenId: string): Promise<InformationRequestRecord[]> {
    const hasDedicated = await checkDedicatedTables();

    if (hasDedicated) {
      const { data, error } = await supabase
        .from('issue_information_requests')
        .select('*, issues(id, code, title, description, status, category)')
        .eq('citizen_id', citizenId)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false });

      if (error || !data) return [];
      return data.map((d: any) => ({
        ...d,
        issue: d.issues
      }));
    }

    // Fallback: Find all issues reported by this citizen first
    const { data: userIssues } = await supabase
      .from('issues')
      .select('id, code, title, description, status, category')
      .eq('reporter_id', citizenId);

    if (!userIssues || userIssues.length === 0) return [];

    const issueIds = userIssues.map(i => i.id);
    const { data: comments } = await supabase
      .from('issue_comments')
      .select('*')
      .in('issue_id', issueIds)
      .order('created_at', { ascending: false });

    if (!comments) return [];

    const activeRequests: InformationRequestRecord[] = [];
    const issueMap = new Map(userIssues.map(i => [i.id, i]));

    for (const c of comments) {
      try {
        const parsed = JSON.parse(c.body);
        if (parsed.kind === 'INFORMATION_REQUEST' && parsed.status === 'PENDING') {
          activeRequests.push({
            ...parsed,
            issue: issueMap.get(parsed.issue_id)
          });
        }
      } catch {}
    }

    return activeRequests.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  /**
   * Citizen submits response to an Information Request
   */
  async submitResponse(params: {
    requestId: string;
    issueId: string;
    citizenId: string;
    message: string;
    mediaId?: string;
    mediaStoragePath?: string;
  }): Promise<{ request: InformationRequestRecord; response: InformationResponseRecord }> {
    const { requestId, issueId, citizenId, message, mediaId } = params;
    const now = new Date().toISOString();
    const responseId = crypto.randomUUID();

    // Verify request
    const existingRequest = await this.getRequestById(requestId);
    if (!existingRequest) {
      throw new Error('Information request not found.');
    }

    if (existingRequest.issue_id !== issueId) {
      throw new Error('Request does not match this complaint.');
    }

    if (existingRequest.citizen_id !== citizenId) {
      throw new Error('Unauthorized: You are not the citizen requested for this information.');
    }

    if (existingRequest.status === 'RESPONDED') {
      throw new Error('This request has already been responded to.');
    }

    if (existingRequest.status === 'CLOSED') {
      throw new Error('This request is closed and no longer accepting responses.');
    }

    const hasDedicated = await checkDedicatedTables();

    if (hasDedicated) {
      // 1. Insert response
      const { data: resp, error: respErr } = await supabase
        .from('issue_information_responses')
        .insert({
          id: responseId,
          request_id: requestId,
          issue_id: issueId,
          citizen_id: citizenId,
          message,
          media_id: mediaId || null,
          created_at: now,
          updated_at: now
        })
        .select()
        .single();

      if (respErr) throw new Error(`Failed to save response: ${respErr.message}`);

      // 2. Update request status to RESPONDED
      const { data: updatedReq, error: reqErr } = await supabase
        .from('issue_information_requests')
        .update({
          status: 'RESPONDED',
          responded_at: now
        })
        .eq('id', requestId)
        .select()
        .single();

      if (reqErr) throw new Error(`Failed to update request status: ${reqErr.message}`);

      return {
        request: updatedReq,
        response: resp
      };
    }

    // Fallback via issue_comments
    const responsePayload: InformationResponseRecord = {
      id: responseId,
      request_id: requestId,
      issue_id: issueId,
      citizen_id: citizenId,
      message,
      media_id: mediaId || null,
      created_at: now,
      updated_at: now
    };

    // Save response record
    const { error: respErr } = await supabase
      .from('issue_comments')
      .insert({
        id: responseId,
        issue_id: issueId,
        author_id: citizenId,
        body: JSON.stringify({ kind: 'INFORMATION_RESPONSE', ...responsePayload }),
        created_at: now
      });

    if (respErr) throw new Error(`Failed to save citizen response: ${respErr.message}`);

    // Update request record body to status = 'RESPONDED'
    const updatedRequestPayload: InformationRequestRecord = {
      ...existingRequest,
      status: 'RESPONDED',
      responded_at: now
    };

    await supabase
      .from('issue_comments')
      .update({
        body: JSON.stringify({ kind: 'INFORMATION_REQUEST', ...updatedRequestPayload })
      })
      .eq('id', requestId);

    return {
      request: updatedRequestPayload,
      response: responsePayload
    };
  },

  /**
   * Admin closes an Information Request
   */
  async closeRequest(requestId: string, _adminId: string): Promise<InformationRequestRecord> {
    const existing = await this.getRequestById(requestId);
    if (!existing) throw new Error('Request not found');

    const now = new Date().toISOString();
    const hasDedicated = await checkDedicatedTables();

    if (hasDedicated) {
      const { data, error } = await supabase
        .from('issue_information_requests')
        .update({ status: 'CLOSED', closed_at: now })
        .eq('id', requestId)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const updated = {
      ...existing,
      status: 'CLOSED' as RequestStatus,
      closed_at: now
    };

    await supabase
      .from('issue_comments')
      .update({
        body: JSON.stringify({ kind: 'INFORMATION_REQUEST', ...updated })
      })
      .eq('id', requestId);

    return updated;
  },

  /**
   * Get all issue IDs that currently have a PENDING information request
   */
  async getPendingIssueIds(): Promise<string[]> {
    const hasDedicated = await checkDedicatedTables();
    if (hasDedicated) {
      const { data, error } = await supabase
        .from('issue_information_requests')
        .select('issue_id')
        .eq('status', 'PENDING');
      if (error || !data) return [];
      return Array.from(new Set(data.map((d: any) => d.issue_id)));
    }

    const { data: rows } = await supabase
      .from('issue_comments')
      .select('body, issue_id')
      .order('created_at', { ascending: false });

    if (!rows) return [];
    const pendingIds = new Set<string>();
    for (const r of rows) {
      try {
        const parsed = JSON.parse(r.body);
        if (parsed.kind === 'INFORMATION_REQUEST' && parsed.status === 'PENDING') {
          pendingIds.add(parsed.issue_id);
        }
      } catch {}
    }
    return Array.from(pendingIds);
  }
};

