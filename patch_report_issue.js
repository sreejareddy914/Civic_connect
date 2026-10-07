const fs = require('fs');
let code = fs.readFileSync('frontend/src/pages/ReportIssue.tsx', 'utf8');

const useEfectBlock = `
  useEffect(() => {
    if (isEditing && id) {
      const fetchIssue = async () => {
        try {
          const { data: issue, error } = await supabase.from('issues').select('*').eq('id', id).single();
          if (error) throw error;
          if (issue.status !== 'REPORTED') {
            alert('This complaint can no longer be edited.');
            navigate('/track');
            return;
          }
          setTitle(issue.title);
          setDescription(issue.description);
          setLocation({ lat: issue.latitude, lng: issue.longitude });
          setAddress(issue.address || '');
          setLocationSource('MAP_PICK');
          
          const { data: media } = await supabase.from('issue_media').select('storage_path').eq('issue_id', id).eq('media_type', 'ORIGINAL').single();
          if (media) {
            const { data: fileUrl } = supabase.storage.from('issues').getPublicUrl(media.storage_path);
            if (fileUrl) {
              setImagePreview(fileUrl.publicUrl);
            }
          }
        } catch (err) {
          console.error(err);
        }
      };
      fetchIssue();
    }
  }, [isEditing, id, navigate]);
`;

code = code.replace('  // Watch for form changes to invalidate AI results', useEfectBlock + '\n\n  // Watch for form changes to invalidate AI results');
fs.writeFileSync('frontend/src/pages/ReportIssue.tsx', code);
