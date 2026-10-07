const { createClient } = require('@supabase/supabase-js');
globalThis.WebSocket = require('ws');
const supabase = createClient(
  'https://gcgftzdojxyyjrqftpvv.supabase.co', 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjZ2Z0emRvanh5eWpycWZ0cHZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA0MTcwMzksImV4cCI6MjEwNTk5MzAzOX0.ueBC39m9GWxPZ93h-uJiqIt1vq0bveWHk3Kj4upIHgQ', 
  { auth: { persistSession: false }}
);
async function run() {
  const { data, error } = await supabase.from('issue_media').select('*').limit(5);
  console.log("ANON MEDIA: ", JSON.stringify(data, null, 2), error);
}
run();
