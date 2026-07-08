// src/components/VoiceRecorder.tsx
import { useState, useRef, useCallback } from 'react';
import { Microphone, FastUpCircle, WarningTriangle } from 'iconoir-react';
import { transcribeAudio } from '../lib/sarvam';
import type { SarvamLanguage } from '../lib/sarvam';
import { suggestComplaintDetails } from '../lib/gemini';
import type { ComplaintSuggestion } from '../lib/gemini';

// ─── Props ────────────────────────────────────────────────────────────────────
interface VoiceRecorderProps {
  onTranscript: (text: string) => void;
  onSuggestion: (suggestion: ComplaintSuggestion) => void;
  selectedLanguage: SarvamLanguage;
}

// ─── Language options ─────────────────────────────────────────────────────────
export const LANGUAGE_OPTIONS: { code: SarvamLanguage; label: string }[] = [
  { code: 'en-IN', label: 'English' },
  { code: 'hi-IN', label: 'हिन्दी' },
  { code: 'mr-IN', label: 'मराठी' },
  { code: 'gu-IN', label: 'ગુજરાતી' },
  { code: 'ta-IN', label: 'தமிழ்' },
  { code: 'te-IN', label: 'తెలుగు' },
  { code: 'kn-IN', label: 'ಕನ್ನಡ' },
  { code: 'ml-IN', label: 'മലയാളം' },
  { code: 'bn-IN', label: 'বাংলা' },
  { code: 'pa-IN', label: 'ਪੰਜਾਬੀ' },
];

// ─── Inline spinner (no iconoir dependency needed) ────────────────────────────
function Spinner() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      style={{ animation: 'spin 1s linear infinite' }}
    >
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

// ─── Status type ──────────────────────────────────────────────────────────────
type Status = 'idle' | 'recording' | 'transcribing' | 'suggesting' | 'done' | 'error';

// ─── Component ────────────────────────────────────────────────────────────────
export default function VoiceRecorder({
  onTranscript,
  onSuggestion,
  selectedLanguage,
}: VoiceRecorderProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // ── Start recording ─────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    setErrorMsg('');
    setStatus('idle');

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setErrorMsg('Microphone access denied. Please allow microphone permission.');
      setStatus('error');
      return;
    }

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';

    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined
    );

    mediaRecorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());

      const audioBlob = new Blob(chunksRef.current, {
        type: recorder.mimeType || 'audio/webm',
      });

      if (audioBlob.size < 1000) {
        setErrorMsg('Recording was too short or empty. Please try again.');
        setStatus('error');
        return;
      }

      // ── Step 1: Transcribe via Sarvam ──────────────────────────────────────
      setStatus('transcribing');
      let transcript = '';
      let detectedLanguage: string | null = null;
      try {
        // When 'auto', pass 'en-IN' as fallback — backend Speech LID overrides it
        const langCode = selectedLanguage === 'auto' ? 'en-IN' : selectedLanguage
        const result = await transcribeAudio(audioBlob, langCode);
        transcript = result.transcript;
        detectedLanguage = result.detectedLanguage;
        if (!transcript.trim()) {
          setErrorMsg('No speech detected. Please speak clearly and try again.');
          setStatus('error');
          return;
        }
        onTranscript(transcript);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Transcription failed';
        setErrorMsg(msg);
        setStatus('error');
        return;
      }

      // ── Step 2: AI suggestion via Gemini ───────────────────────────────────
      setStatus('suggesting');
      try {
        const suggestion = await suggestComplaintDetails(transcript, detectedLanguage);
        onSuggestion(suggestion);
      } catch (err) {
        // Non-fatal — transcript already succeeded
        console.warn('AI suggestion failed (non-fatal):', err);
      }

      setStatus('done');
      setTimeout(() => setStatus('idle'), 2000);
    };

    recorder.start(250);
    setStatus('recording');
  }, [selectedLanguage, onTranscript, onSuggestion]);

  // ── Stop recording ──────────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const isRecording = status === 'recording';
  const isProcessing = status === 'transcribing' || status === 'suggesting';

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-3">

      {/* Main button */}
      <button
        type="button"
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isProcessing}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-medium
          transition-all duration-200
          ${isRecording
            ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse'
            : isProcessing
              ? 'bg-[#E0DDD9] text-[#9C9894] cursor-not-allowed'
              : status === 'done'
                ? 'bg-green-600 text-white'
                : 'bg-[#1C1917] text-white hover:bg-[#2C2925]'
          }
        `}
      >
        {isRecording ? (
          <>
            <FastUpCircle width={18} height={18} strokeWidth={1.5} />
            Stop Recording
          </>
        ) : isProcessing ? (
          <>
            <Spinner />
            {status === 'transcribing' ? 'Transcribing…' : 'Getting suggestion…'}
          </>
        ) : status === 'done' ? (
          '✓ Done'
        ) : (
          <>
            <Microphone width={18} height={18} strokeWidth={1.5} />
            Speak your complaint
          </>
        )}
      </button>

      {/* Recording hint */}
      {isRecording && (
        <p className="text-xs text-[#6B6560]">
          🔴 Recording… tap stop when done
        </p>
      )}

      {/* Error message */}
      {status === 'error' && errorMsg && (
        <div className="flex items-start gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-[10px] px-3 py-2 max-w-xs">
          <WarningTriangle
            width={16}
            height={16}
            strokeWidth={1.5}
            className="mt-0.5 shrink-0"
          />
          <span>{errorMsg}</span>
        </div>
      )}

    </div>
  );
}