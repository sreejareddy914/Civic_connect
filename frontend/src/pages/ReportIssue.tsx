import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Camera, MapPin, Mic, Loader2, Sparkles, CheckCircle, Search, AlertCircle, Trash2, Navigation } from 'lucide-react';
import { supabase } from '../lib/supabase';
import MapPicker from '../components/MapPicker';
import IssueUpvote from '../components/IssueUpvote';
import IssueComments from '../components/IssueComments';

const LANGUAGES = [
  { code: 'en-IN', name: 'English' },
  { code: 'hi-IN', name: 'हिन्दी (Hindi)' },
  { code: 'te-IN', name: 'తెలుగు (Telugu)' },
  { code: 'ta-IN', name: 'தமிழ் (Tamil)' },
  { code: 'kn-IN', name: 'ಕನ್ನಡ (Kannada)' },
  { code: 'ml-IN', name: 'മലയാളം (Malayalam)' },
  { code: 'mr-IN', name: 'मराठी (Marathi)' },
  { code: 'bn-IN', name: 'বাংলা (Bengali)' },
  { code: 'gu-IN', name: 'ગુજરાતી (Gujarati)' },
  { code: 'pa-IN', name: 'ਪੰਜਾਬੀ (Punjabi)' }
];

export default function ReportIssue({ isEditing = false }: { isEditing?: boolean }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [languageCode, setLanguageCode] = useState('en-IN');
  const [description, setDescription] = useState('');
  
  // Media states
  const [voiceState, setVoiceState] = useState<'IDLE' | 'RECORDING' | 'PROCESSING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [voiceError, setVoiceError] = useState('');
  
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Location states
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  const [address, setAddress] = useState('');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');

  // Flow states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiResults, setAiResults] = useState<any>(null);
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [generalError, setGeneralError] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isEditing && id) {
      const fetchIssue = async () => {
        try {
          const { data: issue, error } = await supabase.from('issues').select('*').eq('id', id).single();
          if (error) throw error;
          if (issue.status !== 'REPORTED') {
            alert('This complaint can no longer be edited.');
            navigate('/track');
            return;
          }
          setTitle(issue.title);
          setDescription(issue.description);
          setLocation({ lat: issue.latitude, lng: issue.longitude });
          setAddress(issue.address || '');

          
          const { data: media } = await supabase.from('issue_media').select('storage_path').eq('issue_id', id).eq('media_type', 'ORIGINAL').single();
          if (media) {
            const { data: fileUrl } = supabase.storage.from('issues').getPublicUrl(media.storage_path);
            if (fileUrl) {
              setImagePreview(fileUrl.publicUrl);
            }
          }
        } catch (err) {
          console.error(err);
        }
      };
      fetchIssue();
    }
  }, [isEditing, id, navigate]);

  // Watch for form changes to invalidate AI results
  useEffect(() => {
    if (aiResults) {
      setIsFormDirty(true);
    }
  }, [title, description, image, location, languageCode]);

  // Debounce Location Search
  useEffect(() => {
    if (searchQuery.length < 3) {
      setSearchResults([]);
      setShowSuggestions(false);
      return;
    }
    
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    
    searchTimeoutRef.current = setTimeout(() => {
      // Don't search if the query exactly matches the already selected address
      if (searchQuery !== address) {
        performSearch(searchQuery);
      }
    }, 600);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  const performSearch = async (query: string) => {
    setIsSearching(true);
    setLocationError('');
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=in`);
      const data = await res.json();
      
      if (data && data.length > 0) {
        setSearchResults(data);
        setShowSuggestions(true);
      } else {
        setSearchResults([]);
        setShowSuggestions(false);
      }
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setIsSearching(false);
    }
  };

  const selectSearchResult = (result: any) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setLocation({ lat, lng });
    setAddress(result.display_name);

    setSearchQuery(result.display_name);
    setShowSuggestions(false);
    setLocationError('');
  };

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await res.json();
      if (data && data.display_name) {
        setAddress(data.display_name);
        setSearchQuery(data.display_name);
      } else {
        setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        setSearchQuery(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    } catch (err) {
      setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    }
  };

  const handleGetLocation = () => {
    setLoadingLocation(true);
    setLocationError('');
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setLocation({ lat, lng });

          await reverseGeocode(lat, lng);
          setLoadingLocation(false);
        },
        (error) => {
          console.error("Error getting location:", error);
          setLocationError("Unable to access your current location. Please allow location access or choose a location from the map.");
          setLoadingLocation(false);
        }
      );
    } else {
      setLocationError("Geolocation is not supported by your browser.");
      setLoadingLocation(false);
    }
  };

  const handleMapSelect = async (lat: number, lng: number) => {
    setLocation({ lat, lng });

    setLocationError('');
    await reverseGeocode(lat, lng);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const startCamera = async () => {
    setCameraError('');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Not supported");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setShowCamera(true);
    } catch (err: any) {
      if (err.message === "Not supported") {
        setCameraError("Camera capture is not supported on this device/browser. Please use Upload a file.");
      } else {
        setCameraError("Camera access was denied. Please allow camera access or use Upload a file.");
      }
    }
  };

  useEffect(() => {
    if (showCamera && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(e => console.error("Video play error:", e));
    }
  }, [showCamera]);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], "camera_capture.jpg", { type: "image/jpeg" });
            setImage(file);
            setImagePreview(URL.createObjectURL(blob));
            stopCamera();
          }
        }, 'image/jpeg', 0.9);
      }
    }
  };

  const toggleRecording = async () => {
    setVoiceError('');
    if (voiceState === 'RECORDING') {
      mediaRecorderRef.current?.stop();
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) audioChunksRef.current.push(event.data);
        };

        mediaRecorder.onstop = async () => {
          setVoiceState('PROCESSING');
          const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          await processVoiceAudio(blob);
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setVoiceState('RECORDING');
      } catch (err) {
        console.error("Microphone access denied:", err);
        setVoiceState('ERROR');
        setVoiceError("Microphone access is required to record a voice note.");
      }
    }
  };

  const processVoiceAudio = async (blob: Blob) => {
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'voice_note.webm');
      formData.append('languageCode', languageCode);

      const response = await fetch(`${import.meta.env.VITE_API_URL}/issues/transcribe`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Transcription failed');
      
      const data = await response.json();
      if (data.transcript) {
        setDescription((prev) => prev ? `${prev} ${data.transcript}` : data.transcript);
        setVoiceState('SUCCESS');
        setTimeout(() => setVoiceState('IDLE'), 3000);
      } else {
        throw new Error('No transcript returned');
      }
    } catch (err) {
      console.error(err);
      setVoiceState('ERROR');
      setVoiceError("Unable to convert speech to text. Please try again.");
    }
  };

  const handleAnalyze = async () => {
    if (!title || !description || !location || !image) {
      setGeneralError("Please provide a title, a description, a photo, and your location.");
      return;
    }

    setIsAnalyzing(true);
    setGeneralError('');
    
    try {
      const formData = new FormData();
      formData.append('title', title);
      formData.append('description', description);
      formData.append('latitude', location.lat.toString());
      formData.append('longitude', location.lng.toString());
      formData.append('languageCode', languageCode); // Not strictly needed for analyze now, but keeping for compatibility
      
      if (image) formData.append('image', image);

      const response = await fetch(`${import.meta.env.VITE_API_URL}/issues/analyze`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorMsg = 'Unable to analyze the report right now. Please try again.';
        try {
          const errData = await response.json();
          if (errData.error) {
            errorMsg = errData.details ? `${errData.error}: ${errData.details}` : errData.error;
          }
        } catch (e) {
          // Ignore JSON parse errors for non-JSON responses
        }
        throw new Error(errorMsg);
      }

      const result = await response.json();
      setAiResults(result.analysis);
      setIsFormDirty(false); // Reset dirty flag
    } catch (err: any) {
      console.error("Analysis error:", err);
      setGeneralError(err.message || "Unable to analyze the report right now. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = async () => {
    if (!aiResults || isFormDirty) {
      setGeneralError("Please analyze the report with AI before submitting.");
      return;
    }

    setIsSubmitting(true);
    setGeneralError('');
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const formData = new FormData();
      formData.append('title', title);
      formData.append('originalDescription', description);
      formData.append('latitude', location?.lat.toString() || '');
      formData.append('longitude', location?.lng.toString() || '');
      formData.append('address', address);
      formData.append('reporter_id', session?.user?.id || '');
      
      if (image) formData.append('image', image);
      
      formData.append('category', aiResults.category);
      formData.append('severity', aiResults.severity);
      formData.append('priority', aiResults.priority);
      formData.append('confidence', aiResults.confidence?.toString() || '0');
      formData.append('polishedDescription', aiResults.polishedDescription);
      if (aiResults.imageAnalysis) formData.append('imageAnalysis', aiResults.imageAnalysis);
      if (aiResults.duplicate?.isDuplicate) {
        formData.append('isDuplicate', 'true');
        formData.append('matchedReportId', aiResults.duplicate.matchedReportId || '');
        formData.append('duplicateReason', aiResults.duplicate.reason || '');
      }

      const url = isEditing && id 
        ? `${import.meta.env.VITE_API_URL}/issues/${id}`
        : `${import.meta.env.VITE_API_URL}/issues/report`;

      const method = isEditing && id ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: formData,
      });

      if (!response.ok) throw new Error('Submission failed');

      if (isEditing) {
        setSuccessMessage('Complaint updated successfully!');
        setTimeout(() => navigate('/track'), 2000);
      } else {
        setSuccessMessage('Report submitted successfully! Your civic issue has been recorded.');
        
        // Reset
        setTitle('');
        setDescription('');
        setLocation(null);
        setAddress('');
        setSearchQuery('');
        setImage(null);
        setImagePreview(null);
        setAiResults(null);
        setIsFormDirty(false);
      }
      
    } catch (err) {
      console.error("Submission error:", err);
      setGeneralError("There was an error submitting your issue.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (successMessage) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-xl w-full bg-white p-10 rounded-2xl shadow-sm border border-gray-100 text-center">
          <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Report Submitted!</h2>
          <p className="text-gray-600 mb-8">{successMessage}</p>
          <button
            onClick={() => setSuccessMessage('')}
            className="inline-flex items-center justify-center px-8 py-3 border border-transparent rounded-lg shadow-sm text-base font-medium text-white bg-teal-600 hover:bg-teal-700 transition-colors w-full sm:w-auto"
          >
            Report Another Issue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        
        {/* Header */}
        <div className="bg-teal-900 px-6 py-5">
          <h2 className="text-xl font-bold text-white flex items-center">
            <AlertCircle className="w-5 h-5 mr-2 text-teal-200" />
            Report a Civic Issue
          </h2>
        </div>
        
        <div className="p-6 sm:p-8">
          {generalError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-lg flex items-start text-red-700">
              <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
              <p className="text-sm font-medium">{generalError}</p>
            </div>
          )}

          <div className="space-y-8">
            
            {/* 1. Title */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">1. Issue Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 p-3 border text-gray-900"
                placeholder="e.g. Large pothole on Main Street"
                required
              />
            </div>

            {/* 2 & 3. Language & Description */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-2">
                <label className="block text-sm font-bold text-gray-700">2. Description *</label>
                <div className="mt-2 sm:mt-0 flex items-center">
                  <span className="text-xs text-gray-500 mr-2 uppercase tracking-wider font-semibold">Voice Lang:</span>
                  <select
                    value={languageCode}
                    onChange={(e) => setLanguageCode(e.target.value)}
                    className="block text-sm rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 py-1 pl-2 pr-8 border bg-gray-50 text-gray-700"
                  >
                    {LANGUAGES.map(lang => (
                      <option key={lang.code} value={lang.code}>{lang.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="relative rounded-lg shadow-sm border border-gray-300 focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-500 overflow-hidden">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="block w-full border-0 p-3 pb-16 text-gray-900 focus:ring-0 resize-none"
                  placeholder="Describe the issue in detail. You can type or use voice recording..."
                />
                
                {/* Voice Controls Bottom Bar */}
                <div className="absolute bottom-0 left-0 right-0 bg-gray-50 border-t border-gray-200 p-2 flex items-center justify-between">
                  <div className="flex items-center pl-2">
                    {voiceState === 'IDLE' && <span className="text-xs text-gray-500">Click to speak description</span>}
                    {voiceState === 'RECORDING' && <span className="text-xs text-red-600 font-medium animate-pulse flex items-center"><span className="w-2 h-2 rounded-full bg-red-600 mr-2"></span>Recording...</span>}
                    {voiceState === 'PROCESSING' && <span className="text-xs text-teal-600 font-medium flex items-center"><Loader2 className="w-3 h-3 animate-spin mr-1.5" />Converting speech to text...</span>}
                    {voiceState === 'SUCCESS' && <span className="text-xs text-green-600 font-medium flex items-center"><CheckCircle className="w-3 h-3 mr-1.5" />Voice transcription added</span>}
                    {voiceState === 'ERROR' && <span className="text-xs text-red-600 font-medium flex items-center"><AlertCircle className="w-3 h-3 mr-1.5" />{voiceError}</span>}
                  </div>
                  
                  <button
                    type="button"
                    onClick={toggleRecording}
                    disabled={voiceState === 'PROCESSING'}
                    className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                      voiceState === 'RECORDING' 
                        ? 'bg-red-100 text-red-700 hover:bg-red-200 border border-red-200' 
                        : 'bg-white text-teal-700 hover:bg-teal-50 border border-teal-200 shadow-sm disabled:opacity-50'
                    }`}
                  >
                    {voiceState === 'RECORDING' ? (
                      <><span className="w-2 h-2 rounded-sm bg-red-600 mr-2" /> Stop Recording</>
                    ) : (
                      <><Mic className="w-4 h-4 mr-1.5" /> Speak</>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* 4. Image Upload */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">3. Photo Evidence *</label>
              {showCamera ? (
                <div className="relative rounded-lg overflow-hidden border border-gray-300 bg-black flex flex-col items-center">
                  <video 
                    ref={videoRef} 
                    className="w-full h-auto max-h-96 object-cover" 
                    playsInline 
                    muted 
                  />
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
                    <button 
                      type="button"
                      onClick={stopCamera}
                      className="px-4 py-2 bg-gray-800 text-white rounded-full bg-opacity-70 hover:bg-opacity-100 transition"
                    >
                      Cancel
                    </button>
                    <button 
                      type="button"
                      onClick={capturePhoto}
                      className="px-6 py-2 bg-teal-600 text-white font-bold rounded-full hover:bg-teal-700 shadow-lg transition"
                    >
                      Capture
                    </button>
                  </div>
                </div>
              ) : imagePreview ? (
                <div className="relative inline-block group">
                  <img src={imagePreview} alt="Preview" className="h-48 w-auto rounded-lg object-cover border border-gray-200 shadow-sm" />
                  <button 
                    type="button"
                    onClick={() => { setImage(null); setImagePreview(null); }}
                    className="absolute -top-2 -right-2 p-1.5 bg-white border border-gray-200 rounded-full text-red-600 hover:bg-red-50 shadow-md transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg bg-gray-50 hover:bg-gray-100 hover:border-teal-400 transition-colors">
                    <div className="space-y-1 text-center">
                      <Camera className="mx-auto h-10 w-10 text-gray-400" />
                      <div className="flex justify-center text-sm text-gray-600">
                        <button
                          type="button"
                          onClick={startCamera}
                          className="relative cursor-pointer rounded-md font-medium text-teal-600 hover:text-teal-700 focus-within:outline-none"
                        >
                          Take a Photo
                        </button>
                      </div>
                      <p className="text-xs text-gray-500">Use your device camera</p>
                    </div>
                  </div>
                  
                  <div className="flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg bg-gray-50 hover:bg-gray-100 hover:border-teal-400 transition-colors">
                    <div className="space-y-1 text-center">
                      <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      <div className="flex justify-center text-sm text-gray-600">
                        <label className="relative cursor-pointer rounded-md font-medium text-teal-600 hover:text-teal-700 focus-within:outline-none">
                          <span>Upload a file</span>
                          <input type="file" className="sr-only" accept="image/*" onChange={handleImageChange} />
                        </label>
                      </div>
                      <p className="text-xs text-gray-500">PNG, JPG up to 10MB</p>
                    </div>
                  </div>
                </div>
              )}
              {cameraError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  {cameraError}
                </div>
              )}
            </div>

            {/* 5. Location */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">4. Location *</label>
              
              {locationError && (
                <div className="mb-3 p-3 bg-red-50 border border-red-100 rounded-lg text-sm text-red-600 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-2" />
                  {locationError}
                </div>
              )}

              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={handleGetLocation}
                    disabled={loadingLocation}
                    className="sm:w-1/3 flex justify-center items-center px-4 py-2.5 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50 transition-colors"
                  >
                    {loadingLocation ? <Loader2 className="animate-spin mr-2 w-4 h-4" /> : <Navigation className="mr-2 w-4 h-4 text-teal-600" />}
                    Current Location
                  </button>
                  
                  <div className="relative sm:w-2/3">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      {isSearching ? <Loader2 className="animate-spin w-4 h-4 text-gray-400" /> : <Search className="w-4 h-4 text-gray-400" />}
                    </div>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search area, landmark..."
                      className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg shadow-sm focus:ring-teal-500 focus:border-teal-500 text-sm"
                    />
                    
                    {/* Search Suggestions Dropdown */}
                    {showSuggestions && searchResults.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto sm:text-sm">
                        {searchResults.map((result, idx) => (
                          <div
                            key={idx}
                            className="cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-teal-50 text-gray-900"
                            onClick={() => selectSearchResult(result)}
                          >
                            <span className="block truncate">{result.display_name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="h-64 sm:h-72 w-full rounded-lg overflow-hidden border border-gray-200 shadow-inner z-0">
                <MapPicker location={location} onLocationSelect={handleMapSelect} />
              </div>

              {location && (
                <div className="mt-4 p-4 bg-teal-50 border border-teal-200 rounded-lg flex items-start">
                  <MapPin className="w-5 h-5 text-teal-600 mr-3 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold text-teal-900">Selected Location</h4>
                    <p className="text-sm text-teal-800 mt-1 leading-relaxed">
                      {address || `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Analyze Button */}
            <div className="pt-6">
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={isAnalyzing || (!title || !description || !location || !image)}
                className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-lg shadow-md text-base font-bold text-white bg-teal-800 hover:bg-teal-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 transition-all"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="animate-spin mr-3 w-5 h-5" /> 
                    Analyzing Report with AI...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-3 w-5 h-5 text-teal-200" />
                    {aiResults && isFormDirty ? 'Re-analyze with AI' : 'Analyze Content with AI'}
                  </>
                )}
              </button>
            </div>

            {/* AI Results Section */}
            {aiResults && !isFormDirty && !isAnalyzing && (
              <div className="mt-8 pt-8 border-t border-gray-200 animate-fade-in-up">
                <div className="bg-gradient-to-br from-white to-teal-50/50 border border-teal-100 rounded-xl p-6 shadow-sm mb-6">
                  <div className="flex items-center mb-6">
                    <Sparkles className="w-5 h-5 text-teal-600 mr-2" />
                    <h3 className="text-lg font-bold text-teal-900">AI Verification Review</h3>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm flex flex-col justify-center items-center text-center">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Category</span>
                      <strong className="text-sm text-gray-800">{aiResults.category}</strong>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm flex flex-col justify-center items-center text-center">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Severity</span>
                      <strong className={`text-sm font-bold
                        ${aiResults.severity === 'HIGH' ? 'text-red-600' : ''}
                        ${aiResults.severity === 'MEDIUM' ? 'text-orange-500' : ''}
                        ${aiResults.severity === 'LOW' ? 'text-green-600' : ''}
                      `}>{aiResults.severity}</strong>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm flex flex-col justify-center items-center text-center">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Priority</span>
                      <strong className={`text-sm font-bold
                        ${aiResults.priority === 'HIGH' ? 'text-red-600' : ''}
                        ${aiResults.priority === 'MEDIUM' ? 'text-orange-500' : ''}
                        ${aiResults.priority === 'LOW' ? 'text-green-600' : ''}
                      `}>{aiResults.priority}</strong>
                    </div>
                    <div className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm flex flex-col justify-center items-center text-center">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Confidence</span>
                      <strong className="text-sm text-teal-700">{aiResults.confidence}%</strong>
                    </div>
                  </div>

                  {aiResults.duplicate?.isDuplicate && (
                    <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                      <h4 className="text-sm font-bold text-orange-900 mb-2 flex items-center">
                        <AlertCircle className="w-4 h-4 mr-2" />
                        Possible Duplicate Detected
                      </h4>
                      <p className="text-sm text-orange-800 mb-2"><strong>Matched Report:</strong> {aiResults.duplicate.matchedReportId}</p>
                      <p className="text-sm text-orange-800 leading-relaxed bg-white/50 p-2 rounded">{aiResults.duplicate.reason}</p>
                    </div>
                  )}
                  
                  {!aiResults.duplicate?.isDuplicate && (
                    <div className="mb-6 p-4 bg-white border border-green-100 rounded-lg flex items-center shadow-sm">
                      <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                      <span className="text-sm font-medium text-green-800">No duplicate complaints detected nearby.</span>
                    </div>
                  )}

                  {aiResults.imageAnalysis && (
                    <div className="mb-6">
                      <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Image Analysis</h4>
                      <p className="text-sm text-gray-700 bg-white p-4 rounded-lg border border-gray-100 shadow-sm leading-relaxed">
                        {aiResults.imageAnalysis}
                      </p>
                    </div>
                  )}

                  <div>
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Polished Description</h4>
                    <p className="text-xs text-teal-600 mb-2 font-medium">Review and edit before final submission:</p>
                    <textarea
                      value={aiResults.polishedDescription || ''}
                      onChange={(e) => setAiResults({...aiResults, polishedDescription: e.target.value})}
                      rows={5}
                      className="block w-full rounded-lg border-teal-200 shadow-sm focus:border-teal-500 focus:ring-teal-500 p-4 border bg-white text-sm text-gray-800 leading-relaxed"
                    />
                  </div>
                </div>

                {aiResults.duplicate?.isDuplicate && !isEditing ? (
                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="flex-1">
                        <IssueUpvote issueId={aiResults.duplicate.matchedReportId} variant="button" />
                      </div>
                      <div className="flex-1">
                        <IssueComments issueId={aiResults.duplicate.matchedReportId} variant="button" />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="w-full flex justify-center py-4 px-4 border border-gray-300 rounded-lg shadow-sm text-lg font-bold text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                    >
                      {isSubmitting ? <Loader2 className="animate-spin mr-3 w-6 h-6" /> : 'Report It Anyway'}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="w-full flex justify-center py-4 px-4 border border-transparent rounded-lg shadow-md text-lg font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="animate-spin mr-3 w-6 h-6" /> {isEditing ? 'Saving...' : 'Submitting Final Report...'}
                      </>
                    ) : (
                      isEditing ? 'Save Changes' : 'Submit Verified Report'
                    )}
                  </button>
                )}
              </div>
            )}
            
          </div>
        </div>
      </div>

    </div>
  );
}
