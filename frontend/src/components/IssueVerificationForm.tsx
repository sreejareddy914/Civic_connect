import React, { useState, useRef } from 'react';
import { Camera, MapPin, Loader2, Upload, Navigation, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface IssueVerificationFormProps {
  issueId: string;
  onClose: () => void;
  onSuccess: (pointsAwarded: number) => void;
}

export default function IssueVerificationForm({ issueId, onClose, onSuccess }: IssueVerificationFormProps) {
  const [result, setResult] = useState<string>('');
  const [observationNote, setObservationNote] = useState('');
  
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState('');

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleLocationDetect = () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }

    setLocationLoading(true);
    setLocationError('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setLocationLoading(false);
      },
      () => {
        setLocationError('Unable to retrieve your location');
        setLocationLoading(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleImageCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('Image must be less than 10MB');
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!result) {
      setError('Please select a verification result.');
      return;
    }
    if (!observationNote.trim()) {
      setError('Observation note is required.');
      return;
    }
    if (result === 'CONFIRMED_PRESENT') {
      if (!imageFile) {
        setError('A photo is required to confirm an issue is present.');
        return;
      }
      if (!latitude || !longitude) {
        setError('Current location is required to confirm an issue is present.');
        return;
      }
    }

    setSubmitting(true);
    
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error('Not authenticated');

      const formData = new FormData();
      formData.append('result', result);
      formData.append('observation_note', observationNote);
      if (latitude && longitude) {
        formData.append('latitude', latitude.toString());
        formData.append('longitude', longitude.toString());
      }
      if (imageFile) {
        formData.append('image', imageFile);
      }

      const res = await fetch(`${apiUrl}/issues/${issueId}/verify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionData.session.access_token}`
        },
        body: formData
      });

      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit verification');
      }

      onSuccess(data.pointsAwarded || 0);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-teal-100 shadow-sm p-5 my-4">
      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
        <CheckCircle className="w-5 h-5 mr-2 text-teal-600" />
        Verify This Civic Issue
      </h3>
      
      {error && (
        <div className="p-3 mb-4 text-sm text-red-700 bg-red-50 rounded-lg border border-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Is this issue currently present at this location?</label>
          <div className="space-y-2">
            {[
              { id: 'CONFIRMED_PRESENT', label: 'Yes — Issue is Present', color: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100' },
              { id: 'NOT_VERIFIED', label: 'No — I Could Not Verify', color: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100' },
              { id: 'NO_LONGER_PRESENT', label: 'Issue Is Resolved', color: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100' }
            ].map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setResult(opt.id)}
                className={`w-full text-left px-4 py-3 border rounded-lg transition-colors font-medium ${
                  result === opt.id 
                    ? `ring-2 ring-teal-500 border-transparent bg-teal-50 text-teal-900`
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center">
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center mr-3 ${result === opt.id ? 'border-teal-600' : 'border-gray-300'}`}>
                    {result === opt.id && <div className="w-2 h-2 rounded-full bg-teal-600"></div>}
                  </div>
                  {opt.label}
                </div>
              </button>
            ))}
          </div>
        </div>

        {result === 'CONFIRMED_PRESENT' && (
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
            <h4 className="text-sm font-bold text-gray-900">Verification Evidence</h4>
            
            <div>
              <p className="text-xs text-gray-500 mb-2">A photo is required to confirm the issue.</p>
              {imagePreview ? (
                <div className="relative rounded-lg overflow-hidden border border-gray-200">
                  <img src={imagePreview} alt="Evidence preview" className="w-full h-48 object-cover" />
                  <button
                    type="button"
                    onClick={() => { setImageFile(null); setImagePreview(null); }}
                    className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-md hover:bg-black/70"
                  >
                    Change Photo
                  </button>
                </div>
              ) : (
                <div className="flex gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    ref={cameraInputRef}
                    onChange={handleImageCapture}
                  />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleImageCapture}
                  />
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center py-2 px-4 border border-teal-600 text-teal-600 rounded-lg hover:bg-teal-50 font-medium text-sm transition-colors"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Take Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 flex items-center justify-center py-2 px-4 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium text-sm transition-colors"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Photo
                  </button>
                </div>
              )}
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-2">Your current location is required to verify proximity.</p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleLocationDetect}
                  className={`flex items-center justify-center py-2 px-4 border rounded-lg font-medium text-sm transition-colors ${
                    latitude && longitude 
                      ? 'border-green-600 text-green-700 bg-green-50' 
                      : 'border-teal-600 text-teal-600 hover:bg-teal-50'
                  }`}
                >
                  {locationLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : latitude && longitude ? (
                    <MapPin className="w-4 h-4 mr-2" />
                  ) : (
                    <Navigation className="w-4 h-4 mr-2" />
                  )}
                  {latitude && longitude ? 'Location Acquired' : 'Use Current Location'}
                </button>
                {latitude && longitude && (
                  <span className="text-xs text-gray-500 font-mono">
                    {latitude.toFixed(4)}, {longitude.toFixed(4)}
                  </span>
                )}
              </div>
              {locationError && <p className="text-xs text-red-600 mt-1">{locationError}</p>}
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Observation</label>
          <p className="text-xs text-gray-500 mb-2">Describe what you observed...</p>
          <textarea
            value={observationNote}
            onChange={(e) => setObservationNote(e.target.value)}
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition-all resize-none text-sm"
            placeholder="e.g., I visited this location and confirmed that the pothole is still present."
          ></textarea>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-6 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            disabled={submitting || !result || !observationNote.trim()}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Verification'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
