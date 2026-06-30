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
  languageCode: string = 'en-IN'
): Promise<string> {
  const WORKFLOW_URL = 
    import.meta.env.VITE_WORKFLOW_URL || 
    'http://localhost:3001'
  
  const formData = new FormData()
  const mimeType = audioBlob.type
    .split(';')[0] || 'audio/webm'
  const file = new File(
    [audioBlob], 
    'recording.webm', 
    { type: mimeType }
  )
  formData.append('file', file)
  formData.append('language_code', 
    languageCode)

  const response = await fetch(
    `${WORKFLOW_URL}/sarvam/transcribe`,
    {
      method: 'POST',
      body: formData
    }
  )
  const data = await response.json()
  return data.transcript || ''
}