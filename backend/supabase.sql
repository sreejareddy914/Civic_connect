-- CivicConnect Database Schema

-- Enums
CREATE TYPE user_role AS ENUM ('CITIZEN', 'ADMIN', 'WORKER');
CREATE TYPE issue_status AS ENUM ('REPORTED', 'VERIFIED', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'RESOLVED', 'CITIZEN_VERIFICATION', 'CLOSED', 'REOPENED');
CREATE TYPE issue_severity AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE issue_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE worker_status AS ENUM ('AVAILABLE', 'BUSY', 'OFF_DUTY');

-- 1. Profiles Table
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  role user_role DEFAULT 'CITIZEN'::user_role NOT NULL,
  full_name TEXT NOT NULL,
  phone_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Departments Table
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Workers Table
CREATE TABLE workers (
  profile_id UUID REFERENCES profiles(id) PRIMARY KEY,
  department_id UUID REFERENCES departments(id) NOT NULL,
  status worker_status DEFAULT 'AVAILABLE'::worker_status NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Sequence for issue codes
CREATE SEQUENCE issue_code_seq START 1000;

-- 4. Issues Table
CREATE TABLE issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE,
  reporter_id UUID REFERENCES profiles(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address TEXT,
  status issue_status DEFAULT 'REPORTED'::issue_status NOT NULL,
  category TEXT,
  subcategory TEXT,
  severity issue_severity,
  priority issue_priority,
  department_id UUID REFERENCES departments(id),
  assigned_worker_id UUID REFERENCES workers(profile_id),
  ai_confidence FLOAT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Trigger to auto-generate code (e.g. CC-000123)
CREATE OR REPLACE FUNCTION generate_issue_code()
RETURNS TRIGGER AS $$
BEGIN
  NEW.code := 'CC-' || LPAD(nextval('issue_code_seq')::TEXT, 6, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_issue_code
BEFORE INSERT ON issues
FOR EACH ROW EXECUTE FUNCTION generate_issue_code();

-- 5. Issue Status History
CREATE TABLE issue_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID REFERENCES issues(id) NOT NULL,
  old_status issue_status,
  new_status issue_status NOT NULL,
  changed_by UUID REFERENCES profiles(id) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Issue Media
CREATE TABLE issue_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID REFERENCES issues(id) NOT NULL,
  media_type TEXT NOT NULL, -- 'ORIGINAL', 'RESOLUTION_BEFORE', 'RESOLUTION_AFTER'
  storage_path TEXT NOT NULL,
  uploaded_by UUID REFERENCES profiles(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. AI Analysis
CREATE TABLE ai_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID REFERENCES issues(id) NOT NULL,
  raw_response JSONB NOT NULL,
  parsed_output JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Worker Assignments
CREATE TABLE worker_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID REFERENCES issues(id) NOT NULL,
  worker_id UUID REFERENCES workers(profile_id) NOT NULL,
  assigned_by UUID REFERENCES profiles(id) NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. SLA Records
CREATE TABLE sla_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID REFERENCES issues(id) NOT NULL,
  department_id UUID REFERENCES departments(id) NOT NULL,
  deadline TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'ACTIVE' NOT NULL, -- 'ACTIVE', 'MET', 'BREACHED'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. Resolution Proofs
CREATE TABLE resolution_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID REFERENCES issues(id) NOT NULL,
  worker_id UUID REFERENCES workers(profile_id) NOT NULL,
  resolution_note TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE NOT NULL,
  link TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 12. Issue Supporters (for duplicate detection / backing)
CREATE TABLE issue_supporters (
  issue_id UUID REFERENCES issues(id) NOT NULL,
  supporter_id UUID REFERENCES profiles(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (issue_id, supporter_id)
);

-- 13. Comments
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID REFERENCES issues(id) NOT NULL,
  profile_id UUID REFERENCES profiles(id) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS Setup (Example policies, Backend uses service_role key to bypass)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone." ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Issues are viewable by everyone." ON issues FOR SELECT USING (true);
CREATE POLICY "Notifications are viewable by owner." ON notifications FOR SELECT USING (auth.uid() = profile_id);

-- Note: All other modifications (INSERT/UPDATE to issues, status history, etc.) 
-- are intentionally left without permissive RLS write policies.
-- The Express.js backend acts as the gatekeeper and uses the 'service_role' key 
-- to perform these operations, enforcing business logic securely.
