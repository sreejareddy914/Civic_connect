-- Civic Points System Update

-- Add civic_points and civic_level to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS civic_points INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS civic_level VARCHAR(50) DEFAULT 'New Citizen' NOT NULL;

-- Create civic_point_transactions table
CREATE TABLE IF NOT EXISTS civic_point_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) NOT NULL,
    points INTEGER NOT NULL,
    action_type TEXT NOT NULL,
    reference_id TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_action_reference UNIQUE(user_id, action_type, reference_id)
);

ALTER TABLE civic_point_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transactions" 
ON civic_point_transactions FOR SELECT 
USING (auth.uid() = user_id);

-- Issue Verifications (Help Verify)
-- Drop old table if exists just in case since we are updating it.
DROP TABLE IF EXISTS issue_verifications;

CREATE TABLE IF NOT EXISTS issue_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id UUID REFERENCES issues(id) NOT NULL,
    verifier_id UUID REFERENCES profiles(id) NOT NULL,
    result VARCHAR(50) NOT NULL, -- CONFIRMED_PRESENT, NOT_VERIFIED, NO_LONGER_PRESENT
    verification_note TEXT NOT NULL,
    verifier_latitude DOUBLE PRECISION,
    verifier_longitude DOUBLE PRECISION,
    distance_from_issue DOUBLE PRECISION,
    evidence_media_id UUID REFERENCES issue_media(id), -- Nullable, since negative verification doesn't need photo
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    -- Prevent multiple verifications for the same issue by the same user
    CONSTRAINT unique_verification UNIQUE(issue_id, verifier_id)
);

ALTER TABLE issue_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Verifications are viewable by everyone" ON issue_verifications FOR SELECT USING (true);
