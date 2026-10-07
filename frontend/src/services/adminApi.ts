import { supabase } from '../lib/supabase';

const API_BASE = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL}/admin` 
  : 'http://localhost:3000/api/admin';

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

export const adminApi = {
  // Dashboard
  async getDashboard() {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/dashboard`, { headers });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to load dashboard');
    return res.json();
  },

  // Issues
  async getIssues(params: Record<string, string | number | undefined> = {}) {
    const headers = await authHeaders();
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== 'ALL' && v !== '') query.append(k, String(v));
    });
    const res = await fetch(`${API_BASE}/issues?${query.toString()}`, { headers });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to load issues');
    return res.json();
  },

  async getIssue(id: string) {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/issues/${id}`, { headers });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to load issue');
    return res.json();
  },

  async verifyIssue(id: string, notes?: string) {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/issues/${id}/verify`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ notes })
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to verify issue');
    return res.json();
  },

  async rejectIssue(id: string, reason: string, notes?: string) {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/issues/${id}/reject`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reason, notes })
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to reject issue');
    return res.json();
  },

  async requestMoreInfo(id: string, request_message: string, request_type: string = 'GENERAL_CLARIFICATION') {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/issues/${id}/request-info`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ request_message, request_type })
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to request more info');
    return res.json();
  },

  async getInformationRequests(id: string) {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/issues/${id}/information-requests`, {
      headers
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to fetch information requests');
    return res.json();
  },

  async closeInformationRequest(id: string, requestId: string) {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/issues/${id}/information-requests/${requestId}/close`, {
      method: 'POST',
      headers
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to close information request');
    return res.json();
  },

  async applyOverride(id: string, payload: any) {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/issues/${id}/override`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to save overrides');
    return res.json();
  },

  async assignWorker(id: string, worker_id: string, department_id?: string, notes?: string) {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/issues/${id}/assign`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ worker_id, department_id, notes })
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to assign worker');
    return res.json();
  },

  async reassignWorker(id: string, worker_id: string, department_id?: string, reason?: string) {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/issues/${id}/reassign`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ worker_id, department_id, reason })
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to reassign worker');
    return res.json();
  },

  async approveResolution(id: string, notes?: string) {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/issues/${id}/approve-resolution`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ notes })
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to approve resolution');
    return res.json();
  },

  async markWorkCompleted(id: string, notes?: string) {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/issues/${id}/complete-work`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ notes })
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to mark work completed');
    return res.json();
  },

  async requestRework(id: string, rework_reason: string) {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/issues/${id}/rework`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ rework_reason })
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to request rework');
    return res.json();
  },

  async requestEvidence(id: string, reason: string, requested_evidence?: string, admin_note?: string) {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/issues/${id}/request-evidence`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ reason, requested_evidence, admin_note })
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to request evidence');
    return res.json();
  },

  async markDuplicate(id: string, original_issue_id: string, reason?: string) {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/issues/${id}/mark-duplicate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ original_issue_id, reason })
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to mark duplicate');
    return res.json();
  },

  // Workers
  async getWorkers() {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/workers`, { headers });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to load workers');
    return res.json();
  },

  async createWorker(data: any) {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/workers`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to create worker');
    return res.json();
  },

  async updateWorker(id: string, data: any) {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/workers/${id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to update worker');
    return res.json();
  },

  // Departments
  async getDepartments() {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/departments`, { headers });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to load departments');
    return res.json();
  },

  async createDepartment(data: any) {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/departments`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to create department');
    return res.json();
  },

  // SLA
  async getSLA() {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/sla`, { headers });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to load SLA');
    return res.json();
  },

  // Analytics
  async getAnalytics() {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/analytics`, { headers });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to load analytics');
    return res.json();
  },

  // Hotspots & AI
  async getHotspots() {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/hotspots`, { headers });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to load hotspots');
    return res.json();
  },

  async getAIPredictions() {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/ai-predictions`, { headers });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to load AI predictions');
    return res.json();
  },

  // Notifications
  async getNotifications() {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/notifications`, { headers });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to load notifications');
    return res.json();
  },

  async markNotificationRead(id: string) {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
      method: 'PATCH',
      headers
    });
    return res.json();
  },

  async markAllNotificationsRead() {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/notifications/read-all`, {
      method: 'POST',
      headers
    });
    return res.json();
  },

  // Settings
  async getSettings() {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/settings`, { headers });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to load settings');
    return res.json();
  },

  async updateSettings(settings: any) {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'POST',
      headers,
      body: JSON.stringify(settings)
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to update settings');
    return res.json();
  }
};
