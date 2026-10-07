import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY || ''
);

async function test() {
  console.log("Testing frontend sign up...");
  const { data, error } = await supabase.auth.signUp({
    email: `test-anon-${Date.now()}@example.com`,
    password: 'password123',
  });
  console.log({ data, error });
}
test();
