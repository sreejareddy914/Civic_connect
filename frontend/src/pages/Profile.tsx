import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, Mail, Phone, LogOut, AlertCircle, Award, Shield, Star, Award as AwardIcon } from 'lucide-react';
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
      <div className="flex justify-center items-center py-20 flex-col text-center">
        <AlertCircle className="h-12 w-12 text-gray-400 mb-4" />
        <h2 className="text-xl font-medium text-gray-900">Please sign in to view your profile</h2>
        <Link to="/login" className="mt-4 text-[#40E0D0] hover:underline font-medium">Go to Login</Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin h-10 w-10 text-[#40E0D0]" />
      </div>
    );
  }

  const getBadgeIcon = (level: string) => {
    switch (level) {
      case 'Civic Champion': return <Shield className="w-5 h-5 text-purple-600" />;
      case 'Community Leader': return <AwardIcon className="w-5 h-5 text-indigo-600" />;
      case 'Active Citizen': return <Star className="w-5 h-5 text-blue-600" />;
      default: return <Award className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#1A3636] font-serif">My Profile</h1>
      </div>

      {/* Civic Reputation Card */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl shadow-sm border border-indigo-100 p-6 mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-indigo-900 tracking-wider uppercase mb-1">Civic Reputation</h2>
          <div className="flex items-center gap-3">
            <span className="text-3xl font-black text-indigo-700">{profile?.civic_points || 0}</span>
            <span className="text-indigo-600 font-medium">Points</span>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm border border-indigo-100">
            {getBadgeIcon(profile?.civic_level || 'New Citizen')}
            <span className="font-bold text-indigo-900">{profile?.civic_level || 'New Citizen'}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div className="p-8 border-b border-gray-200 bg-[#FAF9F6] flex items-center gap-6">
          <div className="w-24 h-24 rounded-full bg-[#1A3636] text-white flex items-center justify-center text-4xl font-bold shadow-inner">
            {profile?.full_name?.charAt(0).toUpperCase() || session.user.email?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{profile?.full_name || 'Citizen User'}</h2>
            <div className="mt-1 flex items-center text-gray-600">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                {profile?.role || 'CITIZEN'}
              </span>
              <span className="mx-2">•</span>
              <span className="text-sm">Joined {new Date(profile?.created_at || session.user.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        <div className="p-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-6 font-serif">Contact Information</h3>
          
          <div className="space-y-6">
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center mr-4">
                <Mail className="h-5 w-5 text-gray-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Email Address</p>
                <p className="text-base text-gray-900">{session.user.email}</p>
              </div>
            </div>
            
            <div className="flex items-center">
              <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center mr-4">
                <Phone className="h-5 w-5 text-gray-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Phone Number</p>
                <p className="text-base text-gray-900">{profile?.phone_number || 'Not provided'}</p>
              </div>
            </div>
          </div>

          <div className="mt-10 pt-8 border-t border-gray-200">
            <button 
              onClick={handleSignOut}
              className="flex items-center text-red-600 hover:text-red-800 font-medium transition-colors"
            >
              <LogOut className="h-5 w-5 mr-2" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
