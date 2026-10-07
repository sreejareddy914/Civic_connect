import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Flame, 
  MapPin, 
  AlertTriangle, 
  Loader2, 
  ArrowUpRight, 
  ShieldAlert
} from 'lucide-react';
import { adminApi } from '../../services/adminApi';

export default function AdminHotspots() {
  const [hotspots, setHotspots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCluster, setSelectedCluster] = useState<any | null>(null);

  useEffect(() => {
    fetchHotspots();
  }, []);

  const fetchHotspots = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getHotspots();
      setHotspots(res.hotspots || []);
      if (res.hotspots && res.hotspots.length > 0) {
        setSelectedCluster(res.hotspots[0]);
      }
    } catch (e: any) {
      console.error('Error fetching hotspots:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[70vh]">
        <Loader2 className="animate-spin h-10 w-10 text-red-600" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Flame className="h-6 w-6 text-red-600" />
            CivicConnect Municipal Hotspot Intelligence
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Automated geospatial density clustering identifying chronic civic hazard corridors and recurrence zones
          </p>
        </div>
        <button
          onClick={fetchHotspots}
          className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm transition"
        >
          Recluster Hotspots
        </button>
      </div>

      {/* Overview Banner */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold text-red-700 uppercase tracking-wider flex items-center gap-1.5">
            <ShieldAlert className="h-4 w-4" /> Cluster Density Alert
          </div>
          <h2 className="text-lg font-bold text-red-950 mt-1">
            {hotspots.length} Concentrated Civic Hazard Hotspots Detected
          </h2>
          <p className="text-xs text-red-800 mt-0.5 max-w-2xl">
            Complaints clustered within a 500-meter radius indicate systemic infrastructure strain requiring departmental coordination rather than isolated fixes.
          </p>
        </div>
        <div className="text-right">
          <span className="text-3xl font-black text-red-700">
            {hotspots.reduce((acc, h) => acc + h.criticalCount, 0)}
          </span>
          <p className="text-xs text-red-600 font-semibold">Critical Issues in Clusters</p>
        </div>
      </div>

      {/* Two Column Layout: Hotspots List & Cluster Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Cluster Cards */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider">
            Identified Problem Corridors ({hotspots.length})
          </h2>
          {hotspots.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-gray-200 text-center text-gray-400">
              No geographical clusters detected.
            </div>
          ) : (
            hotspots.map((cluster, idx) => {
              const isSelected = selectedCluster?.area === cluster.area;
              return (
                <div
                  key={idx}
                  onClick={() => setSelectedCluster(cluster)}
                  className={`p-5 rounded-xl border cursor-pointer transition shadow-sm ${
                    isSelected
                      ? 'bg-white border-red-600 ring-2 ring-red-600/10'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase">
                        <MapPin className="h-3.5 w-3.5 text-red-600" />
                        Zone #{idx + 1}
                      </div>
                      <h3 className="font-bold text-gray-900 mt-1 text-base">{cluster.area}</h3>
                    </div>
                    <span className="px-2.5 py-1 bg-red-100 text-red-800 font-black text-xs rounded-full">
                      {cluster.count} Reports
                    </span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
                    <span className="text-gray-500 font-medium">Top Category: <strong className="text-gray-800">{cluster.topCategory}</strong></span>
                    {cluster.criticalCount > 0 && (
                      <span className="text-red-600 font-bold flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> {cluster.criticalCount} Critical
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column (2 cols): Selected Cluster Complaint Inspector */}
        <div className="lg:col-span-2">
          {selectedCluster ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Inspecting Corridor</span>
                  <h3 className="text-xl font-bold text-gray-900">{selectedCluster.area}</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Coordinates: {selectedCluster.lat.toFixed(5)}, {selectedCluster.lng.toFixed(5)} • {selectedCluster.issues?.length || 0} Complaints in Cluster
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-full">
                    {selectedCluster.topCategory}
                  </span>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Associated Complaints in this Zone
                </h4>
                <div className="divide-y divide-gray-100">
                  {(selectedCluster.issues || []).map((issue: any) => (
                    <div key={issue.id} className="py-4 flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-gray-500">{issue.code}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            issue.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                            issue.severity === 'HIGH' ? 'bg-orange-100 text-orange-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {issue.severity}
                          </span>
                          <span className="text-xs font-medium text-gray-500 uppercase">{issue.status}</span>
                        </div>
                        <h5 className="font-bold text-gray-900 text-sm">{issue.title}</h5>
                        <p className="text-xs text-gray-600 line-clamp-1">{issue.description}</p>
                      </div>

                      <Link
                        to={`/admin/issues/${issue.id}`}
                        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-lg flex items-center gap-1 transition flex-shrink-0"
                      >
                        Inspect <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
              Select a hotspot corridor on the left to view complaint details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
