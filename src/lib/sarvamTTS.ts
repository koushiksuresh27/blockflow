export async function textToSpeech(
  text: string,
  languageCode: string = 'hi-IN',
  speaker: string = 'anushka'
): Promise<string> {

  // Sarvam TTS has a character limit per request
  // Truncate if needed
  const maxLength = 500
  const truncatedText = text.length > maxLength
    ? text.slice(0, maxLength) + '...'
    : text

  const response = await fetch(
    'https://api.sarvam.ai/text-to-speech',
    {
      method: 'POST',
      headers: {
        'api-subscription-key':
          import.meta.env.VITE_SARVAM_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: [truncatedText],
        target_language_code: languageCode,
        speaker: speaker,
        pitch: 0,
        pace: 1.0,
        loudness: 1.0,
        speech_sample_rate: 22050,
        enable_preprocessing: true,
        model: 'bulbul:v2'
      })
    }
  )

  if (!response.ok) {
    const err = await response.text()
    throw new Error(
      `Sarvam TTS error: ${response.status} ${err}`
    )
  }

  const data = await response.json()
  
  // Returns base64 audio
  return data.audios[0]
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
