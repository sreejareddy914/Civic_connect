import { useEffect, useState } from 'react';
import { 
  Sparkles, 
  MapPin, 
  Loader2
} from 'lucide-react';
import { adminApi } from '../../services/adminApi';

export default function AdminPredictions() {
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPredictions();
  }, []);

  const fetchPredictions = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getAIPredictions();
      setPredictions(res.predictions || []);
    } catch (e: any) {
      console.error('Error fetching AI predictions:', e);
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
            <Sparkles className="h-6 w-6 text-purple-600" />
            AI Recurring Issue & Failure Predictions
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Machine learning predictive model identifying chronic recurring civic patterns and imminent infrastructure failures
          </p>
        </div>
        <button
          onClick={fetchPredictions}
          className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm transition"
        >
          Re-run Neural Analysis
        </button>
      </div>

      {/* Model Status Card */}
      <div className="bg-gradient-to-r from-purple-900 to-indigo-900 rounded-xl p-6 text-white shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-300">
              <Sparkles className="h-4 w-4" /> Predictive Engine: CivicBrain v3.2 Active
            </div>
            <h2 className="text-xl font-bold">Proactive Preventive Maintenance Forecasting</h2>
            <p className="text-xs text-purple-200 max-w-2xl">
              By cross-referencing complaint clustering, historical seasonal weather reports, and time-to-failure telemetry, CivicConnect forecasts recurring civic bottlenecks before citizen reports escalate.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm px-4 py-3 rounded-xl border border-white/20 text-center">
            <div className="text-2xl font-black text-white">92.4%</div>
            <div className="text-[11px] text-purple-200 uppercase font-semibold">Model Confidence</div>
          </div>
        </div>
      </div>

      {/* Predictions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {predictions.length === 0 ? (
          <div className="col-span-2 bg-white p-12 rounded-xl border border-gray-200 text-center text-gray-400">
            No predictive failure patterns detected at this time.
          </div>
        ) : (
          predictions.map((pred) => (
            <div key={pred.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-black ${
                    pred.risk === 'HIGH' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {pred.risk} RISK PATTERN
                  </span>
                  <h3 className="text-base font-bold text-gray-900 mt-2">{pred.prediction}</h3>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-full">
                    {Math.round(pred.confidence * 100)}% Confidence
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-xs bg-gray-50 p-4 rounded-lg border border-gray-100">
                <div className="flex items-center gap-1.5 text-gray-700 font-semibold">
                  <MapPin className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                  <span>Target Corridor: {pred.location}</span>
                </div>
                <p className="text-gray-600 pl-5">{pred.reason}</p>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-gray-100 text-xs">
                <span className="text-gray-500 font-medium">
                  Correlated Complaints: <strong className="text-gray-800">{pred.supportingComplaints} reports</strong>
                </span>
                <span className="text-gray-400">
                  Generated {new Date(pred.generatedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
