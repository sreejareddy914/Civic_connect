import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

export async function transcribeAudio(audioFilePath: string, originalName: string, mimeType: string, languageCode?: string): Promise<string | null> {
  try {
    console.log('--- DEBUG transcribeAudio ---');
    console.log('SARVAM_API_KEY exists:', !!process.env.SARVAM_API_KEY);
    console.log('SARVAM_API_KEY length:', process.env.SARVAM_API_KEY?.length);
    
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioFilePath), {
      filename: originalName || 'voice_note.webm',
      contentType: mimeType || 'audio/webm',
    });
    formData.append('model', 'saaras:v3');
    
    if (languageCode) {
      formData.append('language_code', languageCode);
    }

    console.log('Sending request to Sarvam with language_code:', languageCode);

    const response = await axios.post('https://api.sarvam.ai/speech-to-text', formData, {
      headers: {
        'api-subscription-key': process.env.SARVAM_API_KEY || '',
        ...formData.getHeaders(),
      },
    });

    console.log('Sarvam HTTP Status:', response.status);
    console.log('Sarvam response data keys:', Object.keys(response.data || {}));

    if (response.data && response.data.transcript) {
      return response.data.transcript;
    }
    
    console.log('No transcript in response:', response.data);
    return null;
  } catch (error: any) {
    console.error('Sarvam AI Transcription failed:');
    if (error.response) {
      console.error('- Sarvam HTTP Status:', error.response.status);
      console.error('- Sarvam Error Data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('- Error message:', error.message);
    }
    return null;
  }
}
