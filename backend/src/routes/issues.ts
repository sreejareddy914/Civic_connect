import { Router } from 'express';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
import ws from 'ws';
import { analyzeIssue } from '../ai';
import { transcribeAudio } from '../voice';
import { awardPoints } from '../services/points';
import { InformationRequestService } from '../services/InformationRequestService';
import { IssueLifecycleService } from '../services/IssueLifecycleService';
import fs from 'fs';

const router = Router();

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

const optionalAuthMiddleware = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return next();
  }
  const token = authHeader.split(' ')[1];
  const { data, error } = await supabase.auth.getUser(token);
  if (!error && data.user) {
    req.user = data.user;
  }
  next();
};

const upload = multer({ dest: 'uploads/' }); // Temporary storage for incoming files


globalThis.WebSocket = ws as any;

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SECRET_KEY || '',
  { auth: { persistSession: false } }
);

// Distance function for proximity checking (Haversine formula approximation in meters)
function getDistanceFromLatLonInM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Radius of the earth in m
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; // Distance in m
  return d;
}

router.post('/transcribe', upload.single('audio'), async (req: any, res: any) => {
  try {
    const { languageCode } = req.body;
    const audioFile = req.file;

    console.log('--- DEBUG /transcribe ---');
    console.log('Received languageCode:', languageCode);
    console.log('File received:', !!audioFile);
    
    if (!audioFile) {
      console.log('No audio file found in req.file');
      return res.status(400).json({ error: 'Audio file is required.' });
    }

    console.log('File fieldname:', audioFile.fieldname);
    console.log('File originalname:', audioFile.originalname);
    console.log('File MIME type:', audioFile.mimetype);
    console.log('File size:', audioFile.size);

    const transcript = await transcribeAudio(audioFile.path, audioFile.originalname, audioFile.mimetype, languageCode);
    fs.unlinkSync(audioFile.path); // Cleanup

    if (transcript) {
      res.json({ transcript });
    } else {
      res.status(500).json({ error: 'Failed to transcribe audio' });
    }
  } catch (error: any) {
    console.error('Error transcribing audio:', error);
    res.status(500).json({ error: 'Internal server error during transcription', details: error.message });
  }
});

router.post('/analyze', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'audio', maxCount: 1 }]), async (req: any, res: any) => {
  try {
    const { title, latitude, longitude, languageCode } = req.body;
    let description = req.body.description || '';

    console.log(`\n--- [ANALYZE REQUEST RECEIVED] ---`);
    console.log(`Title exists: ${!!title}`);
    console.log(`Description exists: ${!!description}`);
    console.log(`Language: ${languageCode}`);
    console.log(`Latitude: ${latitude}`);
    console.log(`Longitude: ${longitude}`);
    console.log(`GEMINI_API_KEY loaded: ${!!process.env.GEMINI_API_KEY}`);
    console.log(`SUPABASE configured: ${!!process.env.SUPABASE_URL && !!process.env.SUPABASE_SECRET_KEY}`);

    const files = (req.files || {}) as { [fieldname: string]: Express.Multer.File[] };
    const imageFile = files['image']?.[0];
    const audioFile = files['audio']?.[0];

    console.log(`Image received: ${!!imageFile}`);
    if (imageFile) {
      console.log(`Image MIME type: ${imageFile.mimetype}`);
      console.log(`Image size: ${imageFile.size} bytes`);
    }

    // 1. Transcribe audio if present
    if (audioFile) {
      const transcript = await transcribeAudio(audioFile.path, audioFile.originalname, audioFile.mimetype, languageCode);
      if (transcript) {
        description = description ? `${description}\n\n[Voice Transcript]: ${transcript}` : transcript;
      }
      fs.unlinkSync(audioFile.path); // Cleanup
    }

    if (!description && !title) {
      return res.status(400).json({ error: 'Title and Description are required for analysis.' });
    }

    // 2. Fetch candidate issues for duplicate detection (e.g. recent unresolved issues)
    let candidateIssues: any[] = [];
    if (latitude && longitude) {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      
      console.log(`\nCurrent complaint coordinates:\nlatitude = ${lat}\nlongitude = ${lng}`);

      // Fetch open issues to filter locally
      const { data: openIssues, error: dbError } = await supabase
        .from('issues')
        .select('id, title, description, category, latitude, longitude, issue_media(storage_path)')
        .neq('status', 'RESOLVED')
        .order('created_at', { ascending: false })
        .limit(100);
        
      if (dbError) {
        console.error('Database query failed for duplicates:', dbError);
        return res.status(500).json({ error: 'Database query for duplicate detection failed.', details: dbError.message });
      }
        
      if (openIssues) {
        // Filter those within ~500 meters
        const nearbyIssues = openIssues.filter(issue => {
          if (issue.latitude && issue.longitude) {
            const dist = getDistanceFromLatLonInM(lat, lng, issue.latitude, issue.longitude);
            return dist <= 500;
          }
          return false;
        }).slice(0, 5); // Max 5 candidates to Gemini

        console.log(`\nCandidate count:\n${nearbyIssues.length}`);
        
        if (nearbyIssues.length > 0) {
          console.log(`\nCandidate IDs:\n${nearbyIssues.map(i => i.id).join(', ')}`);
          console.log(`\nCandidate coordinates:\n${nearbyIssues.map(i => `${i.id}: lat=${i.latitude}, lng=${i.longitude}`).join('\n')}`);
        }
        
        // Fetch candidate images and compute deterministic similarity signals
        
        // Helper to normalize text
        const normalizeText = (txt: string) => (txt || '').toLowerCase().replace(/[^\w\s]|_/g, "").replace(/\s+/g, " ").trim();
        const getWords = (txt: string) => new Set(txt.split(' '));
        
        const newTitleNorm = normalizeText(title);
        const newDescNorm = normalizeText(description);
        const newTitleWords = getWords(newTitleNorm);
        const newDescWords = getWords(newDescNorm);
        
        const jaccard = (a: Set<string>, b: Set<string>) => {
          const intersection = new Set([...a].filter(x => b.has(x)));
          const union = new Set([...a, ...b]);
          return union.size === 0 ? 0 : intersection.size / union.size;
        };

        // We need the new image buffer early to compare exactly
        let newImageBuffer: Buffer | null = null;
        let newImageMimeType: string | null = null;
        if (imageFile) {
          try {
            newImageBuffer = fs.readFileSync(imageFile.path);
            newImageMimeType = imageFile.mimetype;
          } catch (err: any) {
            console.error('Error reading new image for similarity:', err.message);
          }
        }

        for (const issue of (nearbyIssues as any[])) {
          const dist = getDistanceFromLatLonInM(lat, lng, issue.latitude, issue.longitude);
          issue.distance = dist;
          issue.locationMatch = dist <= 10; // Highly strict match
          
          const issueTitleWords = getWords(normalizeText(issue.title));
          const issueDescWords = getWords(normalizeText(issue.description));
          
          const titleSim = Math.round(jaccard(newTitleWords, issueTitleWords) * 100);
          const descSim = Math.round(jaccard(newDescWords, issueDescWords) * 100);
          issue.textSimilarity = Math.max(titleSim, descSim); // Rough similarity metric
          
          issue.imageSimilarity = 0;

          console.log(`\nCandidate: ${issue.id}`);
          if (issue.issue_media && issue.issue_media.length > 0) {
            console.log(`Has media record: true`);
            const storagePath = issue.issue_media[0].storage_path;
            console.log(`Storage path exists: true`);
            const { data: fileData, error: downloadError } = await supabase.storage.from('issues').download(storagePath);
            if (fileData && !downloadError) {
              console.log(`Image downloaded: true`);
              const arrayBuffer = await fileData.arrayBuffer();
              issue.imageBuffer = Buffer.from(arrayBuffer);
              issue.imageMimeType = fileData.type || 'image/jpeg';
              console.log(`Image size: ${issue.imageBuffer.length} bytes`);
              
              if (newImageBuffer && newImageBuffer.length === issue.imageBuffer.length) {
                // If it's the exact same upload, bytes should match
                if (newImageBuffer.equals(issue.imageBuffer)) {
                  issue.imageSimilarity = 100;
                }
              }
            } else {
              console.log(`Image downloaded: false`);
            }
          } else {
            console.log(`Has media record: false`);
          }
          
          candidateIssues.push(issue);
        }

        // Pass the loaded buffer down to the rest of the flow
        req.loadedImageBuffer = newImageBuffer;
        req.loadedImageMimeType = newImageMimeType;
      }
    }

    // 3. Prepare image for Gemini if present
    let imageBuffer = req.loadedImageBuffer || null;
    let imageMimeType = req.loadedImageMimeType || null;
    if (imageFile && !imageBuffer) {
      try {
        imageBuffer = fs.readFileSync(imageFile.path);
        imageMimeType = imageFile.mimetype;
      } catch (err: any) {
        console.error('Error processing image:', err.message);
      }
    }
    
    // Always cleanup temp image file from upload destination
    if (imageFile) {
      try { fs.unlinkSync(imageFile.path); } catch(e) {}
    }

    // 4. Analyze with Gemini
    console.log('[6] Gemini request started');
    let analysis;
    let geminiError: any;
    try {
      analysis = await analyzeIssue(title, description, latitude, longitude, imageBuffer, imageMimeType, candidateIssues);
      console.log('[7] Gemini response received');
    } catch (err: any) {
      console.error('Gemini error:', err.message);
      geminiError = err;
    }

    if (!analysis) {
      let statusCode = 500;
      const errorMsg = geminiError?.message || geminiError?.toString() || 'Unknown error';
      if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('Quota')) {
        statusCode = 429;
      } else if (errorMsg.includes('503') || errorMsg.includes('high demand') || errorMsg.includes('unavailable')) {
        statusCode = 503;
      }
      return res.status(statusCode).json({ error: 'AI analysis failed', details: errorMsg });
    }
    
    console.log('[8] AI response validated');
    console.log('[9] Response sent');

    // Return the volatile analysis to frontend
    res.json({
      originalDescription: description,
      analysis
    });

  } catch (error: any) {
    console.error('Error analyzing issue:', error);
    res.status(500).json({ error: 'Internal server error during analysis', details: error.message });
  }
});

router.post('/report', upload.single('image'), async (req: any, res: any) => {
  try {
    const { 
      title, 
      originalDescription,
      latitude, 
      longitude, 
      address,
      reporter_id,
      category,
      severity,
      priority,
      confidence,
      polishedDescription,
      imageAnalysis,
      isDuplicate,
      matchedReportId,
      duplicateReason
    } = req.body;

    const imageFile = req.file;

    // 1. Insert finalized Issue into Database
    const { data: issue, error: issueError } = await supabase
      .from('issues')
      .insert({
        reporter_id: reporter_id || null,
        title,
        description: polishedDescription || originalDescription,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        address,
        category: category || 'Other',
        severity: severity || 'LOW',
        priority: priority || 'LOW',
        ai_confidence: parseFloat(confidence) || 0
        // If DB has fields for duplicate detection or image analysis, they could be added here
      })
      .select()
      .single();

    if (issueError) throw issueError;

    // 2. Upload Image to Supabase Storage if present
    if (imageFile) {
      const fileExt = imageFile.originalname.split('.').pop();
      const filePath = `${issue.id}/original.${fileExt}`;
      const fileBuffer = fs.readFileSync(imageFile.path);

      const { error: uploadError } = await supabase.storage
        .from('issues')
        .upload(filePath, fileBuffer, {
          contentType: imageFile.mimetype,
        });

      if (!uploadError) {
        // Save media reference in DB
        const { error: mediaError } = await supabase.from('issue_media').insert({
          issue_id: issue.id,
          media_type: 'ORIGINAL',
          storage_path: filePath,
          uploaded_by: reporter_id || null
        });
        if (mediaError) {
          console.error('Error saving issue media to DB:', mediaError);
        }
      } else {
        console.error('Error uploading image to storage:', uploadError);
      }

      // Cleanup temp image file
      fs.unlinkSync(imageFile.path);
    }

    // 3. Save AI Analysis Log to capture the duplicate reasoning and image analysis
    const isDuplicateBool = isDuplicate === 'true' || isDuplicate === true;
    await supabase.from('ai_analysis').insert({
      issue_id: issue.id,
      raw_response: { imageAnalysis, isDuplicate: isDuplicateBool, matchedReportId, duplicateReason, originalDescription },
      parsed_output: { category, severity, priority, confidence, polishedDescription }
    });

    // 4. Award Points if not a duplicate
    if (reporter_id && !isDuplicateBool) {
      await awardPoints(supabase, reporter_id, 'VALID_ISSUE_REPORT', issue.id, `Reported issue ${issue.code || issue.id}`);
    }

    res.status(201).json({ message: 'Issue reported successfully', issue });
  } catch (error: any) {
    console.error('Error reporting issue:', error);
    res.status(500).json({ error: 'Internal server error during final submission', details: error.message });
  }
});

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
      const filePath = `${id}/original_${Date.now()}.${fileExt}`;
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

// Get active/pending information requests for the authenticated citizen
router.get('/my-pending-requests', authMiddleware, async (req: any, res: any) => {
  try {
    const requests = await InformationRequestService.getActiveRequestsForCitizen(req.user.id);
    res.json({ requests });
  } catch (error: any) {
    console.error('Error fetching my pending requests:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all information requests for an issue
router.get('/:id/information-requests', optionalAuthMiddleware, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const requests = await InformationRequestService.getRequestsForIssue(id);
    res.json({ requests });
  } catch (error: any) {
    console.error('Error fetching issue information requests:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/respond-info', authMiddleware, upload.single('image'), async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { request_id, response_text, message } = req.body;
    const responseContent = (response_text || message || '').trim();
    const imageFile = req.file;

    if (!responseContent) {
      return res.status(400).json({ error: 'Response message is required' });
    }

    if (!request_id) {
      return res.status(400).json({ error: 'request_id is required' });
    }

    const { data: issue, error: issueError } = await supabase
      .from('issues')
      .select('id, reporter_id, status, code, title, description')
      .eq('id', id)
      .single();

    if (issueError || !issue) return res.status(404).json({ error: 'Complaint not found' });
    if (issue.reporter_id !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized: Only the complaint author can submit additional information' });
    }

    let mediaId: string | undefined;
    let mediaStoragePath: string | undefined;

    // Handle optional additional evidence upload
    if (imageFile) {
      const fileBuffer = fs.readFileSync(imageFile.path);
      const fileExt = imageFile.originalname.split('.').pop() || 'jpg';
      const filePath = `${id}/clarification_${Date.now()}.${fileExt}`;
      
      const { error: uploadErr } = await supabase.storage
        .from('issues')
        .upload(filePath, fileBuffer, { contentType: imageFile.mimetype, upsert: true });

      if (uploadErr) {
        console.error('Storage upload error:', uploadErr);
        throw new Error(`Failed to store uploaded evidence: ${uploadErr.message}`);
      }

      mediaStoragePath = filePath;

      const { data: mediaRecord, error: mediaErr } = await supabase
        .from('issue_media')
        .insert({
          issue_id: id,
          media_type: 'CLARIFICATION',
          storage_path: filePath,
          uploaded_by: req.user.id
        })
        .select()
        .single();

      if (mediaErr) {
        console.error('Media record insert error:', mediaErr);
      } else if (mediaRecord) {
        mediaId = mediaRecord.id;
      }

      fs.unlinkSync(imageFile.path);
    }

    // Submit response persistently via InformationRequestService
    const result = await InformationRequestService.submitResponse({
      requestId: request_id,
      issueId: id,
      citizenId: req.user.id,
      message: responseContent,
      mediaId,
      mediaStoragePath
    });

    // Centralized status transition using IssueLifecycleService
    await IssueLifecycleService.transitionIssueStatus({
      issueId: id,
      targetStatus: 'REPORTED',
      actorId: req.user.id,
      notes: `Citizen submitted additional information: "${responseContent}"`,
      options: { force: true }
    });

    // Notify Admins
    const { data: citizenProfile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', req.user.id)
      .maybeSingle();

    const citizenName = citizenProfile?.full_name || req.user.user_metadata?.full_name || 'Citizen';

    const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'ADMIN');
    if (admins) {
      for (const admin of admins) {
        await supabase.from('notifications').insert({
          profile_id: admin.id,
          title: 'Additional information received',
          message: `Citizen ${citizenName} submitted additional information for complaint ${issue.code || issue.title}.`,
          is_read: false,
          link: `/admin/issues/${id}`
        });
      }
    }

    res.json({
      success: true,
      message: 'Additional information submitted successfully. Your response has been sent to the Admin.',
      request: result.request,
      response: result.response
    });
  } catch (error: any) {
    console.error('Error responding to info request:', error);
    res.status(400).json({ error: error.message });
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
        const { count } = await supabase.from('issue_supporters').select('*', { count: 'exact', head: true }).eq('issue_id', id);
        return res.json({ upvoted: true, upvoteCount: count || 0, message: 'Already voted' });
      }
      throw error;
    }

    const { count } = await supabase.from('issue_supporters').select('*', { count: 'exact', head: true }).eq('issue_id', id);
    
    // Award Points
    await awardPoints(supabase, req.user.id, 'UPVOTE', id, `Upvoted issue ${id}`);
    
    res.json({ upvoted: true, upvoteCount: count || 0, message: 'Vote recorded successfully' });
  } catch (error: any) {
    console.error('Error recording vote:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

router.get('/:id/extra', optionalAuthMiddleware, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const [mediaRes, aiRes, supportRes, commentsRes, verifyRes] = await Promise.all([
      supabase.from('issue_media').select('*').eq('issue_id', id).eq('media_type', 'ORIGINAL').maybeSingle(),
      supabase.from('ai_analysis').select('*').eq('issue_id', id).maybeSingle(),
      supabase.from('issue_supporters').select('supporter_id', { count: 'exact', head: true }).eq('issue_id', id),
      supabase.from('comments').select('id', { count: 'exact', head: true }).eq('issue_id', id),
      supabase.from('issue_verifications').select('result, verifier_id').eq('issue_id', id)
    ]);
    
    let verifications = {
      CONFIRMED_PRESENT: 0,
      NOT_VERIFIED: 0,
      NO_LONGER_PRESENT: 0
    };
    let hasCurrentUserVerified = false;

    if (verifyRes.data) {
      verifyRes.data.forEach((v: any) => {
        if (verifications[v.result as keyof typeof verifications] !== undefined) {
          verifications[v.result as keyof typeof verifications]++;
        }
        if (req.user && v.verifier_id === req.user.id) {
          hasCurrentUserVerified = true;
        }
      });
    }

    res.json({
      media: mediaRes.data,
      ai: aiRes.data,
      supportersCount: supportRes.count || 0,
      commentsCount: commentsRes.count || 0,
      verifications,
      hasCurrentUserVerified
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/interactions', optionalAuthMiddleware, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    
    const [upvoteCountRes, commentCountRes] = await Promise.all([
      supabase.from('issue_supporters').select('*', { count: 'exact', head: true }).eq('issue_id', id),
      supabase.from('comments').select('*', { count: 'exact', head: true }).eq('issue_id', id)
    ]);
    
    let hasCurrentUserUpvoted = false;
    
    if (req.user) {
      const { data } = await supabase
        .from('issue_supporters')
        .select('supporter_id')
        .eq('issue_id', id)
        .eq('supporter_id', req.user.id)
        .maybeSingle();
        
      if (data) {
        hasCurrentUserUpvoted = true;
      }
    }
    
    res.json({
      issueId: id,
      upvoteCount: upvoteCountRes.count || 0,
      commentCount: commentCountRes.count || 0,
      hasCurrentUserUpvoted
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

router.get('/:id/comments', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('comments')
      .select('*, profiles(full_name, id)')
      .eq('issue_id', id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

router.post('/:id/comments', authMiddleware, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    const { data, error } = await supabase
      .from('comments')
      .insert({ issue_id: id, profile_id: req.user.id, content: content.trim() })
      .select('*, profiles(full_name, id)')
      .single();

    if (error) throw error;
    
    const { count } = await supabase.from('comments').select('*', { count: 'exact', head: true }).eq('issue_id', id);
    
    // Award Points
    await awardPoints(supabase, req.user.id, 'USEFUL_COMMENT', data.id, `Commented on issue ${id}`);
    
    res.json({ comment: data, commentCount: count || 0 });
  } catch (error: any) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

router.post('/:id/verify', authMiddleware, upload.single('image'), async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { result, observation_note, latitude, longitude } = req.body;
    const imageFile = req.file;

    // Validate result
    const validResults = ['CONFIRMED_PRESENT', 'NOT_VERIFIED', 'NO_LONGER_PRESENT'];
    if (!validResults.includes(result)) {
      if (imageFile) fs.unlinkSync(imageFile.path);
      return res.status(400).json({ error: 'Invalid verification result' });
    }

    if (!observation_note) {
      if (imageFile) fs.unlinkSync(imageFile.path);
      return res.status(400).json({ error: 'Observation note is required' });
    }

    // If CONFIRMED_PRESENT, requires photo and location
    if (result === 'CONFIRMED_PRESENT') {
      if (!imageFile || !latitude || !longitude) {
        if (imageFile) fs.unlinkSync(imageFile.path);
        return res.status(400).json({ error: 'Photo and current location are required to confirm an issue is present' });
      }
    }

    // 1. Validate the issue exists and user is not the reporter
    const { data: issue, error: issueError } = await supabase
      .from('issues')
      .select('id, reporter_id, latitude, longitude, status')
      .eq('id', id)
      .single();

    if (issueError || !issue) {
      if (imageFile) fs.unlinkSync(imageFile.path);
      return res.status(404).json({ error: 'Issue not found' });
    }

    if (issue.reporter_id === req.user.id) {
      if (imageFile) fs.unlinkSync(imageFile.path);
      return res.status(403).json({ error: 'You cannot verify your own reported issue' });
    }

    // 2. Distance check
    let distance = null;
    let verifierLat = null;
    let verifierLng = null;
    if (latitude && longitude) {
      verifierLat = parseFloat(latitude);
      verifierLng = parseFloat(longitude);
      distance = getDistanceFromLatLonInM(verifierLat, verifierLng, issue.latitude, issue.longitude);
      
      // If confirmed present, must be within 500 meters
      if (result === 'CONFIRMED_PRESENT' && distance > 500) {
        if (imageFile) fs.unlinkSync(imageFile.path);
        return res.status(403).json({ error: 'You are too far from this complaint location to submit a verified observation.' });
      }
    }

    // 3. Upload verification image if provided
    let evidence_media_id = null;
    if (imageFile) {
      const fileExt = imageFile.originalname.split('.').pop();
      const filePath = `${id}/verify_${req.user.id}_${Date.now()}.${fileExt}`;
      const fileBuffer = fs.readFileSync(imageFile.path);

      const { error: uploadError } = await supabase.storage
        .from('issues')
        .upload(filePath, fileBuffer, {
          contentType: imageFile.mimetype,
        });

      fs.unlinkSync(imageFile.path);

      if (uploadError) {
        return res.status(500).json({ error: 'Failed to upload verification image' });
      }

      // Create issue_media record
      const { data: mediaData, error: mediaError } = await supabase.from('issue_media').insert({
        issue_id: id,
        media_type: 'VERIFICATION',
        storage_path: filePath,
        uploaded_by: req.user.id
      }).select('id').single();

      if (!mediaError && mediaData) {
        evidence_media_id = mediaData.id;
      }
    }

    // 4. Insert verification record
    const { error: insertError } = await supabase.from('issue_verifications').insert({
      issue_id: id,
      verifier_id: req.user.id,
      result,
      verification_note: observation_note,
      verifier_latitude: verifierLat,
      verifier_longitude: verifierLng,
      distance_from_issue: distance,
      evidence_media_id: evidence_media_id
    });

    if (insertError) {
      if (insertError.code === '23505') {
        return res.status(400).json({ error: 'You have already verified this issue' });
      }
      return res.status(500).json({ error: 'Failed to save verification' });
    }

    // 5. Award Points for valid verification (only if they actually put in effort to verify it, positive or negative? Spec says: "Do not award positive verification points for a negative result.")
    let pointsAwarded = 0;
    if (result === 'CONFIRMED_PRESENT') {
      const ptsResult = await awardPoints(supabase, req.user.id, 'VALID_VERIFICATION', id, `Verified issue ${id} as present`);
      pointsAwarded = ptsResult.pointsAwarded;
    }

    res.json({ success: true, pointsAwarded });

  } catch (error: any) {
    console.error('Error verifying issue:', error);
    res.status(500).json({ error: 'Internal server error during verification' });
  }
});

export default router;
