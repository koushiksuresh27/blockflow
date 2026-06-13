import { useState, useRef, useCallback } from 'react';
import { Microphone, FastUpCircle, WarningTriangle, Check } from 'iconoir-react';
import { transcribeAudio } from '../lib/sarvam';
import { suggestComplaintDetails } from '../lib/gemini';
import type { ComplaintSuggestion } from '../lib/gemini';
import { supabase } from '../lib/supabase';

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

type FlowState = 'idle' | 'recording' | 'processing' | 'preview' | 'submitting' | 'success' | 'error';

export default function VoiceComplaintFlow() {
  const [state, setState] = useState<FlowState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [transcript, setTranscript] = useState('');
  const [suggestion, setSuggestion] = useState<ComplaintSuggestion | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const resetFlow = useCallback(() => {
    setState('idle');
    setErrorMsg('');
    setTranscript('');
    setSuggestion(null);
    chunksRef.current = [];
  }, []);

  const startRecording = useCallback(async () => {
    resetFlow();
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setErrorMsg('Microphone access denied. Please allow microphone permission.');
      setState('error');
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
        setState('error');
        return;
      }

      setState('processing');
      try {
        const result = await transcribeAudio(audioBlob);
        const t = result.transcript;
        if (!t.trim()) {
          setErrorMsg('No speech detected. Please speak clearly and try again.');
          setState('error');
          return;
        }
        setTranscript(t);

        try {
          const sugg = await suggestComplaintDetails(t);
          setSuggestion(sugg);
        } catch (err) {
          console.warn('AI suggestion failed:', err);
          setSuggestion({ category: 'Other', priority: 'medium', confidence: 0 });
        }

        setState('preview');
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Transcription failed');
        setState('error');
      }
    };

    recorder.start(250);
    setState('recording');
  }, [resetFlow]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const submitComplaint = async () => {
    setState('submitting');
    try {
      const { data: userData } = await supabase.auth.getUser();

      const { error } = await supabase.from('complaints').insert({
        title: transcript.slice(0, 80),
        description: transcript,
        category: suggestion?.category || 'Other',
        priority: suggestion?.priority || 'medium',
        society_id: 'eafc59c7-4148-44ee-b66b-256a5338718b',
        resident_id: userData?.user?.id || null,
        status: 'open',
      });

      if (error) throw error;

      setState('success');
      setTimeout(() => {
        resetFlow();
      }, 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Submission failed');
      setState('preview');
    }
  };

  const priorityColors: Record<string, string> = {
    urgent: 'bg-red-100 text-red-800 border-red-200',
    high: 'bg-orange-100 text-orange-800 border-orange-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    low: 'bg-green-100 text-green-800 border-green-200',
  };

  return (
    <div className="font-[Inter] w-full max-w-md mx-auto">
      {state === 'idle' || state === 'recording' || state === 'error' || state === 'processing' ? (
        <div className="flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={state === 'recording' ? stopRecording : startRecording}
            disabled={state === 'processing'}
            className={`
              flex items-center gap-2 px-6 py-3 rounded-[10px] text-base font-medium
              transition-all duration-200 shadow-sm
              ${state === 'recording'
                ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse'
                : state === 'processing'
                  ? 'bg-[#E0DDD9] text-[#9C9894] cursor-not-allowed'
                  : 'bg-[#1C1917] text-white hover:bg-[#2C2925]'
              }
            `}
          >
            {state === 'recording' ? (
              <>
                <FastUpCircle width={18} height={18} strokeWidth={1.5} />
                Stop Recording
              </>
            ) : state === 'processing' ? (
              <>
                <Spinner />
                Processing Audio…
              </>
            ) : (
              <>
                <Microphone width={18} height={18} strokeWidth={1.5} />
                Speak your complaint
              </>
            )}
          </button>

          {state === 'recording' && (
            <p className="text-sm text-gray-600">
              🔴 Recording… tap stop when done
            </p>
          )}

          {state === 'error' && errorMsg && (
            <div className="flex items-start gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-[10px] px-4 py-3 w-full">
              <WarningTriangle
                width={18}
                height={18}
                strokeWidth={1.5}
                className="mt-0.5 shrink-0"
              />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>
      ) : null}

      {(state === 'preview' || state === 'submitting') && (
        <div className="bg-[#FFFFFF] rounded-[16px] p-5 shadow-sm border border-gray-100 flex flex-col gap-4">
          <h3 className="text-lg font-semibold text-[#1C1917]">Review Complaint</h3>
          
          <div className="flex flex-col gap-3">
            <div className="bg-gray-50 rounded-[10px] p-3 text-sm text-gray-800">
              {transcript}
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full border border-gray-200">
                {suggestion?.category || 'Other'}
              </span>
              <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${priorityColors[suggestion?.priority || 'medium']}`}>
                {(suggestion?.priority || 'medium').charAt(0).toUpperCase() + (suggestion?.priority || 'medium').slice(1)} Priority
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mt-2">
            <button
              onClick={submitComplaint}
              disabled={state === 'submitting'}
              className="flex-1 flex items-center justify-center gap-2 bg-[#1C1917] text-white px-4 py-2.5 rounded-[10px] font-medium text-sm transition-colors hover:bg-[#2C2925] disabled:opacity-70"
            >
              {state === 'submitting' ? (
                <>
                  <Spinner />
                  Submitting…
                </>
              ) : (
                'Submit Complaint'
              )}
            </button>
            <button
              onClick={resetFlow}
              disabled={state === 'submitting'}
              className="flex-1 flex items-center justify-center gap-2 bg-transparent text-[#1C1917] border border-[#1C1917] px-4 py-2.5 rounded-[10px] font-medium text-sm transition-colors hover:bg-gray-50 disabled:opacity-70"
            >
              <Microphone width={18} height={18} strokeWidth={1.5} />
              Record Again
            </button>
          </div>
          
          {errorMsg && (
             <div className="flex items-start gap-2 text-red-600 text-sm mt-2">
              <WarningTriangle width={18} height={18} strokeWidth={1.5} className="mt-0.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>
      )}

      {state === 'success' && (
        <div className="bg-[#FFFFFF] rounded-[16px] p-6 shadow-sm border border-green-100 flex flex-col items-center justify-center text-center gap-3 animate-in fade-in zoom-in duration-300">
          <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-2">
            <Check width={24} height={24} strokeWidth={2} />
          </div>
          <h3 className="text-lg font-semibold text-green-800">Complaint Submitted!</h3>
          <p className="text-sm text-green-600">
            A technician will be assigned shortly.
          </p>
        </div>
      )}
    </div>
  );
}
