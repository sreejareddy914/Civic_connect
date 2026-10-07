import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

import ws from 'ws';
globalThis.WebSocket = ws as any;

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SECRET_KEY || '',
  { auth: { persistSession: false } }
);

async function test() {
  console.log("Setting up Admin test data...");
  
  // 1. Create an admin user
  const email = `admin-${Date.now()}@example.com`;
  console.log(`Creating admin ${email}...`);
  
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: 'password123',
    email_confirm: true
  });
  
  if (authError) {
    console.error("Error creating user:", authError);
    return;
  }
  
  const adminId = authData.user.id;
  console.log("Admin User created:", adminId);
  
  // 2. Create profile
  await supabase.from('profiles').insert({
    id: adminId,
    role: 'ADMIN',
    full_name: 'Chief Administrator'
  });
  
  console.log("Admin profile created successfully.");
  
  console.log("\n=================================");
  console.log("USE THESE CREDENTIALS TO TEST ADMIN DASHBOARD:");
  console.log("Email:", email);
  console.log("Password: password123");
  console.log("Route: http://localhost:5174/admin/dashboard");
  console.log("=================================\n");
}

test();
