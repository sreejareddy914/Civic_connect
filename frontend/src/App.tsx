import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { AlertTriangle } from 'lucide-react';

import ReportIssue from './pages/ReportIssue';
import Login from './pages/Login';
import Signup from './pages/Signup';
import AuthCallback from './pages/AuthCallback';
import Dashboard from './pages/Dashboard';
import TrackIssues from './pages/TrackIssues';
import IssueDetails from './pages/IssueDetails';
import NearbyIssues from './pages/NearbyIssues';
import CommunityMap from './pages/CommunityMap';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';

import CitizenLayout from './components/CitizenLayout';
import WorkerLayout from './components/WorkerLayout';
import { InteractionProvider } from './contexts/InteractionContext';

import WorkerDashboard from './pages/worker/WorkerDashboard';
import WorkerTaskDetails from './pages/worker/WorkerTaskDetails';
import WorkerMap from './pages/worker/WorkerMap';
import WorkerProfile from './pages/worker/WorkerProfile';
import WorkerNotifications from './pages/worker/WorkerNotifications';
import WorkerPerformance from './pages/worker/WorkerPerformance';

import AdminLayout from './components/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminIssueList from './pages/admin/AdminIssueList';
import AdminIssueDetails from './pages/admin/AdminIssueDetails';
import AdminDepartments from './pages/admin/AdminDepartments';
import AdminSLA from './pages/admin/AdminSLA';
import AdminMap from './pages/admin/AdminMap';
import AdminHotspots from './pages/admin/AdminHotspots';
import AdminPredictions from './pages/admin/AdminPredictions';
import AdminNotifications from './pages/admin/AdminNotifications';
import AdminWorkers from './pages/admin/AdminWorkers';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import AdminSettings from './pages/admin/AdminSettings';

function App() {
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <InteractionProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          
          {/* Citizen Routes wrapped in Layout */}
          <Route element={<CitizenLayout session={session} />}>
            <Route path="/report" element={<ReportIssue />} />
            <Route path="/dashboard" element={<Dashboard session={session} />} />
            <Route path="/track" element={<TrackIssues session={session} />} />
            <Route path="/issues/:id" element={<IssueDetails session={session} />} />
            <Route path="/issues/:id/edit" element={<ReportIssue isEditing={true} />} />
            <Route path="/nearby" element={<NearbyIssues session={session} />} />
            <Route path="/map" element={<CommunityMap session={session} />} />
            <Route path="/notifications" element={<Notifications session={session} />} />
            <Route path="/profile" element={<Profile session={session} />} />
          </Route>
          
          {/* Worker Routes wrapped in WorkerLayout */}
          <Route element={<WorkerLayout session={session} />}>
            <Route path="/worker" element={<Navigate to="/worker/dashboard" replace />} />
            <Route path="/worker/dashboard" element={<WorkerDashboard session={session} />} />
            <Route path="/worker/tasks/:id" element={<WorkerTaskDetails session={session} />} />
            <Route path="/worker/assignments/:id" element={<WorkerTaskDetails session={session} />} />
            <Route path="/worker/map" element={<WorkerMap />} />
            <Route path="/worker/performance" element={<WorkerPerformance />} />
            <Route path="/worker/profile" element={<WorkerProfile />} />
            <Route path="/worker/notifications" element={<WorkerNotifications />} />
          </Route>

          {/* Admin Routes wrapped in AdminLayout */}
          <Route element={<AdminLayout session={session} />}>
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/issues" element={<AdminIssueList />} />
            <Route path="/admin/issues/:id" element={<AdminIssueDetails />} />
            <Route path="/admin/departments" element={<AdminDepartments />} />
            <Route path="/admin/workers" element={<AdminWorkers />} />
            <Route path="/admin/sla" element={<AdminSLA />} />
            <Route path="/admin/map" element={<AdminMap />} />
            <Route path="/admin/hotspots" element={<AdminHotspots />} />
            <Route path="/admin/analytics" element={<AdminAnalytics />} />
            <Route path="/admin/predictions" element={<AdminPredictions />} />
            <Route path="/admin/notifications" element={<AdminNotifications />} />
            <Route path="/admin/settings" element={<AdminSettings />} />
          </Route>

          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/worker" element={<Navigate to="/worker/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </InteractionProvider>
  );
}

function Home() {
  return (
    <div className="text-center">
      <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl sm:tracking-tight lg:text-6xl">
        Report civic issues in your city.
      </h1>
      <p className="mt-5 max-w-xl mx-auto text-xl text-gray-500">
        CivicConnect uses AI to quickly categorize, prioritize, and route your reported issues to the right department.
      </p>
      
      <div className="mt-10 flex justify-center gap-4">
        <Link
          to="/report"
          className="px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 md:py-4 md:text-lg md:px-10 flex items-center"
        >
          <AlertTriangle className="mr-2" /> Report an Issue
        </Link>
      </div>
    </div>
  );
}

export default App;
