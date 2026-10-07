import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '../lib/supabase';
import { Loader2, AlertCircle, X, MapPin, Clock, Info, CheckCircle, Image as ImageIcon } from 'lucide-react';
import IssueUpvote from '../components/IssueUpvote';
import IssueComments from '../components/IssueComments';
import { useSearchParams } from 'react-router-dom';
import IssueVerificationForm from '../components/IssueVerificationForm';

function MapBounds({ issues, isLoading, verifyMode }: { issues: any[], isLoading: boolean, verifyMode: boolean }) {
  const map = useMap();
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    if (isLoading || hasInitialized) return;

    if (verifyMode) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            map.setView([latitude, longitude], 13);
            setHasInitialized(true);
          },
          (err) => {
            console.warn('Geolocation failed or denied. Falling back to default view.', err);
            // Fallback logic
            applyFallbackView();
          },
          { enableHighAccuracy: true, timeout: 5000 }
        );
        return; // Don't run the fallback logic immediately
      } else {
        applyFallbackView();
      }
    } else {
      applyFallbackView();
    }

    function applyFallbackView() {
      if (issues.length > 0) {
        const sortedLats = [...issues].map(i => i.latitude).sort((a, b) => a - b);
        const sortedLngs = [...issues].map(i => i.longitude).sort((a, b) => a - b);
        const medianLat = sortedLats[Math.floor(sortedLats.length / 2)];
        const medianLng = sortedLngs[Math.floor(sortedLngs.length / 2)];

        const clusterIssues = issues.filter(i => 
          Math.abs(i.latitude - medianLat) <= 0.5 && 
          Math.abs(i.longitude - medianLng) <= 0.5
        );
        
        const targetIssues = clusterIssues.length > 0 ? clusterIssues : issues;
        
        if (targetIssues.length === 1) {
          map.setView([targetIssues[0].latitude, targetIssues[0].longitude], 14);
        } else {
          const bounds = L.latLngBounds(targetIssues.map(i => [i.latitude, i.longitude]));
          if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
            map.setView(bounds.getCenter(), 14);
          } else {
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
          }
        }
      } else {
        const defaultCenter = L.latLng(17.3850, 78.4867);
        map.setView([defaultCenter.lat, defaultCenter.lng], 13);
      }
      setHasInitialized(true);
    }
  }, [issues, isLoading, hasInitialized, map, verifyMode]);

  return null;
}

const createIcon = (severity: string) => {
  let color = '#22c55e'; // LOW - Green
  if (severity === 'HIGH' || severity === 'CRITICAL') color = '#ef4444'; // RED
  else if (severity === 'MEDIUM') color = '#f97316'; // ORANGE
  
  const html = `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.4);"></div>`;
  return L.divIcon({ html, className: 'custom-leaflet-icon', iconSize: [20, 20], iconAnchor: [10, 10], popupAnchor: [0, -10] });
};

export default function CommunityMap({ session: _session }: { session?: any }) {
  const [searchParams] = useSearchParams();
  const verifyMode = searchParams.get('mode') === 'verify';

  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL');
  
  const [viewingDetails, setViewingDetails] = useState(false);
  const [detailedData, setDetailedData] = useState<any | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [showVerifyForm, setShowVerifyForm] = useState(false);

  useEffect(() => {
    fetchIssues();
  }, []);

  const fetchIssues = async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error } = await supabase
        .from('issues')
        .select('*')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setIssues(data || []);
    } catch (err: any) {
      console.error('Error fetching map issues:', err);
      setError('Unable to load community complaints. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filteredIssues = useMemo(() => {
    let result = issues;
    
    // Filter by severity
    if (filter !== 'ALL') {
      result = result.filter(i => (i.severity || 'LOW') === filter);
    }
    
    return result;
  }, [issues, filter]);

  const handleViewDetails = async (issue: any) => {
    setViewingDetails(true);
    setDetailsLoading(true);
    setShowVerifyForm(false);
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const token = authSession?.access_token;
      
      const response = await fetch(`${apiUrl}/issues/${issue.id}/extra`, {
        headers: token ? {
          'Authorization': `Bearer ${token}`
        } : {}
      });
      
      let extraData: any = {};
      if (response.ok) {
        extraData = await response.json();
      }
      setDetailedData({
        ...issue,
        ai: extraData.ai,
        media: extraData.media,
        hasCurrentUserVerified: extraData.hasCurrentUserVerified
      });
    } catch (err) {
      console.error("Failed to load details", err);
    } finally {
      setDetailsLoading(false);
    }
  };

  const defaultCenter: [number, number] = [17.3850, 78.4867];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-[calc(100vh-4rem)] flex flex-col relative">
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#1A3636] font-serif">Community Map</h1>
          <p className="text-gray-600 mt-1">Explore civic issues reported in your area.</p>
        </div>
        
        <div className="flex bg-white rounded-lg p-1 shadow-sm border border-gray-200">
          {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                filter === f 
                  ? 'bg-teal-50 text-teal-700 shadow-sm border border-teal-100' 
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {f === 'ALL' ? 'All' : f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-grow bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative z-0">
        {loading && (
          <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center">
            <Loader2 className="w-10 h-10 text-teal-600 animate-spin mb-4" />
            <p className="text-teal-900 font-medium">Loading community issues...</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 z-10 bg-white flex flex-col items-center justify-center p-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
            <p className="text-red-900 font-medium">{error}</p>
            <button onClick={fetchIssues} className="mt-4 px-4 py-2 bg-red-50 text-red-700 rounded-lg font-medium hover:bg-red-100 transition-colors border border-red-200">
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && filteredIssues.length === 0 && (
          <div className="absolute inset-0 z-10 bg-white flex flex-col items-center justify-center p-6 text-center">
            <MapPin className="w-12 h-12 text-gray-300 mb-4" />
            <p className="text-gray-600 font-medium">No mapped complaints found.</p>
          </div>
        )}

        <MapContainer
          center={defaultCenter}
          zoom={12}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapBounds issues={filteredIssues} isLoading={loading} verifyMode={verifyMode} />
          
          {filteredIssues.map(issue => (
            <Marker 
              key={issue.id} 
              position={[issue.latitude, issue.longitude]} 
              icon={createIcon(issue.severity || 'LOW')}
              eventHandlers={{
                click: () => { handleViewDetails(issue); }
              }}
            >
              <Popup className="custom-popup" minWidth={280}>
                <div className="p-1">
                  <div className="flex items-start justify-between mb-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      (issue.severity || 'LOW') === 'HIGH' || issue.severity === 'CRITICAL' ? 'bg-red-100 text-red-800' :
                      issue.severity === 'MEDIUM' ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {issue.severity || 'LOW'} SEVERITY
                    </span>
                    <span className="text-[10px] text-gray-500 font-medium bg-gray-100 px-2 py-0.5 rounded-full">{issue.category || 'Other'}</span>
                  </div>
                  
                  <h3 className="font-bold text-gray-900 text-base mb-1 leading-tight">{issue.title}</h3>
                  <p className="text-sm text-gray-600 line-clamp-2 mb-3 leading-snug">{issue.description}</p>
                  
                  <div className="space-y-1 mb-4">
                    {issue.address && (
                      <div className="flex items-start text-xs text-gray-500">
                        <MapPin className="w-3.5 h-3.5 mr-1.5 mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-1">{issue.address}</span>
                      </div>
                    )}
                    <div className="flex items-center text-xs text-gray-500">
                      <Clock className="w-3.5 h-3.5 mr-1.5 flex-shrink-0" />
                      <span>{new Date(issue.created_at).toLocaleString()}</span>
                    </div>
                  </div>

                  <button 
                    onClick={() => handleViewDetails(issue)}
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium text-sm py-2 rounded-md transition-colors shadow-sm"
                  >
                    Details of Complaint
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Legend */}
        <div className="absolute bottom-6 right-6 bg-white/95 backdrop-blur px-4 py-3 rounded-xl shadow-lg border border-gray-100 z-[400] select-none pointer-events-none">
          <h4 className="font-bold text-xs text-gray-500 uppercase tracking-wider mb-3">Severity Legend</h4>
          <div className="space-y-2.5 text-sm font-medium text-gray-700">
            <div className="flex items-center"><span className="w-3.5 h-3.5 rounded-full bg-red-500 mr-3 shadow-sm border-2 border-white ring-1 ring-red-200"></span> High</div>
            <div className="flex items-center"><span className="w-3.5 h-3.5 rounded-full bg-orange-500 mr-3 shadow-sm border-2 border-white ring-1 ring-orange-200"></span> Medium</div>
            <div className="flex items-center"><span className="w-3.5 h-3.5 rounded-full bg-green-500 mr-3 shadow-sm border-2 border-white ring-1 ring-green-200"></span> Low</div>
          </div>
        </div>
      </div>

      {/* Details Modal */}
      {viewingDetails && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setViewingDetails(false)}></div>
          
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col relative z-10 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50 rounded-t-2xl">
              <h2 className="text-lg font-bold text-gray-900 flex items-center">
                <Info className="w-5 h-5 mr-2 text-teal-600" />
                Complaint Details
              </h2>
              <button 
                onClick={() => setViewingDetails(false)}
                className="p-2 bg-white border border-gray-200 rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-grow overflow-y-auto p-6">
              {detailsLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-teal-600 mb-4" />
                  <p className="text-gray-500 font-medium">Loading full details...</p>
                </div>
              ) : detailedData ? (
                <div className="space-y-8">
                  {/* Verify Mode Actions */}
                  {verifyMode && !showVerifyForm && (
                    <div className="mb-6">
                      {detailedData.status === 'RESOLVED' ? (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                          <p className="text-sm font-medium text-gray-700">This complaint has already been resolved.</p>
                        </div>
                      ) : detailedData.reporter_id === _session?.user?.id ? (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                          <p className="text-sm font-medium text-gray-700">You cannot verify your own complaint.</p>
                        </div>
                      ) : detailedData.hasCurrentUserVerified ? (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                          <p className="text-sm font-medium text-gray-700">You have already verified this complaint.</p>
                        </div>
                      ) : (
                        <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 flex flex-col items-center justify-center text-center shadow-sm">
                          <h3 className="font-bold text-teal-900 mb-2">Help verify this complaint</h3>
                          <p className="text-sm text-teal-700 mb-4">Visit this location to confirm if the issue is still present and earn Civic Points.</p>
                          <button
                            onClick={() => setShowVerifyForm(true)}
                            className="px-6 py-2 bg-teal-600 text-white font-medium rounded-lg shadow hover:bg-teal-700 transition-colors"
                          >
                            <CheckCircle className="w-4 h-4 mr-2 inline-block" />
                            Verify This Complaint
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {showVerifyForm && (
                    <IssueVerificationForm 
                      issueId={detailedData.id} 
                      onClose={() => setShowVerifyForm(false)} 
                      onSuccess={(points) => {
                        setShowVerifyForm(false);
                        alert(`Verification submitted successfully! You earned ${points} Civic Points.`);
                        fetchIssues();
                        setViewingDetails(false);
                      }} 
                    />
                  )}

                  {/* Image Section */}
                  {detailedData.media ? (
                    <div className="rounded-xl overflow-hidden bg-gray-100 border border-gray-200 shadow-sm">
                      <img 
                        src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/issues/${detailedData.media.storage_path}`} 
                        alt="Issue" 
                        className="w-full h-auto max-h-80 object-cover"
                      />
                    </div>
                  ) : (
                    <div className="rounded-xl bg-gray-50 border border-gray-200 border-dashed flex flex-col items-center justify-center py-12 text-gray-400">
                      <ImageIcon className="w-12 h-12 mb-2 opacity-50" />
                      <span className="text-sm font-medium">No image available</span>
                    </div>
                  )}

                  {/* Header Info */}
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-4">{detailedData.title}</h3>
                    <div className="flex flex-wrap gap-2 mb-6">
                      <span className="inline-flex items-center px-3 py-1 text-xs font-bold bg-gray-100 text-gray-800 rounded-lg">
                        {detailedData.category || 'Other'}
                      </span>
                      <span className={`inline-flex items-center px-3 py-1 text-xs font-bold rounded-lg border
                        ${(detailedData.severity || 'LOW') === 'HIGH' || detailedData.severity === 'CRITICAL' ? 'bg-red-50 text-red-700 border-red-200' : ''}
                        ${detailedData.severity === 'MEDIUM' ? 'bg-orange-50 text-orange-700 border-orange-200' : ''}
                        ${detailedData.severity === 'LOW' || !detailedData.severity ? 'bg-green-50 text-green-700 border-green-200' : ''}
                      `}>
                        Severity: {detailedData.severity || 'LOW'}
                      </span>
                      <span className="inline-flex items-center px-3 py-1 text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 rounded-lg">
                        Priority: {detailedData.priority || 'LOW'}
                      </span>
                      {detailedData.ai_confidence && (
                        <span className="inline-flex items-center px-3 py-1 text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200 rounded-lg">
                          Confidence: {detailedData.ai_confidence}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Original Description</h4>
                      <p className="text-sm text-gray-700 bg-gray-50 p-4 rounded-lg border border-gray-100 leading-relaxed whitespace-pre-wrap">
                        {detailedData.ai?.raw_response?.originalDescription || detailedData.description}
                      </p>
                    </div>
                    {detailedData.ai?.parsed_output?.polishedDescription && (
                      <div>
                        <h4 className="text-xs font-bold text-teal-600 uppercase tracking-wider mb-2">Polished Description</h4>
                        <p className="text-sm text-gray-800 bg-teal-50 p-4 rounded-lg border border-teal-100 leading-relaxed whitespace-pre-wrap">
                          {detailedData.ai.parsed_output.polishedDescription}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Image Analysis */}
                  {detailedData.ai?.raw_response?.imageAnalysis && (
                    <div>
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Image Analysis</h4>
                      <p className="text-sm text-gray-700 bg-gray-50 p-4 rounded-lg border border-gray-100 leading-relaxed">
                        {detailedData.ai.raw_response.imageAnalysis}
                      </p>
                    </div>
                  )}

                  <hr className="border-gray-100" />

                  {/* Location & Metadata */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Location</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex">
                          <span className="font-semibold text-gray-700 w-24">Address:</span>
                          <span className="text-gray-600 flex-1">{detailedData.address || 'N/A'}</span>
                        </div>
                        <div className="flex">
                          <span className="font-semibold text-gray-700 w-24">Coordinates:</span>
                          <span className="text-gray-600 font-mono text-xs mt-0.5">{detailedData.latitude.toFixed(6)}, {detailedData.longitude.toFixed(6)}</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Report Info</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex">
                          <span className="font-semibold text-gray-700 w-24">ID:</span>
                          <span className="text-gray-600 font-mono text-xs mt-0.5">{detailedData.code || detailedData.id.split('-')[0]}</span>
                        </div>
                        <div className="flex">
                          <span className="font-semibold text-gray-700 w-24">Reported:</span>
                          <span className="text-gray-600">{new Date(detailedData.created_at).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center">
                          <span className="font-semibold text-gray-700 w-24">Status:</span>
                          <span className="text-gray-800 font-bold">{detailedData.status}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Duplicate Info */}
                  {detailedData.ai?.raw_response?.isDuplicate !== undefined && (
                    <>
                      <hr className="border-gray-100" />
                      <div>
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Duplicate Detection</h4>
                        {detailedData.ai.raw_response.isDuplicate ? (
                          <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg space-y-2">
                            <p className="text-sm font-bold text-orange-900 flex items-center">
                              <AlertCircle className="w-4 h-4 mr-2" />
                              Possible Duplicate
                            </p>
                            <p className="text-sm text-orange-800"><span className="font-semibold">Matched Report:</span> {detailedData.ai.raw_response.matchedReportId}</p>
                            <p className="text-sm text-orange-800 bg-white/50 p-2 rounded">{detailedData.ai.raw_response.duplicateReason || detailedData.ai.raw_response.reason}</p>
                          </div>
                        ) : (
                          <div className="p-3 bg-green-50 border border-green-100 rounded-lg flex items-center">
                            <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                            <span className="text-sm font-medium text-green-800">No duplicate issues detected</span>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  <hr className="border-gray-100" />
                  
                  <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Community</h4>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="flex-1">
                        <IssueUpvote issueId={detailedData.id} variant="button" />
                      </div>
                      <div className="flex-1">
                        <IssueComments issueId={detailedData.id} variant="button" />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">Failed to load issue details.</div>
              )}
            </div>
            
            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-end">
              <button 
                onClick={() => setViewingDetails(false)}
                className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
