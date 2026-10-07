import { Router } from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

import ws from 'ws';
globalThis.WebSocket = ws as any;

const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SECRET_KEY || '',
  { auth: { persistSession: false } }
);

// This endpoint is called after a user signs up on the frontend
// to bootstrap their record in the 'profiles' table securely.
router.post('/bootstrap', async (req: any, res: any) => {
  try {
    const { id, email, full_name, phone_number } = req.body;

    if (!id || !email || !full_name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Insert new profile with 'CITIZEN' role by default
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        id, // This matches the auth.users UUID
        role: 'CITIZEN',
        full_name,
        phone_number: phone_number || null,
      })
      .select()
      .single();

    if (error) {
      // If the profile already exists, just return ok (idempotent)
      if (error.code === '23505') {
        return res.status(200).json({ message: 'Profile already exists' });
      }
      throw error;
    }

    res.status(201).json({ message: 'Profile created', profile: data });
  } catch (error: any) {
    console.error('Error bootstrapping profile:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

export default router;
