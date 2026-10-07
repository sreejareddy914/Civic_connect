const fs = require('fs');

let content = fs.readFileSync('src/routes/issues.ts', 'utf8');

// Insert authMiddleware
const authMiddlewareCode = `
const authMiddleware = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }
  const token = authHeader.split(' ')[1];
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  req.user = data.user;
  next();
};
`;

content = content.replace('const router = Router();', 'const router = Router();\n' + authMiddlewareCode);

// Add PATCH, DELETE, POST /:id/vote before export default router;
const newRoutesCode = `

router.patch('/:id', authMiddleware, upload.single('image'), async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { 
      title, originalDescription, latitude, longitude, address,
      category, severity, priority, confidence, polishedDescription, imageAnalysis,
      isDuplicate, matchedReportId, duplicateReason
    } = req.body;

    const { data: issue, error: issueError } = await supabase
      .from('issues')
      .select('reporter_id, status')
      .eq('id', id)
      .single();

    if (issueError || !issue) return res.status(404).json({ error: 'Issue not found' });
    if (issue.reporter_id !== req.user.id) return res.status(403).json({ error: 'Not authorized to edit this complaint' });
    if (issue.status !== 'REPORTED') return res.status(403).json({ error: 'This complaint can no longer be edited because it has entered review.' });

    const updates = {
      title,
      description: polishedDescription || originalDescription,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      address,
      category: category || 'Other',
      severity: severity || 'LOW',
      priority: priority || 'LOW',
      ai_confidence: parseFloat(confidence) || 0
    };

    await supabase.from('issues').update(updates).eq('id', id);

    await supabase.from('ai_analysis').delete().eq('issue_id', id);
    const isDuplicateBool = isDuplicate === 'true' || isDuplicate === true;
    await supabase.from('ai_analysis').insert({
      issue_id: id,
      raw_response: { imageAnalysis, isDuplicate: isDuplicateBool, matchedReportId, duplicateReason, originalDescription },
      parsed_output: { category, severity, priority, confidence, polishedDescription }
    });

    const imageFile = req.file;
    if (imageFile) {
      const { data: oldMedia } = await supabase.from('issue_media').select('storage_path').eq('issue_id', id).eq('media_type', 'ORIGINAL');
      if (oldMedia && oldMedia.length > 0) {
        await supabase.storage.from('issues').remove(oldMedia.map((m: any) => m.storage_path));
        await supabase.from('issue_media').delete().eq('issue_id', id).eq('media_type', 'ORIGINAL');
      }

      const fileExt = imageFile.originalname.split('.').pop();
      const filePath = \`\${id}/original.\${fileExt}\`;
      const fileBuffer = fs.readFileSync(imageFile.path);

      await supabase.storage.from('issues').upload(filePath, fileBuffer, { contentType: imageFile.mimetype, upsert: true });
      await supabase.from('issue_media').insert({ issue_id: id, media_type: 'ORIGINAL', storage_path: filePath, uploaded_by: req.user.id });
      fs.unlinkSync(imageFile.path);
    }

    res.json({ message: 'Complaint updated successfully' });
  } catch (error: any) {
    console.error('Error updating issue:', error);
    res.status(500).json({ error: 'Internal server error during update', details: error.message });
  }
});

router.delete('/:id', authMiddleware, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { data: issue, error: issueError } = await supabase
      .from('issues')
      .select('reporter_id, status')
      .eq('id', id)
      .single();

    if (issueError || !issue) return res.status(404).json({ error: 'Issue not found' });
    if (issue.reporter_id !== req.user.id) return res.status(403).json({ error: 'Not authorized to delete this complaint' });
    if (issue.status !== 'REPORTED') return res.status(403).json({ error: 'This complaint can no longer be deleted because it has entered review.' });

    // Cleanup sequence
    const { data: media } = await supabase.from('issue_media').select('storage_path').eq('issue_id', id);
    if (media && media.length > 0) {
      await supabase.storage.from('issues').remove(media.map((m: any) => m.storage_path));
    }
    
    await supabase.from('issue_media').delete().eq('issue_id', id);
    await supabase.from('ai_analysis').delete().eq('issue_id', id);
    await supabase.from('issue_supporters').delete().eq('issue_id', id);
    await supabase.from('comments').delete().eq('issue_id', id);
    await supabase.from('issues').delete().eq('id', id);

    res.json({ message: 'Complaint deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting issue:', error);
    res.status(500).json({ error: 'Internal server error during deletion', details: error.message });
  }
});

router.post('/:id/vote', authMiddleware, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    
    const { data: issue, error: issueError } = await supabase
      .from('issues')
      .select('id')
      .eq('id', id)
      .single();
      
    if (issueError || !issue) return res.status(404).json({ error: 'Issue not found' });

    const { error } = await supabase
      .from('issue_supporters')
      .insert({ issue_id: id, supporter_id: req.user.id });

    if (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'You already voted for this complaint.' });
      }
      throw error;
    }

    res.json({ message: 'Vote recorded successfully' });
  } catch (error: any) {
    console.error('Error recording vote:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Update /extra to include supporters count
router.get('/:id/extra', async (req, res) => {
  try {
    const { id } = req.params;
    const [mediaRes, aiRes, supportRes] = await Promise.all([
      supabase.from('issue_media').select('*').eq('issue_id', id).eq('media_type', 'ORIGINAL').maybeSingle(),
      supabase.from('ai_analysis').select('*').eq('issue_id', id).maybeSingle(),
      supabase.from('issue_supporters').select('supporter_id', { count: 'exact' }).eq('issue_id', id)
    ]);
    res.json({
      media: mediaRes.data,
      ai: aiRes.data,
      supportersCount: supportRes.count || 0
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

`;

content = content.replace(/router\.get\('\/:id\/extra',.*?\}\);/s, newRoutesCode);

fs.writeFileSync('src/routes/issues.ts', content);
