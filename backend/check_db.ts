import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SECRET_KEY || ''
);

async function check() {
  const { data, error } = await supabase.from('issues').select('*, issue_media(*)').limit(1);
  console.log(JSON.stringify(data, null, 2));
  console.log(error);
}
check();
