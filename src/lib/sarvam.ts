// src/lib/sarvam.ts

export type SarvamLanguage =
  | 'hi-IN' | 'bn-IN' | 'kn-IN' | 'ml-IN' | 'mr-IN'
  | 'od-IN' | 'pa-IN' | 'ta-IN' | 'te-IN' | 'gu-IN' | 'en-IN';

export const LANGUAGES = [
  { code: 'hi-IN', label: 'Hindi' },
  { code: 'bn-IN', label: 'Bengali' },
  { code: 'kn-IN', label: 'Kannada' },
  { code: 'ml-IN', label: 'Malayalam' },
  { code: 'mr-IN', label: 'Marathi' },
  { code: 'od-IN', label: 'Odia' },
  { code: 'pa-IN', label: 'Punjabi' },
  { code: 'ta-IN', label: 'Tamil' },
  { code: 'te-IN', label: 'Telugu' },
  { code: 'gu-IN', label: 'Gujarati' },
  { code: 'en-IN', label: 'English' }
]

export async function transcribeAudio(
  audioBlob: Blob,
  languageCode: string = 'hi-IN'
): Promise<string> {
  const formData = new FormData()
  // Strip codec suffix - Sarvam rejects it
  const mimeType = audioBlob.type.split(';')[0] || 'audio/webm'
  const file = new File([audioBlob], 'recording.webm', { type: mimeType })
  
  formData.append('file', file)
  formData.append('model', 'saarika:v2.5')
  formData.append('language_code', languageCode)

  const response = await fetch('https://api.sarvam.ai/speech-to-text', {
    method: 'POST',
    headers: {
      'api-subscription-key': import.meta.env.VITE_SARVAM_API_KEY
    },
    body: formData
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Sarvam STT failed (${response.status}): ${err}`)
  }

  const data = await response.json()
  return data.transcript || ''
}