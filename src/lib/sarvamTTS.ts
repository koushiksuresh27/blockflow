export async function textToSpeech(
  text: string,
  languageCode: string = 'hi-IN',
  speaker: string = 'anushka'
): Promise<string> {
  const WORKFLOW_URL = 
    import.meta.env.VITE_WORKFLOW_URL || 
    'http://localhost:3001'

  const response = await fetch(
    `${WORKFLOW_URL}/sarvam/tts`,
    {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        text,
        language_code: languageCode,
        speaker
      })
    }
  )
  const data = await response.json()
  return data.audio
}

export function playBase64Audio(
  base64Audio: string
): HTMLAudioElement {
  const audio = new Audio(
    `data:audio/wav;base64,${base64Audio}`
  )
  audio.play()
  return audio
}

export const TTS_SPEAKERS = [
  { code: 'anushka', label: 'Anushka (Female)' },
  { code: 'abhilash', label: 'Abhilash (Male)' }
]
