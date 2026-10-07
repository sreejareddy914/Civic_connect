import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { MessageSquare, Loader2, X, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useInteraction } from '../contexts/InteractionContext';

export default function IssueComments({ 
  issueId,
  variant = 'button'
}: { 
  issueId: string,
  variant?: 'button' | 'compact' 
}) {
  const { interaction, updateInteraction } = useInteraction(issueId);
  const [isOpen, setIsOpen] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (isOpen) {
      fetchComments();
    }
  }, [isOpen, issueId]);

  const fetchComments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/issues/${issueId}/comments`);
      if (res.ok) {
        const data = await res.json();
        setComments(data);
      } else {
        setError('Unable to load comments.');
      }
    } catch (err) {
      setError('Unable to load comments.');
    } finally {
      setLoading(false);
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isPosting) return;

    setIsPosting(true);
    setError(null);
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      alert("Please sign in to comment.");
      setIsPosting(false);
      return;
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/issues/${issueId}/comments`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: newComment.trim() })
      });
      
      if (res.ok) {
        const data = await res.json();
        setComments(prev => [data.comment, ...prev]);
        updateInteraction({ commentCount: data.commentCount });
        setNewComment('');
      } else {
        setError('Unable to post comment. Please try again.');
      }
    } catch (err) {
      setError('Unable to post comment. Please try again.');
    } finally {
      setIsPosting(false);
    }
  };

  // The button that triggers the modal
  const TriggerButton = () => {
    if (variant === 'compact') {
      return (
        <div 
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(true); }}
          className="flex items-center text-sm text-gray-500 hover:text-[#40E0D0] cursor-pointer transition-colors"
        >
          <MessageSquare className="w-4 h-4 mr-1.5" />
          Comments {interaction.commentCount}
        </div>
      );
    }
    
    return (
      <button 
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(true); }}
        className="w-full flex items-center justify-center py-2 px-4 rounded-lg text-sm font-bold border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 hover:text-[#1A3636] hover:border-[#1A3636] transition-colors"
      >
        <MessageSquare className="w-4 h-4 mr-2" />
        Comments <span className="ml-2 bg-black/5 px-2 py-0.5 rounded-full">{interaction.commentCount}</span>
      </button>
    );
  };

  return (
    <>
      <TriggerButton />

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}>
          <div 
            className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-[#1A3636] text-white">
              <h3 className="font-bold text-lg flex items-center">
                <MessageSquare className="w-5 h-5 mr-2 text-[#40E0D0]" />
                Comments ({interaction.commentCount})
              </h3>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              {loading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : error ? (
                <div className="text-center p-6 bg-red-50 text-red-600 rounded-lg">
                  <p className="mb-2">{error}</p>
                  <button onClick={fetchComments} className="px-4 py-1.5 bg-white border border-red-200 rounded text-sm font-medium">Retry</button>
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center p-8 text-gray-500">
                  <MessageSquare className="w-8 h-8 mx-auto mb-3 text-gray-300" />
                  <p>No comments yet. Be the first to comment!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {comments.map((comment: any) => (
                    <div key={comment.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                            <span className="text-sm font-bold text-gray-600">
                              {comment.profiles?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                            </span>
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{comment.profiles?.full_name || 'Unknown User'}</p>
                            <p className="text-xs text-gray-500">
                              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      </div>
                      <p className="text-gray-700 text-sm pl-11">{comment.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 bg-white">
              <form onSubmit={handlePostComment} className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a comment..."
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#40E0D0] focus:border-transparent text-sm"
                />
                <button
                  type="submit"
                  disabled={!newComment.trim() || isPosting}
                  className="bg-[#1A3636] text-[#40E0D0] px-4 py-2 rounded-lg font-medium hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1A3636] disabled:opacity-50 transition-colors flex items-center"
                >
                  {isPosting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
