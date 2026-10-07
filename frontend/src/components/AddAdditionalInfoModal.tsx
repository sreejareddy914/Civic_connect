import React, { useState, useRef } from 'react';
import { Camera, Upload, X, Loader2, CheckCircle2, AlertTriangle, FileText } from 'lucide-react';
import { citizenApi, type InformationRequest } from '../services/citizenApi';

interface AddAdditionalInfoModalProps {
  request: InformationRequest;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddAdditionalInfoModal({
  request,
  isOpen,
  onClose,
  onSuccess
}: AddAdditionalInfoModalProps) {
  const [responseText, setResponseText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      const url = URL.createObjectURL(selected);
      setPreviewUrl(url);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!responseText.trim()) {
      setError('Please provide your response message or description.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await citizenApi.submitAdditionalInformation({
        issueId: request.issue_id,
        requestId: request.id,
        responseText: responseText.trim(),
        file
      });

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Submission failed:', err);
      setError(err.message || 'Failed to submit additional information.');
    } finally {
      setSubmitting(false);
    }
  };

  const complaintTitle = request.issue?.title || 'Civic Complaint';
  const complaintCode = request.issue?.code ? ` (${request.issue.code})` : '';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-gray-100 animate-in fade-in zoom-in duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-white/20 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Add Additional Information</h3>
              <p className="text-xs text-amber-100">Response to Municipal Administration</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 hover:bg-white/20 rounded-lg text-white/80 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        {success ? (
          <div className="p-8 text-center space-y-3">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h4 className="text-lg font-bold text-gray-900">Additional Information Submitted!</h4>
            <p className="text-sm text-gray-600">
              Your response has been sent to the Admin. The complaint has returned to the active review queue.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

            {/* Complaint summary banner */}
            <div className="bg-gray-50 border border-gray-200/80 rounded-xl p-3.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Complaint</span>
                {request.issue?.code && (
                  <span className="text-xs font-bold px-2 py-0.5 bg-gray-200 text-gray-700 rounded">
                    {request.issue.code}
                  </span>
                )}
              </div>
              <p className="font-bold text-sm text-gray-900">{complaintTitle}{complaintCode}</p>
            </div>

            {/* Exact Admin Request Message */}
            <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800">
                <FileText className="h-3.5 w-3.5" />
                <span>Admin Request Message:</span>
              </div>
              <p className="text-xs text-amber-900 bg-white/80 p-2.5 rounded-lg border border-amber-100 font-medium whitespace-pre-wrap leading-relaxed">
                "{request.message}"
              </p>
            </div>

            {/* Response textarea */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                Your Additional Information / Response <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={4}
                required
                value={responseText}
                onChange={(e) => setResponseText(e.target.value)}
                placeholder="Provide the requested details, clarification, landmark, or context..."
                className="w-full px-3.5 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all placeholder:text-gray-400"
              />
            </div>

            {/* Evidence Photo Upload */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-gray-800 uppercase tracking-wider">
                Additional Evidence (Optional)
              </label>

              {/* Hidden file inputs for Camera and File Picker */}
              <input 
                type="file" 
                ref={cameraInputRef} 
                accept="image/*" 
                capture="environment" 
                onChange={handleFileChange} 
                className="hidden" 
              />
              <input 
                type="file" 
                ref={fileInputRef} 
                accept="image/*" 
                onChange={handleFileChange} 
                className="hidden" 
              />

              {previewUrl ? (
                <div className="relative rounded-xl border border-gray-200 overflow-hidden bg-gray-50 p-2 flex items-center gap-3">
                  <img 
                    src={previewUrl} 
                    alt="Preview" 
                    className="w-16 h-16 object-cover rounded-lg border border-gray-200" 
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{file?.name}</p>
                    <p className="text-[10px] text-gray-400">{file ? (file.size / 1024).toFixed(1) + ' KB' : ''}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                    title="Remove Image"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 border-2 border-dashed border-gray-300 hover:border-amber-500 rounded-xl text-xs font-semibold text-gray-700 hover:text-amber-700 bg-gray-50/50 hover:bg-amber-50/30 transition-all"
                  >
                    <Camera className="h-4 w-4 text-amber-600" />
                    <span>Take a Photo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 border-2 border-dashed border-gray-300 hover:border-amber-500 rounded-xl text-xs font-semibold text-gray-700 hover:text-amber-700 bg-gray-50/50 hover:bg-amber-50/30 transition-all"
                  >
                    <Upload className="h-4 w-4 text-amber-600" />
                    <span>Upload a File</span>
                  </button>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2.5 text-xs font-bold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !responseText.trim()}
                className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <span>Submit Additional Information</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
