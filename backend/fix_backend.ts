import fs from 'fs';

// modify routes/issues.ts
let issuesContent = fs.readFileSync('/Users/sreejareddy/Desktop/klh/backend/src/routes/issues.ts', 'utf8');

// replace the supabase fetch for openIssues to include issue_media
issuesContent = issuesContent.replace(
  /.select\('id, title, description, category, latitude, longitude'\)/g,
  `.select('id, title, description, category, latitude, longitude, issue_media ( storage_path )')`
);

fs.writeFileSync('/Users/sreejareddy/Desktop/klh/backend/src/routes/issues.ts', issuesContent);
console.log('Modified routes/issues.ts select query');
