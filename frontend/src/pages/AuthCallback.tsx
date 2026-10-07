import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2 } from 'lucide-react';

export default function AuthCallback() {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    const handleAuthCallback = async () => {
      try {
        // Parse error parameters from query string or URL hash
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));

        const error = urlParams.get('error') || hashParams.get('error');
        const errorDescription =
          urlParams.get('error_description') ||
          hashParams.get('error_description') ||
          urlParams.get('message');

        if (error) {
          throw new Error(errorDescription || error || 'Authentication failed');
        }

        // If PKCE authorization code is present in URL, exchange it for session
        const code = urlParams.get('code');
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.error('Error exchanging code for session:', exchangeError);
            // Don't throw immediately, supabase-js might have auto-detected or established session
          }
        }

        // Check if session is established
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        if (session?.user) {
          if (isMounted) {
            await redirectBasedOnRole(session.user.id, session.user);
          }
          return;
        }

        // If session not ready yet, listen for auth state change
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
          if (currentSession?.user) {
            subscription.unsubscribe();
            if (isMounted) {
              await redirectBasedOnRole(currentSession.user.id, currentSession.user);
            }
          }
        });

        // Safety fallback timeout
        const timeoutId = setTimeout(() => {
          subscription.unsubscribe();
          if (isMounted) {
            navigate('/login', { replace: true });
          }
        }, 5000);

        return () => {
          clearTimeout(timeoutId);
          subscription.unsubscribe();
        };
      } catch (err: any) {
        console.error('Auth callback error:', err);
        if (isMounted) {
          setErrorMsg(err.message || 'Failed to complete sign in.');
          setTimeout(() => {
            if (isMounted) {
              navigate('/login', { replace: true });
            }
          }, 3500);
        }
      }
    };

    const redirectBasedOnRole = async (userId: string, user?: any) => {
      try {
        let { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .maybeSingle();

        // If this is a new OAuth user with no profile record, attempt to bootstrap
        if (!profile && user) {
          try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
            await fetch(`${apiUrl}/profile/bootstrap`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: userId,
                email: user.email,
                full_name:
                  user.user_metadata?.full_name ||
                  user.user_metadata?.name ||
                  user.email?.split('@')[0] ||
                  'Citizen',
              }),
            });

            const { data: bootstrappedProfile } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', userId)
              .maybeSingle();

            profile = bootstrappedProfile;
          } catch (bootstrapErr) {
            console.error('Profile bootstrap attempt error:', bootstrapErr);
          }
        }

        if (profile?.role === 'WORKER') {
          navigate('/worker/dashboard', { replace: true });
        } else if (profile?.role === 'ADMIN') {
          navigate('/admin/dashboard', { replace: true });
        } else {
          // Default to citizen dashboard
          navigate('/dashboard', { replace: true });
        }
      } catch (e) {
        console.error('Error fetching role during callback:', e);
        navigate('/dashboard', { replace: true });
      }
    };

    handleAuthCallback();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      {errorMsg ? (
        <div className="text-center p-6 bg-white rounded-lg shadow-sm border border-red-100 max-w-md w-full">
          <p className="text-red-600 font-semibold mb-2">Authentication Failed</p>
          <p className="text-sm text-gray-600 mb-4">{errorMsg}</p>
          <p className="text-xs text-gray-400">Redirecting to login...</p>
        </div>
      ) : (
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-800">Completing sign in...</h2>
          <p className="text-sm text-gray-500 mt-1">Please wait while we set up your session and redirect you.</p>
        </div>
      )}
    </div>
  );
}
