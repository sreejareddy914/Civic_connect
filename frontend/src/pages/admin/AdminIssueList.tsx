import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { 
  Loader2, 
  Search, 
  Filter, 
  Download, 
  X, 
  Clock, 
  User,
  Building2,
  RefreshCw
} from 'lucide-react';
import { adminApi } from '../../services/adminApi';

export default function AdminIssueList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queueParam = searchParams.get('queue') || '';
  const statusParam = searchParams.get('status') || 'ALL';

  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(statusParam);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState(searchParams.get('severity') || 'ALL');
  const [slaFilter, setSlaFilter] = useState('ALL');

  useEffect(() => {
    fetchIssues();
  }, [queueParam, statusFilter, categoryFilter, severityFilter, slaFilter]);

  const fetchIssues = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (queueParam) params.queue = queueParam;
      else if (statusFilter !== 'ALL') params.status = statusFilter;
      if (categoryFilter !== 'ALL') params.category = categoryFilter;
      if (severityFilter !== 'ALL') params.severity = severityFilter;
      if (slaFilter !== 'ALL') params.sla_status = slaFilter;
      if (search.trim()) params.search = search.trim();

      const res = await adminApi.getIssues(params);
      setIssues(res.issues || []);
    } catch (error) {
      console.error('Error fetching admin issues:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchIssues();
  };

  const clearFilters = () => {
    setSearchParams({});
    setStatusFilter('ALL');
    setCategoryFilter('ALL');
    setSeverityFilter('ALL');
    setSlaFilter('ALL');
    setSearch('');
  };

  const exportCSV = () => {
    if (issues.length === 0) return alert('No issues to export');
    
    const headers = ['Complaint ID', 'Date', 'Title', 'Category', 'Severity', 'Priority', 'Status', 'Reporter', 'Department', 'Worker', 'SLA Status', 'Address'];
    const rows = issues.map(i => [
      i.code || i.id,
      new Date(i.created_at).toLocaleDateString(),
      `"${(i.title || '').replace(/"/g, '""')}"`,
      i.category || 'N/A',
      i.severity || 'N/A',
      i.priority || 'N/A',
      i.status,
      `"${(i.reporter?.full_name || 'Anonymous').replace(/"/g, '""')}"`,
      `"${(i.department?.name || 'Unassigned').replace(/"/g, '""')}"`,
      `"${(i.assigned_worker?.full_name || 'Unassigned').replace(/"/g, '""')}"`,
      i.sla?.status || 'N/A',
      `"${(i.address || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CivicAdmin_Issues_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-200 text-gray-800 uppercase tracking-wider">
              {queueParam ? `Queue: ${queueParam.replace('_', ' ')}` : 'Directory'}
            </span>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Issue Management</h1>
          <p className="text-gray-500 text-sm mt-0.5">Review, verify, moderate, assign, and track all municipal civic reports.</p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={exportCSV}
            className="flex items-center px-4 py-2.5 bg-white text-gray-700 border border-gray-200 rounded-xl text-xs font-semibold hover:bg-gray-50 transition-colors shadow-sm"
          >
            <Download className="h-4 w-4 mr-2 text-gray-500" /> Export CSV
          </button>
          <button 
            onClick={fetchIssues}
            className="p-2.5 bg-white text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors shadow-sm"
            title="Refresh issues"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 mb-6 space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
              type="text" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ID, title, description, citizen, area, or category..." 
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all"
            />
          </div>
          <button 
            type="submit"
            className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-xs font-bold hover:bg-gray-800 transition-colors"
          >
            Search
          </button>
        </form>

        {/* Filter Dropdowns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 pt-3 border-t border-gray-100 items-center">
          {/* Status */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setSearchParams({});
              }}
              className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-lg text-gray-700 font-medium focus:ring-red-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="REPORTED">Needs Verification (Reported)</option>
              <option value="MORE_INFO_REQUIRED">More Info Required</option>
              <option value="VERIFIED">Verified / Ready</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="CITIZEN_VERIFICATION">Resolution Approval</option>
              <option value="RESOLVED">Resolved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {/* Severity */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Severity</label>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-lg text-gray-700 font-medium focus:ring-red-500"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          {/* Category */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Category</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-lg text-gray-700 font-medium focus:ring-red-500"
            >
              <option value="ALL">All Categories</option>
              <option value="Roads">Roads & Potholes</option>
              <option value="Lighting">Street Lighting</option>
              <option value="Water">Water Supply</option>
              <option value="Sanitation">Sanitation</option>
              <option value="Drainage">Drainage</option>
              <option value="Traffic">Traffic</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* SLA Status */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">SLA Status</label>
            <select
              value={slaFilter}
              onChange={(e) => setSlaFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-lg text-gray-700 font-medium focus:ring-red-500"
            >
              <option value="ALL">All SLAs</option>
              <option value="ON_TRACK">On Track</option>
              <option value="DUE_SOON">Due Soon</option>
              <option value="BREACHED">Breached</option>
              <option value="RESOLVED_WITHIN_SLA">Resolved Within SLA</option>
              <option value="RESOLVED_AFTER_SLA">Resolved After SLA</option>
            </select>
          </div>

          {/* Clear Filters */}
          <div className="flex items-end">
            <button
              onClick={clearFilters}
              type="button"
              className="w-full py-2 px-3 text-xs font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg border border-dashed border-gray-300 transition-colors flex items-center justify-center gap-1"
            >
              <X className="h-3.5 w-3.5" /> Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Issues Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex flex-col justify-center items-center py-24">
            <Loader2 className="animate-spin h-8 w-8 text-red-500 mb-2" />
            <p className="text-xs text-gray-400">Loading complaints...</p>
          </div>
        ) : issues.length === 0 ? (
          <div className="p-16 text-center text-gray-500">
            <Filter className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="font-semibold text-gray-700">No matching issues found</p>
            <p className="text-xs text-gray-400 mt-1">Try adjusting your filters or search keywords.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">ID / Date</th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Complaint</th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Citizen</th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Category / Severity</th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Worker / Dept</th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">SLA</th>
                  <th className="px-6 py-4 text-right text-[11px] font-bold text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {issues.map((issue) => (
                  <tr key={issue.id} className="hover:bg-gray-50/80 transition-colors">
                    {/* Code & Date */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs font-mono font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded inline-block">
                        {issue.code || 'CC-0000'}
                      </div>
                      <div className="text-[11px] text-gray-400 mt-1">
                        {new Date(issue.created_at).toLocaleDateString()}
                      </div>
                    </td>

                    {/* Title & Description */}
                    <td className="px-6 py-4 max-w-xs">
                      <div className="text-sm font-bold text-gray-900 line-clamp-1">{issue.title}</div>
                      <div className="text-xs text-gray-500 line-clamp-1 mt-0.5">{issue.description}</div>
                      {issue.address && (
                        <div className="text-[11px] text-gray-400 truncate mt-0.5">📍 {issue.address}</div>
                      )}
                    </td>

                    {/* Reporter Citizen */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs text-gray-800 font-medium">
                        <User className="h-3.5 w-3.5 text-gray-400" />
                        <span>{issue.reporter?.full_name || 'Citizen'}</span>
                      </div>
                    </td>

                    {/* Category & Severity */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-xs font-medium text-gray-800">{issue.category || 'Roads'}</span>
                      <div className="mt-0.5">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                          issue.severity === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                          issue.severity === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                          issue.severity === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {issue.severity || 'Normal'}
                        </span>
                      </div>
                    </td>

                    {/* Worker / Dept */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-xs text-gray-800 font-medium">
                        {issue.assigned_worker ? (
                          <span className="text-indigo-600 font-semibold">{issue.assigned_worker.full_name}</span>
                        ) : (
                          <span className="text-gray-400 italic">Unassigned</span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                        <Building2 className="h-3 w-3" />
                        <span>{issue.department?.name || 'General Dept'}</span>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 inline-flex text-[11px] font-bold rounded-full uppercase tracking-wider ${
                        issue.status === 'REPORTED' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' : 
                        issue.status === 'MORE_INFO_REQUIRED' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                        issue.status === 'VERIFIED' ? 'bg-blue-100 text-blue-800 border border-blue-200' : 
                        issue.status === 'ASSIGNED' ? 'bg-indigo-100 text-indigo-800' :
                        issue.status === 'IN_PROGRESS' ? 'bg-purple-100 text-purple-800' :
                        issue.status === 'CITIZEN_VERIFICATION' ? 'bg-teal-100 text-teal-800' :
                        issue.status === 'RESOLVED' || issue.status === 'CLOSED' ? 'bg-green-100 text-green-800' : 
                        'bg-red-100 text-red-800'
                      }`}>
                        {issue.status}
                      </span>
                    </td>

                    {/* SLA Badge */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {issue.sla && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Clock className={`h-3.5 w-3.5 ${
                            issue.sla.status === 'BREACHED' ? 'text-red-500' :
                            issue.sla.status === 'DUE_SOON' ? 'text-yellow-500' :
                            'text-green-500'
                          }`} />
                          <span className={`font-semibold ${
                            issue.sla.status === 'BREACHED' ? 'text-red-600' :
                            issue.sla.status === 'DUE_SOON' ? 'text-yellow-600' :
                            'text-green-600'
                          }`}>
                            {issue.sla.status === 'BREACHED' ? 'Breached' :
                             issue.sla.status === 'DUE_SOON' ? 'Due Soon' :
                             issue.sla.status.includes('RESOLVED') ? 'Resolved' : 'On Track'}
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <Link 
                        to={`/admin/issues/${issue.id}`} 
                        className="px-3.5 py-1.5 bg-gray-900 hover:bg-red-600 text-white rounded-lg text-xs font-bold transition-colors shadow-sm inline-block"
                      >
                        Review
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
