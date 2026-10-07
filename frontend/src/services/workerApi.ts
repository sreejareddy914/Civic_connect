import { supabase } from '../lib/supabase';

const API_BASE = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL}/worker` 
  : 'http://localhost:3000/api/worker';

async function authHeaders(isFormData = false) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const headers: Record<string, string> = {};
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const workerApi = {
  // Worker Profile
  async getProfile() {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/profile`, { headers });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to load worker profile');
    return res.json();
  },

  async updateAvailability(status: 'AVAILABLE' | 'BUSY' | 'ON_LEAVE' | 'INACTIVE') {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/availability`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status })
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to update availability');
    return res.json();
  },

  // Dashboard & KPIs
  async getDashboard() {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/dashboard`, { headers });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to load dashboard data');
    return res.json();
  },

  // My Assignments
  async getAssignments(params: Record<string, string | undefined> = {}) {
    const headers = await authHeaders();
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== 'ALL' && v !== '') query.append(k, String(v));
    });
    const res = await fetch(`${API_BASE}/assignments?${query.toString()}`, { headers });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to load assignments');
    return res.json();
  },

  async getAssignment(id: string, coords?: { latitude: number; longitude: number }) {
    if (!id || id === 'undefined' || id === 'null') {
      throw new Error('Invalid assignment ID provided.');
    }
    const headers = await authHeaders();
    const query = new URLSearchParams();
    if (coords?.latitude && coords?.longitude) {
      query.append('lat', String(coords.latitude));
      query.append('lng', String(coords.longitude));
    }
    
    let res: Response;
    try {
      res = await fetch(`${API_BASE}/assignments/${encodeURIComponent(id.trim())}?${query.toString()}`, { headers });
    } catch {
      throw new Error('Unable to connect to the server. Please check your network connection.');
    }

    if (!res.ok) {
      let serverError = '';
      try {
        const data = await res.json();
        serverError = data?.error;
      } catch {}

      if (res.status === 404) {
        throw new Error(serverError || 'Assignment not found. It may have been removed or reassigned.');
      } else if (res.status === 403) {
        throw new Error(serverError || 'You are not authorized to access this assignment.');
      } else if (res.status >= 500) {
        throw new Error(serverError || 'Unable to load assignment. Please try again.');
      }
      throw new Error(serverError || 'Failed to load assignment details.');
    }
    return res.json();
  },

  // Accept Assignment
  async acceptAssignment(id: string) {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/assignments/${encodeURIComponent(id.trim())}/accept`, {
      method: 'POST',
      headers
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to accept assignment');
    }
    return res.json();
  },

  // GPS Location Check (Server-side Haversine verification)
  async checkLocation(id: string, latitude: number, longitude: number) {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/assignments/${encodeURIComponent(id.trim())}/location-check`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ latitude, longitude })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to verify location');
    }
    return res.json();
  },

  // Start Work (Requires BEFORE photo)
  async startWork(id: string, coords?: { latitude?: number; longitude?: number }) {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/assignments/${encodeURIComponent(id.trim())}/start`, {
      method: 'POST',
      headers,
      body: JSON.stringify(coords || {})
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to start work');
    }
    return res.json();
  },

  // Upload Field Evidence (BEFORE, PROGRESS, AFTER)
  async uploadEvidence(id: string, formData: FormData) {
    const headers = await authHeaders(true);
    const res = await fetch(`${API_BASE}/assignments/${encodeURIComponent(id.trim())}/evidence`, {
      method: 'POST',
      headers,
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to upload evidence');
    }
    return res.json();
  },

  // Record Field Notes & Resource Usage
  async recordNotes(id: string, data: {
    observation?: string;
    work_performed?: string;
    materials_used?: string;
    equipment_used?: string;
    crew_size?: number;
    actual_duration?: string;
  }) {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/assignments/${encodeURIComponent(id.trim())}/notes`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to record field notes');
    }
    return res.json();
  },

  // Submit Work for Verification (Enforces AFTER evidence & Gemini check)
  async submitCompletion(id: string, formData: FormData) {
    const headers = await authHeaders(true);
    const res = await fetch(`${API_BASE}/assignments/${encodeURIComponent(id.trim())}/complete`, {
      method: 'POST',
      headers,
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to submit work completion');
    }
    return res.json();
  },

  // Request Assistance
  async requestAssistance(id: string, data: {
    reason: string;
    description: string;
    latitude?: number;
    longitude?: number;
  }) {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/assignments/${encodeURIComponent(id.trim())}/request-assistance`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to request assistance');
    }
    return res.json();
  },

  // Unable to Complete
  async reportUnableToComplete(id: string, data: {
    reason: string;
    note: string;
    latitude?: number;
    longitude?: number;
  }) {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/assignments/${encodeURIComponent(id.trim())}/unable-to-complete`, {
      method: 'POST',
      headers,
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to report unable to complete');
    }
    return res.json();
  },

  // Performance Dashboard
  async getPerformance() {
    const headers = await authHeaders();
    const res = await fetch(`${API_BASE}/performance`, { headers });
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to load performance metrics');
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
    if (!res.ok) throw new Error((await res.json()).error || 'Failed to mark notification as read');
    return res.json();
  }
};
