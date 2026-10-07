import { supabase } from '../lib/supabase';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return {
    'Authorization': `Bearer ${session.access_token}`
  };
}

export interface InformationRequest {
  id: string;
  issue_id: string;
  requested_by: string;
  citizen_id: string;
  message: string;
  request_type: string;
  status: 'PENDING' | 'RESPONDED' | 'CLOSED';
  created_at: string;
  responded_at?: string | null;
  closed_at?: string | null;
  issue?: {
    id: string;
    code: string;
    title: string;
    description: string;
    status: string;
    category?: string;
  };
  response?: {
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
  } | null;
}

export const citizenApi = {
  /**
   * Fetch active (PENDING) information requests for the authenticated citizen
   */
  async getMyPendingRequests(): Promise<InformationRequest[]> {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/issues/my-pending-requests`, { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch pending requests');
    }
    const data = await res.json();
    return data.requests || [];
  },

  /**
   * Fetch all information requests & responses for a specific issue
   */
  async getIssueInformationRequests(issueId: string): Promise<InformationRequest[]> {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = {};
    if (session) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }
    const res = await fetch(`${API_BASE}/issues/${issueId}/information-requests`, { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to fetch issue requests');
    }
    const data = await res.json();
    return data.requests || [];
  },

  /**
   * Submit citizen response with optional evidence attachment
   */
  async submitAdditionalInformation(params: {
    issueId: string;
    requestId: string;
    responseText: string;
    file?: File | null;
  }) {
    const headers = await authHeaders();
    const formData = new FormData();
    formData.append('request_id', params.requestId);
    formData.append('response_text', params.responseText.trim());
    if (params.file) {
      formData.append('image', params.file);
    }

    const res = await fetch(`${API_BASE}/issues/${params.issueId}/respond-info`, {
      method: 'POST',
      headers,
      body: formData
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to submit additional information');
    }

    return res.json();
  }
};
