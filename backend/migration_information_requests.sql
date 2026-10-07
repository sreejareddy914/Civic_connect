-- ============================================================
-- CIVICCONNECT: Information Requests & Responses Schema
-- ============================================================

-- 1. Table for Admin Information Requests
CREATE TABLE IF NOT EXISTS issue_information_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID REFERENCES issues(id) ON DELETE CASCADE NOT NULL,
    requested_by UUID REFERENCES profiles(id) NOT NULL,
    citizen_id UUID REFERENCES profiles(id) NOT NULL,
    message TEXT NOT NULL,
    request_type VARCHAR(50) DEFAULT 'GENERAL_CLARIFICATION' NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' NOT NULL CHECK (status IN ('PENDING', 'RESPONDED', 'CLOSED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    responded_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_info_requests_issue_id ON issue_information_requests(issue_id);
CREATE INDEX IF NOT EXISTS idx_info_requests_citizen_id ON issue_information_requests(citizen_id);
CREATE INDEX IF NOT EXISTS idx_info_requests_status ON issue_information_requests(status);

-- 2. Table for Citizen Responses
CREATE TABLE IF NOT EXISTS issue_information_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES issue_information_requests(id) ON DELETE CASCADE NOT NULL,
    issue_id UUID REFERENCES issues(id) ON DELETE CASCADE NOT NULL,
    citizen_id UUID REFERENCES profiles(id) NOT NULL,
    message TEXT NOT NULL,
    media_id UUID REFERENCES issue_media(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_request_response UNIQUE(request_id)
);

CREATE INDEX IF NOT EXISTS idx_info_responses_request_id ON issue_information_responses(request_id);
CREATE INDEX IF NOT EXISTS idx_info_responses_issue_id ON issue_information_responses(issue_id);

-- 3. Row Level Security Policies
ALTER TABLE issue_information_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_information_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and affected citizens can view requests" 
ON issue_information_requests FOR SELECT 
USING (auth.uid() = citizen_id OR auth.uid() = requested_by OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN');

CREATE POLICY "Admins and affected citizens can view responses" 
ON issue_information_responses FOR SELECT 
USING (auth.uid() = citizen_id OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'ADMIN');
