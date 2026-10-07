import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!);

async function getUser() {
  const { data, error } = await supabase.from('users').select('id').limit(1);
  if (error) {
    console.error("Error:", error.message);
  } else {
    console.log("Users:", data);
  }
}
getUser();
