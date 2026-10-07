export interface DepartmentStats {
  totalWorkers: number;
  activeWorkers: number;
  inactiveWorkers?: number;
  availableWorkers?: number;
  busyWorkers?: number;
  total?: number;
  totalAssignedTasks?: number;
  pending?: number;
  assigned?: number;
  accepted?: number;
  inProgress?: number;
  citizenVerification?: number;
  resolved?: number;
  closed?: number;
  reopened?: number;
  critical?: number;
  compliance?: number;
  completionRate?: number;
}

export interface Department {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  totalWorkers?: number;
  activeWorkers?: number;
  inactiveWorkers?: number;
  stats?: DepartmentStats;
}

export interface DepartmentWorker {
  profile_id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  status: 'AVAILABLE' | 'BUSY' | 'OFF_DUTY';
  created_at: string;
  activeTasks: number;
  completedTasks: number;
  performanceScore: number;
}

export interface DepartmentTask {
  id: string;
  code: string;
  title: string;
  description: string;
  category?: string;
  subcategory?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: string;
  department_id: string;
  assigned_worker_id: string | null;
  worker_name?: string | null;
  latitude?: number;
  longitude?: number;
  address?: string | null;
  created_at: string;
  updated_at: string;
  sla?: {
    allowedHours: number;
    deadline: string;
    remainingHours: number;
    remainingMs: number;
    status: 'ON_TRACK' | 'DUE_SOON' | 'BREACHED' | 'RESOLVED_WITHIN_SLA' | 'RESOLVED_AFTER_SLA';
  };
}

export interface DepartmentSLA {
  complianceRate: number;
  onTrack: number;
  dueSoon: number;
  breached: number;
  resolvedWithin: number;
  resolvedAfter: number;
}

export interface DepartmentAnalytics {
  byStatus: Record<string, number>;
  bySeverity: Record<string, number>;
  completionRate: number;
  slaCompliance: number;
  recentTrend: {
    date: string;
    reported: number;
    resolved: number;
  }[];
}

export interface DepartmentDetailsResponse {
  department: Department;
  statistics: DepartmentStats;
  workers: DepartmentWorker[];
  recentTasks: DepartmentTask[];
  sla: DepartmentSLA;
  analytics: DepartmentAnalytics;
}
