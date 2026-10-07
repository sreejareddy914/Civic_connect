import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowUp, Check, Loader2 } from 'lucide-react';
import { useInteraction } from '../contexts/InteractionContext';

export default function IssueUpvote({ 
  issueId, 
  variant = 'button' 
}: { 
  issueId: string, 
  variant?: 'button' | 'compact' 
}) {
  const { interaction, updateInteraction } = useInteraction(issueId);
  const [isVoting, setIsVoting] = useState(false);


  const handleUpvote = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (interaction.hasCurrentUserUpvoted || isVoting || interaction.isLoading) return;

    setIsVoting(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      alert("Please sign in to upvote.");
      setIsVoting(false);
      return;
    }

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/issues/${issueId}/vote`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const data = await res.json();
      if (res.ok) {
        updateInteraction({ 
          hasCurrentUserUpvoted: data.upvoted,
          upvoteCount: data.upvoteCount
        });
      } else {
        if (data.error && data.error.includes("already voted")) {
          updateInteraction({ hasCurrentUserUpvoted: true, upvoteCount: data.upvoteCount });
        } else {
          alert('Unable to add upvote. Please try again.');
        }
      }
    } catch (err) {
      alert('Unable to add upvote. Please try again.');
    } finally {
      setIsVoting(false);
    }
  };

  if (variant === 'compact') {
    return (
      <div 
        onClick={handleUpvote}
        className={`flex items-center text-sm transition-colors ${
          interaction.hasCurrentUserUpvoted ? 'text-[#40E0D0] cursor-default font-medium' : 'text-gray-500 hover:text-[#40E0D0] cursor-pointer'
        } ${isVoting || interaction.isLoading ? 'opacity-70 pointer-events-none' : ''}`}
        title={interaction.hasCurrentUserUpvoted ? "You upvoted this" : "Click to upvote"}
      >
        <ArrowUp className="w-4 h-4 mr-1.5" />
        Upvotes {interaction.upvoteCount}
      </div>
    );
  }

  // button variant
  return (
    <button 
      onClick={handleUpvote}
      disabled={isVoting || interaction.isLoading || interaction.hasCurrentUserUpvoted}
      className={`w-full flex items-center justify-center py-2 px-4 rounded-lg text-sm font-bold border transition-colors ${
        interaction.hasCurrentUserUpvoted 
          ? 'bg-green-50 border-green-200 text-green-700 cursor-default' 
          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-[#1A3636] hover:border-[#1A3636]'
      }`}
    >
      {isVoting ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : interaction.hasCurrentUserUpvoted ? (
        <Check className="w-4 h-4 mr-2" />
      ) : (
        <ArrowUp className="w-4 h-4 mr-2" />
      )}
      {interaction.hasCurrentUserUpvoted ? 'Upvoted' : 'Upvote'} <span className="ml-2 bg-black/5 px-2 py-0.5 rounded-full">{interaction.upvoteCount}</span>
    </button>
  );
}
