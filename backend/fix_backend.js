"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
// modify routes/issues.ts
let issuesContent = fs_1.default.readFileSync('/Users/sreejareddy/Desktop/klh/backend/src/routes/issues.ts', 'utf8');
// replace the supabase fetch for openIssues to include issue_media
issuesContent = issuesContent.replace(/.select\('id, title, description, category, latitude, longitude'\)/g, `.select('id, title, description, category, latitude, longitude, issue_media ( storage_path )')`);
fs_1.default.writeFileSync('/Users/sreejareddy/Desktop/klh/backend/src/routes/issues.ts', issuesContent);
console.log('Modified routes/issues.ts select query');
//# sourceMappingURL=fix_backend.js.map