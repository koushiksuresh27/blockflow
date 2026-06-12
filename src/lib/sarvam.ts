// src/lib/sarvam.ts

const SARVAM_API_URL = 'https://api.sarvam.ai/speech-to-text';

export type SarvamLanguage =
  | 'hi-IN' | 'bn-IN' | 'kn-IN' | 'ml-IN' | 'mr-IN'
  | 'od-IN' | 'pa-IN' | 'ta-IN' | 'te-IN' | 'gu-IN' | 'en-IN';

export interface SarvamTranscriptResult {
  transcript: string;
  language_code: string;
}

export async function transcribeAudio(
  audioBlob: Blob,
  languageCode: SarvamLanguage = 'hi-IN'
): Promise<SarvamTranscriptResult> {
  const apiKey = import.meta.env.VITE_SARVAM_API_KEY;

  if (!apiKey) {
    throw new Error('VITE_SARVAM_API_KEY is not set in .env.local');
  }

  // ✅ CRITICAL: Must send as a proper named file — not a raw blob
  // Sarvam rejects 'audio/webm;codecs=opus' — strip everything after the semicolon
  const safeMimeType = (audioBlob.type || 'audio/webm').split(';')[0];
  const file = new File([audioBlob], 'recording.webm', {
    type: safeMimeType,
  });
  const formData = new FormData();
  formData.append('file', file);

  // ✅ Use saarika:v2.5 — saarika:v1 is deprecated and returns 422
  formData.append('model', 'saarika:v2.5');

  // language_code is optional — Sarvam auto-detects, but sending it improves accuracy
  formData.append('language_code', languageCode);

  const response = await fetch(SARVAM_API_URL, {
    method: 'POST',
    headers: {
      // ✅ CRITICAL: Sarvam uses api-subscription-key, NOT Authorization: Bearer
      'api-subscription-key': apiKey,
      // ❌ Do NOT set Content-Type here — fetch sets it automatically
      //    with the correct multipart/form-data boundary
    },
    body: formData,
  });

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status}`;
    try {
      const errJson = await response.json();
      // Log the full error so we can see exactly what Sarvam returns
      console.error('Sarvam raw error response:', JSON.stringify(errJson, null, 2));
      errorDetail =
        errJson?.message ??
        errJson?.error ??
        errJson?.detail ??
        errJson?.detail?.[0]?.msg ??
        JSON.stringify(errJson);
    } catch {
      errorDetail = await response.text();
    }
    throw new Error(`Sarvam STT failed (${response.status}): ${errorDetail}`);
  }

  const data = await response.json();

  return {
    transcript: data.transcript ?? '',
    language_code: data.language_code ?? languageCode,
  };
}