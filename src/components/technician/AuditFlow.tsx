import { useState, useEffect, useRef } from 'react';
import { X, Mic, Loader2, CheckCircle2, AlertTriangle, AlertCircle, ChevronRight, SkipForward } from 'lucide-react';
import { transcribeAudio } from '../../lib/sarvam';
import { textToSpeech, playBase64Audio } from '../../lib/sarvamTTS';
import { supabase } from '../../lib/supabase';

const WORKFLOW_URL = import.meta.env.VITE_WORKFLOW_URL || 'http://localhost:3001';

// ─── Interfaces ─────────────────────────────────────────────────────────────

interface AuditFlowProps {
  societyId: string;
  technicianId: string;
  onClose: () => void;
}

interface Template {
  id: string;
  name: string;
  equipment_type: string;
}

interface AuditStep {
  step_number: number;
  instruction: string;
  pass_criteria: string;
}

interface StepResult {
  step_number: number;
  status: 'pass' | 'concern' | 'fail';
  notes: string;
}

type ScreenState = 'TEMPLATE_SELECT' | 'STEP_VIEW' | 'COMPLETION';

// ─── Main Component ────────────────────────────────────────────────────────

export default function AuditFlow({ societyId, technicianId, onClose }: AuditFlowProps) {
  const [screen, setScreen] = useState<ScreenState>('TEMPLATE_SELECT');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Run State
  const [auditRunId, setAuditRunId] = useState<string>('');
  const [steps, setSteps] = useState<AuditStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Step Execution State
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [tempResult, setTempResult] = useState<StepResult | null>(null);

  // Audio refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Completion State
  const [summary, setSummary] = useState('');
  const [allStepsResult, setAllStepsResult] = useState<StepResult[]>([]);

  const [prefLang, setPrefLang] = useState('en-IN');
  const [prefVoice, setPrefVoice] = useState('anushka');

  // ─── Initialization ────────────────────────────────────────────────────────
  useEffect(() => {
    fetchTemplates();
    fetchVoicePrefs();
  }, []);

  const fetchVoicePrefs = async () => {
    try {
      const { data } = await supabase.from('technicians').select('preferred_language, preferred_voice').eq('user_id', technicianId).single();
      if (data) {
        if (data.preferred_language) setPrefLang(data.preferred_language);
        if (data.preferred_voice) setPrefVoice(data.preferred_voice);
      }
    } catch (e) {
      console.error('Failed to fetch voice prefs:', e);
    }
  };

  // Re-fetch every time component renders (tab becomes active)
  useEffect(() => {
    fetchVoicePrefs();
  }, []);

  // Also poll every 3 seconds while component is mounted
  // so any settings changes are picked up
  useEffect(() => {
    const interval = setInterval(() => {
      fetchVoicePrefs();
    }, 3000);
    
    return () => clearInterval(interval);
  }, [technicianId]);

  const fetchTemplates = async () => {
    try {
      const res = await fetch(`${WORKFLOW_URL}/audit/templates/${societyId}`);
      if (!res.ok) throw new Error('Failed to fetch templates');
      const data = await res.json();
      setTemplates(data.templates || data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // ─── TTS Helpers ───────────────────────────────────────────────────────────
  const speakInstruction = async (text: string) => {
    stopSpeaking();
    try {
      const cleanText = text.replace(/[🚨⚠️📋✅🔒🤖\*]/g, '').trim();
      const finalText = cleanText.slice(0, 480);
      
      let textToSpeak = finalText;
      
      // Translate if not English
      if (prefLang !== 'en-IN') {
        try {
          const transRes = await fetch('https://api.sarvam.ai/translate', {
            method: 'POST',
            headers: {
              'api-subscription-key': import.meta.env.VITE_SARVAM_API_KEY,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              input: finalText,
              source_language_code: 'en-IN',
              target_language_code: prefLang,
              speaker_gender: 'Female',
              mode: 'formal',
              model: 'mayura:v1',
              enable_preprocessing: false
            })
          });
          if (transRes.ok) {
            const transData = await transRes.json();
            textToSpeak = transData.translated_text || finalText;
          }
        } catch (transErr) {
          console.error('Translation failed, using English:', transErr);
        }
      }
      
      console.log('Speaking:', textToSpeak.slice(0, 50), 'lang:', prefLang);
      
      const audioBase64 = await textToSpeech(textToSpeak, prefLang, prefVoice);
      const audio = playBase64Audio(audioBase64);
      currentAudioRef.current = audio;
      
      audio.onended = () => {
        currentAudioRef.current = null;
      };
    } catch (err) {
      console.error('TTS error:', err);
    }
  };

  const stopSpeaking = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
  };

  // Auto-speak on step change
  useEffect(() => {
    if (screen === 'STEP_VIEW' && steps[currentStepIndex]) {
      speakInstruction(steps[currentStepIndex].instruction);
    }
    return () => stopSpeaking();
  }, [screen, currentStepIndex, steps]);

  // ─── Actions ───────────────────────────────────────────────────────────────
  const handleStartAudit = async (templateId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${WORKFLOW_URL}/audit/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          technician_id: technicianId,
          society_id: societyId,
          sop_template_id: templateId,
        }),
      });
      if (!res.ok) throw new Error('Failed to start audit');
      const data = await res.json();

      setAuditRunId(data.audit_run_id);
      setSteps(data.template.steps || []);
      setCurrentStepIndex(0);
      setScreen('STEP_VIEW');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // ─── Recording Logic ───────────────────────────────────────────────────────
  const startRecording = async () => {
    stopSpeaking();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((t) => t.stop());
        await handleVoiceSubmit(blob);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Mic error:', err);
      alert('Microphone access denied or error occurred.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleMicToggle = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleVoiceSubmit = async (blob: Blob) => {
    setIsProcessing(true);
    try {
      const text = await transcribeAudio(blob, prefLang);
      if (!text || typeof text !== 'string' || text.trim() === '') {
        setIsProcessing(false);
        return;
      }
      await submitStep(text);
    } catch (err) {
      console.error('Voice processing error:', err);
      setIsProcessing(false);
    }
  };

  const handleManualSubmit = async () => {
    if (!manualInput.trim()) return;
    setIsProcessing(true);
    const input = manualInput;
    setManualInput('');
    await submitStep(input);
  };

  const handleSkip = async () => {
    stopSpeaking();
    if (isRecording) stopRecording();
    setIsProcessing(true);
    await submitStep('SKIPPED');
  };

  const submitStep = async (spokenResponse: string) => {
    const currentStep = steps[currentStepIndex];
    try {
      const res = await fetch(`${WORKFLOW_URL}/audit/validate-step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audit_run_id: auditRunId,
          step_number: currentStep.step_number,
          instruction: currentStep.instruction,
          pass_criteria: currentStep.pass_criteria,
          spoken_response: spokenResponse,
          total_steps: steps.length,
        }),
      });

      if (!res.ok) throw new Error('Validation failed');
      const data = await res.json();

      // Show result badge
      setTempResult({
        step_number: currentStep.step_number,
        status: data.status,
        notes: data.notes || '',
      });

      // Wait 1.5s
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setTempResult(null);

      if (data.is_complete) {
        setSummary(data.summary || 'Audit completed successfully.');
        setAllStepsResult(data.allSteps || []);
        setScreen('COMPLETION');
      } else {
        setCurrentStepIndex((prev) => prev + 1);
        setIsProcessing(false);
      }
    } catch (err) {
      console.error(err);
      setIsProcessing(false);
    }
  };

  // ─── Rendering Helpers ─────────────────────────────────────────────────────
  const currentStep = steps[currentStepIndex];

  return (
    <div className="fixed inset-0 z-50 w-full max-w-[480px] mx-auto h-full bg-[#E0DDD9] flex flex-col font-sans animate-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <header className="bg-white px-4 py-4 border-b border-[#E0DDD9] flex items-center justify-between shadow-sm shrink-0">
        <div>
          <h1 className="text-xl font-display font-bold text-[#1C1917]">Equipment Audit</h1>
          {screen === 'STEP_VIEW' && (
            <p className="text-xs font-medium text-[#6B6560] mt-0.5">
              Step {currentStepIndex + 1} of {steps.length}
            </p>
          )}
        </div>
        <button
          onClick={() => {
            stopSpeaking();
            onClose();
          }}
          className="w-10 h-10 rounded-full bg-[#F5F3F0] flex items-center justify-center hover:bg-[#E0DDD9] transition-colors"
        >
          <X className="w-5 h-5 text-[#1C1917]" />
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-4 py-6 flex flex-col items-center">
        <div className="w-full max-w-lg mx-auto h-full flex flex-col">

          {screen === 'TEMPLATE_SELECT' && (
            <div className="flex-1 flex flex-col">
              <h2 className="text-lg font-display font-bold text-[#1C1917] mb-4">Select Template</h2>
              {loading ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-[#1A56DB] animate-spin" />
                </div>
              ) : error ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm">
                  {error}
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center text-[#6B6560] text-sm mt-10">No templates found.</div>
              ) : (
                <div className="space-y-3">
                  {templates.map((tpl) => (
                    <button
                      key={tpl.id}
                      onClick={() => handleStartAudit(tpl.id)}
                      className="w-full text-left bg-white border border-[#E0DDD9] rounded-[16px] p-4 flex items-center justify-between hover:border-[#1A56DB] transition-colors shadow-sm"
                    >
                      <div>
                        <h3 className="font-semibold text-[#1C1917]">{tpl.name}</h3>
                        <p className="text-xs text-[#6B6560] mt-1">{tpl.equipment_type}</p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-[#9C9894]" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {screen === 'STEP_VIEW' && currentStep && (
            <div className="flex-1 flex flex-col relative h-full">
              {/* Temp Result Overlay */}
              {tempResult && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#F5F3F0]/80 backdrop-blur-sm rounded-3xl animate-in fade-in duration-200">
                  <div className={`px-6 py-4 rounded-2xl flex items-center gap-3 shadow-lg border ${tempResult.status === 'pass' ? 'bg-green-50 border-green-200 text-green-700' :
                      tempResult.status === 'concern' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                        'bg-red-50 border-red-200 text-red-700'
                    }`}>
                    {tempResult.status === 'pass' && <CheckCircle2 className="w-6 h-6" />}
                    {tempResult.status === 'concern' && <AlertTriangle className="w-6 h-6" />}
                    {tempResult.status === 'fail' && <AlertCircle className="w-6 h-6" />}
                    <span className="font-bold text-lg">
                      {tempResult.status === 'pass' ? '✓ Logged' :
                        tempResult.status === 'concern' ? '⚠ Flagged' :
                          '✗ Issue'}
                    </span>
                  </div>
                </div>
              )}

              <div className="bg-white border border-[#E0DDD9] rounded-[24px] p-6 shadow-sm flex-1 flex flex-col mb-6">
                <div className="flex-1">
                  <h2 className="text-2xl font-display font-bold text-[#1C1917] leading-tight mt-4">
                    {currentStep.instruction}
                  </h2>
                </div>

                {/* Voice / Text Controls */}
                <div className="mt-8 flex flex-col items-center">
                  {isProcessing ? (
                    <div className="flex flex-col items-center gap-3 py-6">
                      <Loader2 className="w-8 h-8 text-[#1A56DB] animate-spin" />
                      <p className="text-sm font-medium text-[#6B6560]">Logging...</p>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={handleMicToggle}
                        className={`w-20 h-20 rounded-full flex items-center justify-center shadow-md transition-all ${isRecording
                            ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                            : 'bg-[#1A56DB] hover:bg-blue-700'
                          }`}
                      >
                        <Mic className={`w-8 h-8 ${isRecording ? 'text-white' : 'text-white'}`} />
                      </button>
                      <p className="text-sm font-medium text-[#1C1917] mt-4">
                        {isRecording ? 'Tap to Stop' : 'Tap to Speak'}
                      </p>

                      <div className="w-full mt-8">
                        <p className="text-xs text-center text-[#9C9894] font-medium uppercase tracking-wider mb-2">
                          Or type instead
                        </p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={manualInput}
                            onChange={(e) => setManualInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleManualSubmit()}
                            placeholder="Type observation..."
                            className="flex-1 bg-[#F5F3F0] border border-[#E0DDD9] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#1A56DB] transition-colors"
                          />
                          <button
                            onClick={handleManualSubmit}
                            disabled={!manualInput.trim()}
                            className="px-5 bg-[#1C1917] hover:bg-black disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
                          >
                            Submit
                          </button>
                        </div>
                      </div>

                      <button
                        onClick={handleSkip}
                        className="mt-6 flex items-center gap-1.5 text-xs font-semibold text-[#9C9894] hover:text-[#1C1917] transition-colors"
                      >
                        <SkipForward className="w-4 h-4" />
                        Skip step
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {screen === 'COMPLETION' && (
            <div className="flex-1 flex flex-col">
              <div className="bg-white border border-[#E0DDD9] rounded-[24px] p-6 shadow-sm mb-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <h2 className="text-2xl font-display font-bold text-[#1C1917] mb-3">Audit Complete</h2>
                <p className="text-sm text-[#1C1917] leading-relaxed mb-6 whitespace-pre-wrap">{summary}</p>

                <div className="space-y-3 mt-4">
                  <h3 className="text-sm font-bold text-[#6B6560] uppercase tracking-wider">Step Summary</h3>
                  {allStepsResult.map((res, i) => (
                    <div key={i} className="flex items-start justify-between p-3 bg-[#F5F3F0] rounded-xl border border-[#E0DDD9]">
                      <div className="pr-2">
                        <p className="text-xs font-bold text-[#1C1917]">Step {res.step_number}</p>
                        {res.notes && <p className="text-[11px] text-[#6B6560] mt-1 line-clamp-2">{res.notes}</p>}
                      </div>
                      <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${res.status === 'pass' ? 'bg-green-100 text-green-700' :
                          res.status === 'concern' ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                        }`}>
                        {res.status.toUpperCase()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full bg-[#1A56DB] hover:bg-blue-700 text-white font-bold text-base py-4 rounded-[14px] transition-colors shadow-sm"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
