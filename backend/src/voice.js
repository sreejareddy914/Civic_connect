"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.transcribeAudio = transcribeAudio;
const axios_1 = __importDefault(require("axios"));
const form_data_1 = __importDefault(require("form-data"));
const fs_1 = __importDefault(require("fs"));
async function transcribeAudio(audioFilePath, originalName, mimeType, languageCode) {
    try {
        console.log('--- DEBUG transcribeAudio ---');
        console.log('SARVAM_API_KEY exists:', !!process.env.SARVAM_API_KEY);
        console.log('SARVAM_API_KEY length:', process.env.SARVAM_API_KEY?.length);
        const formData = new form_data_1.default();
        formData.append('file', fs_1.default.createReadStream(audioFilePath), {
            filename: originalName || 'voice_note.webm',
            contentType: mimeType || 'audio/webm',
        });
        formData.append('model', 'saaras:v3');
        if (languageCode) {
            formData.append('language_code', languageCode);
        }
        console.log('Sending request to Sarvam with language_code:', languageCode);
        const response = await axios_1.default.post('https://api.sarvam.ai/speech-to-text', formData, {
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
    }
    catch (error) {
        console.error('Sarvam AI Transcription failed:');
        if (error.response) {
            console.error('- Sarvam HTTP Status:', error.response.status);
            console.error('- Sarvam Error Data:', JSON.stringify(error.response.data, null, 2));
        }
        else {
            console.error('- Error message:', error.message);
        }
        return null;
    }
}
//# sourceMappingURL=voice.js.map