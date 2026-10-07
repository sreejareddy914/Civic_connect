import React, { useState } from 'react';
import { Share2, Check, Copy, X, MessageCircle, Mail } from 'lucide-react';

interface ComplaintShareButtonProps {
  issueId: string;
  title: string;
  code?: string;
  category?: string;
  description?: string;
  variant?: 'button' | 'compact' | 'icon';
  className?: string;
}

export default function ComplaintShareButton({
  issueId,
  title,
  code,
  category,
  description,
  variant = 'button',
  className = '',
}: ComplaintShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const getShareUrl = () => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/issues/${issueId}`;
    }
    return `/issues/${issueId}`;
  };

  const shareUrl = getShareUrl();
  const shareText = `Check out this civic complaint on CivicConnect: "${title}"${code ? ` [Code: ${code}]` : ''}${category ? ` (${category})` : ''}. Help us raise visibility and get it resolved!`;

  const handleShareClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Check for native Web Share API support
    if (navigator.share) {
      try {
        await navigator.share({
          title: `CivicConnect: ${title}`,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') {
          // User intentionally closed the share sheet
          return;
        }
        // If navigator.share fails or is restricted, fallback to modal below
      }
    }

    // Desktop or unsupported browser fallback
    setIsOpen(true);
  };

  const handleCopyLink = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setShowToast(true);
      setTimeout(() => setCopied(false), 2500);
      setTimeout(() => setShowToast(false), 3000);
    } catch (err) {
      console.error('Failed to copy share link:', err);
    }
  };

  const shareTargets = [
    {
      name: 'WhatsApp',
      icon: (
        <MessageCircle className="w-4 h-4 shrink-0 text-emerald-600" />
      ),
      color: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200',
      url: `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText}\n\n${shareUrl}`)}`,
    },
    {
      name: 'X (Twitter)',
      icon: (
        <svg className="w-4 h-4 shrink-0 fill-current text-slate-800" viewBox="0 0 24 24">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      ),
      color: 'bg-slate-50 text-slate-800 hover:bg-slate-100 border-slate-200',
      url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
    },
    {
      name: 'Facebook',
      icon: (
        <svg className="w-4 h-4 shrink-0 fill-current text-blue-600" viewBox="0 0 24 24">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
      ),
      color: 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200',
      url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    },
    {
      name: 'Email',
      icon: (
        <Mail className="w-4 h-4 shrink-0 text-rose-600" />
      ),
      color: 'bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200',
      url: `mailto:?subject=${encodeURIComponent(`Civic Issue: ${title}`)}&body=${encodeURIComponent(`${shareText}\n\nView details: ${shareUrl}`)}`,
    },
  ];

  return (
    <>
      {variant === 'compact' ? (
        <button
          type="button"
          onClick={handleShareClick}
          className={`flex items-center text-sm text-gray-500 hover:text-teal-600 cursor-pointer transition-colors ${className}`}
          title="Share this complaint"
          aria-label="Share complaint"
        >
          <Share2 className="w-4 h-4 mr-1.5" />
          <span>Share</span>
        </button>
      ) : variant === 'icon' ? (
        <button
          type="button"
          onClick={handleShareClick}
          className={`p-2 rounded-lg text-gray-500 hover:text-teal-600 hover:bg-teal-50 border border-gray-200 transition-colors ${className}`}
          title="Share this complaint"
          aria-label="Share complaint"
        >
          <Share2 className="w-4 h-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={handleShareClick}
          className={`w-full flex items-center justify-center py-2 px-4 rounded-lg text-sm font-bold border border-gray-300 text-gray-700 bg-white hover:bg-teal-50 hover:text-teal-700 hover:border-teal-300 transition-colors shadow-2xs ${className}`}
          aria-label="Share complaint"
        >
          <Share2 className="w-4 h-4 mr-2 text-teal-600" />
          <span>Share</span>
        </button>
      )}

      {/* Share Modal Dialog */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(false);
          }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-100 flex flex-col animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-modal-title"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 px-6 border-b border-gray-100 bg-[#1A3636] text-white">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-[#40E0D0]/20 rounded-lg text-[#40E0D0]">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="share-modal-title" className="font-bold text-base text-[#FAF9F6] leading-tight">
                    Share Complaint
                  </h3>
                  <p className="text-xs text-teal-200/80">Spread awareness across your community</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-gray-300 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                aria-label="Close share dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {/* Complaint Preview Card */}
              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200/80 text-left">
                <div className="flex items-center gap-2 mb-1">
                  {code && (
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-gray-200 text-gray-700 rounded-md">
                      {code}
                    </span>
                  )}
                  {category && (
                    <span className="px-2 py-0.5 text-[10px] font-bold bg-teal-100 text-teal-800 rounded-md">
                      {category}
                    </span>
                  )}
                </div>
                <h4 className="font-bold text-sm text-gray-900 line-clamp-1">{title}</h4>
                {description && (
                  <p className="text-xs text-gray-500 line-clamp-2 mt-1">{description}</p>
                )}
              </div>

              {/* Direct Link Copy */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Complaint Link
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="flex-1 px-3 py-2 text-xs text-gray-700 bg-gray-50 border border-gray-300 rounded-xl font-mono truncate focus:outline-none select-all"
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shrink-0 shadow-2xs ${
                      copied
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[#1A3636] hover:bg-[#254d4d] text-white'
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-white" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Social Channels */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Share via Platform
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {shareTargets.map((target) => (
                    <a
                      key={target.name}
                      href={target.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-semibold transition-all ${target.color}`}
                      onClick={() => {
                        setTimeout(() => setIsOpen(false), 500);
                      }}
                    >
                      {target.icon}
                      <span>{target.name}</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 px-6 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
              <span>Anyone with the link can view this complaint</span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3.5 py-1.5 text-xs font-medium text-gray-700 hover:text-gray-900 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast notification */}
      {showToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#1A3636] text-white px-4 py-3 rounded-xl shadow-lg border border-[#40E0D0]/30 flex items-center gap-2 animate-in slide-in-from-bottom-4 duration-200">
          <Check className="w-4 h-4 text-[#40E0D0]" />
          <span className="text-xs font-medium">Complaint link copied to clipboard!</span>
        </div>
      )}
    </>
  );
}
