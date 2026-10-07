import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, Mail, Phone, LogOut, AlertCircle, Award, Shield, Star, Award as AwardIcon, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Profile({ session }: { session: any }) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [session]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (!session) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="p-4 bg-teal-50 rounded-full mb-4">
          <AlertCircle className="h-10 w-10 text-teal-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Please sign in to view your profile</h2>
        <p className="text-sm text-gray-500 mb-6 max-w-sm">Manage your account information, notification preferences, and civic achievements.</p>
        <Link 
          to="/login" 
          className="px-6 py-2.5 bg-[#1A3636] hover:bg-[#254d4d] text-white font-bold rounded-xl text-sm shadow-sm transition"
        >
          Go to Sign In
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center py-20">
        <Loader2 className="animate-spin h-10 w-10 text-[#0d9488] mb-3" />
        <p className="text-xs text-gray-500 font-medium">Loading profile details...</p>
      </div>
    );
  }

  const getBadgeIcon = (level: string) => {
    switch (level) {
      case 'Civic Champion': return <Shield className="w-5 h-5 text-purple-600" />;
      case 'Community Leader': return <AwardIcon className="w-5 h-5 text-indigo-600" />;
      case 'Active Citizen': return <Star className="w-5 h-5 text-blue-600" />;
      default: return <Award className="w-5 h-5 text-teal-600" />;
    }
  };

  const userInitial = profile?.full_name?.charAt(0).toUpperCase() || session.user.email?.charAt(0).toUpperCase() || 'C';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="border-b border-gray-200/80 pb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
          Citizen Profile
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Manage your account credentials, review your civic reputation points, and community level
        </p>
      </div>

      {/* Civic Reputation Card */}
      <div className="bg-gradient-to-br from-[#1A3636] to-[#264e4e] text-white rounded-2xl shadow-sm p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative overflow-hidden">
        <div className="relative z-10 space-y-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-teal-200/90 bg-white/10 px-2.5 py-0.5 rounded-md">
              Community Impact
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">Civic Reputation & Rank</h2>
          <p className="text-xs text-teal-100/80 max-w-md">
            Every reported issue and verified complaint contributes points toward building a better city.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-4 bg-white/10 backdrop-blur-xs p-4 rounded-xl border border-white/20">
          <div className="p-3 bg-white rounded-xl shadow-xs text-[#1A3636]">
            {getBadgeIcon(profile?.civic_level || 'New Citizen')}
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-teal-200 tracking-wider">Level & Points</p>
            <p className="text-lg font-black text-white">{profile?.civic_points || 0} Points</p>
            <p className="text-xs text-teal-300 font-semibold">{profile?.civic_level || 'New Citizen'}</p>
          </div>
        </div>
      </div>

      {/* Profile Details Card */}
      <div className="bg-white rounded-2xl shadow-xs border border-gray-200 overflow-hidden">
        <div className="p-6 sm:p-8 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="w-20 h-20 rounded-2xl bg-[#1A3636] text-[#40E0D0] flex items-center justify-center text-3xl font-black shadow-xs shrink-0 border border-[#254646]">
            {userInitial}
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-extrabold text-gray-900">{profile?.full_name || 'Citizen User'}</h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md font-bold bg-teal-50 text-teal-800 border border-teal-200">
                {profile?.role || 'CITIZEN'}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                Joined {new Date(profile?.created_at || session.user.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            Contact & Identification Details
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center mr-4 text-gray-500 shadow-2xs shrink-0">
                <Mail className="h-5 w-5 text-teal-700" />
              </div>
              <div className="overflow-hidden">
                <p className="text-[11px] font-bold uppercase text-gray-400 tracking-wider">Email Address</p>
                <p className="text-xs sm:text-sm font-semibold text-gray-900 truncate">{session.user.email}</p>
              </div>
            </div>
            
            <div className="flex items-center p-4 bg-gray-50 rounded-xl border border-gray-100">
              <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center mr-4 text-gray-500 shadow-2xs shrink-0">
                <Phone className="h-5 w-5 text-teal-700" />
              </div>
              <div className="overflow-hidden">
                <p className="text-[11px] font-bold uppercase text-gray-400 tracking-wider">Phone Number</p>
                <p className="text-xs sm:text-sm font-semibold text-gray-900 truncate">
                  {profile?.phone_number || 'Not provided'}
                </p>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-400">Authenticated via Supabase Auth</span>
            <button 
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-xl transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
