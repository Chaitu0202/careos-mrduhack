import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '../../lib/utils';

export type VoiceState = 'idle' | 'listening' | 'processing';

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return Boolean(win.SpeechRecognition || win.webkitSpeechRecognition);
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speakCareOSConfirmation(text: string, enabled: boolean): void {
  if (!enabled || !text.trim() || !isSpeechSynthesisSupported()) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 0.9;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Ignore synthesis interruption silently
  }
}

export function useVoiceAssistant({
  onTranscriptUpdate,
  onFinalStop,
}: {
  onTranscriptUpdate: (transcript: string) => void;
  onFinalStop?: (transcript: string) => void;
}) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const latestTranscriptRef = useRef<string>('');
  const manualStopRef = useRef(false);

  const supported = isSpeechRecognitionSupported();

  const stopListening = useCallback(
    (transitionToProcessing = true) => {
      manualStopRef.current = true;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Ignore stop errors if already stopped
        }
        recognitionRef.current = null;
      }
      if (transitionToProcessing && latestTranscriptRef.current.trim()) {
        setVoiceState('processing');
        setTimeout(() => {
          setVoiceState('idle');
          onFinalStop?.(latestTranscriptRef.current.trim());
        }, 420);
      } else {
        setVoiceState('idle');
      }
    },
    [onFinalStop]
  );

  const startListening = useCallback(
    (initialPrefix = '') => {
      setVoiceError(null);
      if (!supported) {
        setVoiceError(
          'Voice recognition is not supported in this browser. Try Chrome, Edge, or Safari, or type your instruction.'
        );
        return;
      }

      const win = window as unknown as {
        SpeechRecognition?: new () => SpeechRecognitionLike;
        webkitSpeechRecognition?: new () => SpeechRecognitionLike;
      };
      const RecognitionCtor = win.SpeechRecognition || win.webkitSpeechRecognition;
      if (!RecognitionCtor) return;

      if (recognitionRef.current) {
        stopListening(false);
      }

      try {
        const recognition = new RecognitionCtor();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
        manualStopRef.current = false;
        const baseText = initialPrefix.trim();
        latestTranscriptRef.current = baseText;

        recognition.onresult = (event) => {
          let finalChunk = '';
          let interimChunk = '';
          for (let i = 0; i < event.results.length; i++) {
            const res = event.results[i];
            const txt = res[0]?.transcript ?? '';
            if (res.isFinal) finalChunk += `${txt} `;
            else interimChunk += txt;
          }
          const combined = [baseText, finalChunk.trim(), interimChunk.trim()].filter(Boolean).join(' ').trim();
          latestTranscriptRef.current = combined;
          onTranscriptUpdate(combined);
        };

        recognition.onerror = (event) => {
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            setVoiceError(
              'Microphone permission was denied. Enable microphone access in browser settings to use voice commands.'
            );
          } else if (event.error === 'no-speech') {
            setVoiceError('No speech detected. Speak clearly or try recording again.');
          } else if (event.error === 'audio-capture') {
            setVoiceError('No microphone input device detected on this system.');
          } else if (event.error !== 'aborted') {
            setVoiceError(`Voice input interrupted (${event.error}). You can edit or type your instruction.`);
          }
          setVoiceState('idle');
          recognitionRef.current = null;
        };

        recognition.onend = () => {
          if (!manualStopRef.current) {
            setVoiceState('idle');
          }
          recognitionRef.current = null;
        };

        recognitionRef.current = recognition;
        recognition.start();
        setVoiceState('listening');
      } catch {
        setVoiceError('Unable to access microphone. Check browser permissions and try again.');
        setVoiceState('idle');
      }
    },
    [onTranscriptUpdate, stopListening, supported]
  );

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Ignore cleanup errors
        }
      }
    };
  }, []);

  return {
    voiceState,
    voiceError,
    supported,
    startListening,
    stopListening,
    clearVoiceError: () => setVoiceError(null),
  };
}

export function VoiceWaveform({ state }: { state: VoiceState }) {
  const reduced = useReducedMotion();
  const bars = [0.4, 0.85, 1, 0.7, 0.95, 0.55];

  if (state === 'idle') return null;

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[#BFDDFB] bg-[#EAF5FF] px-3 py-1">
      <div className="flex h-4 items-center gap-0.5" aria-hidden="true">
        {bars.map((peak, idx) => (
          <motion.span
            key={idx}
            className="w-0.5 rounded-full bg-[#3299F5]"
            animate={
              reduced
                ? { height: 10 }
                : state === 'listening'
                ? { height: [4, 15 * peak, 5] }
                : { height: [6, 10, 6], opacity: [0.5, 1, 0.5] }
            }
            transition={{
              duration: state === 'listening' ? 0.65 : 0.9,
              repeat: Infinity,
              delay: idx * 0.08,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
      <span className="text-[11px] font-semibold text-[#102653]">
        {state === 'listening' ? 'Listening...' : 'Processing speech...'}
      </span>
    </div>
  );
}

export function VoiceControlButton({
  voiceState,
  onToggle,
}: {
  voiceState: VoiceState;
  onToggle: () => void;
}) {
  const reduced = useReducedMotion();
  const isListening = voiceState === 'listening';
  const isProcessing = voiceState === 'processing';

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isListening ? 'Stop voice recording' : 'Start voice instruction'}
      title={isListening ? 'Stop listening' : 'Speak instruction to CareOS'}
      className={cn(
        'relative inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors',
        isListening
          ? 'border-[#3299F5] bg-[#3299F5] text-white shadow-sm'
          : isProcessing
          ? 'border-[#62C5F5] bg-[#EAF5FF] text-[#3299F5]'
          : 'border-[#DCE8F5] bg-white text-[#4F627D] hover:border-[#3299F5] hover:bg-[#EAF5FF] hover:text-[#3299F5]'
      )}
    >
      {isListening && !reduced && (
        <motion.span
          className="absolute inset-0 rounded-full border-2 border-[#3299F5]"
          animate={{ scale: [1, 1.45], opacity: [0.65, 0] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
          aria-hidden="true"
        />
      )}
      {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
    </button>
  );
}

export function VoiceSynthesisStatusBadge({
  enabled,
  onToggle,
}: {
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors',
        enabled
          ? 'border-[#BFDDFB] bg-[#EAF5FF] text-[#102653]'
          : 'border-[#E3EDF6] bg-white text-[#71839C]'
      )}
      title="Toggle CareOS spoken confirmations"
    >
      <Volume2 className={cn('h-3.5 w-3.5', enabled ? 'text-[#3299F5]' : 'text-[#71839C]')} />
      <span>Voice Responses: {enabled ? 'On' : 'Off'}</span>
    </button>
  );
}
