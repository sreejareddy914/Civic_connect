import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';

export interface InteractionState {
  upvoteCount: number;
  commentCount: number;
  hasCurrentUserUpvoted: boolean;
  isLoading: boolean;
}

interface InteractionContextType {
  interactions: Record<string, InteractionState>;
  fetchInteraction: (issueId: string) => Promise<void>;
  updateInteraction: (issueId: string, partialData: Partial<InteractionState>) => void;
}

const InteractionContext = createContext<InteractionContextType | undefined>(undefined);

export function InteractionProvider({ children }: { children: ReactNode }) {
  const [interactions, setInteractions] = useState<Record<string, InteractionState>>({});

  const fetchInteraction = useCallback(async (issueId: string) => {
    // If it's currently loading or already loaded, don't spam requests unless forced
    // But we want to ensure fresh data, let's set loading state
    setInteractions(prev => ({
      ...prev,
      [issueId]: { ...(prev[issueId] || { upvoteCount: 0, commentCount: 0, hasCurrentUserUpvoted: false }), isLoading: true }
    }));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const headers: Record<string, string> = {};
      if (session) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`${import.meta.env.VITE_API_URL}/issues/${issueId}/interactions`, {
        headers
      });
      
      if (res.ok) {
        const data = await res.json();
        setInteractions(prev => ({
          ...prev,
          [issueId]: {
            upvoteCount: data.upvoteCount,
            commentCount: data.commentCount,
            hasCurrentUserUpvoted: data.hasCurrentUserUpvoted,
            isLoading: false
          }
        }));
      } else {
        // Just reset loading
        setInteractions(prev => ({
          ...prev,
          [issueId]: { ...(prev[issueId] || { upvoteCount: 0, commentCount: 0, hasCurrentUserUpvoted: false }), isLoading: false }
        }));
      }
    } catch (e) {
      setInteractions(prev => ({
        ...prev,
        [issueId]: { ...(prev[issueId] || { upvoteCount: 0, commentCount: 0, hasCurrentUserUpvoted: false }), isLoading: false }
      }));
    }
  }, []);

  const updateInteraction = useCallback((issueId: string, partialData: Partial<InteractionState>) => {
    setInteractions(prev => ({
      ...prev,
      [issueId]: {
        ...(prev[issueId] || { upvoteCount: 0, commentCount: 0, hasCurrentUserUpvoted: false, isLoading: false }),
        ...partialData
      }
    }));
  }, []);

  return (
    <InteractionContext.Provider value={{ interactions, fetchInteraction, updateInteraction }}>
      {children}
    </InteractionContext.Provider>
  );
}

export function useInteraction(issueId: string) {
  const context = useContext(InteractionContext);
  if (!context) {
    throw new Error('useInteraction must be used within an InteractionProvider');
  }
  
  const interaction = context.interactions[issueId] || {
    upvoteCount: 0,
    commentCount: 0,
    hasCurrentUserUpvoted: false,
    isLoading: true
  };

  useEffect(() => {
    if (!context.interactions[issueId]) {
      context.fetchInteraction(issueId);
    }
  }, [issueId, context.interactions, context.fetchInteraction]);

  return {
    interaction,
    fetchInteraction: () => context.fetchInteraction(issueId),
    updateInteraction: (data: Partial<InteractionState>) => context.updateInteraction(issueId, data)
  };
}
