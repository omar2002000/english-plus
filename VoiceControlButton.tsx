// ===== English Plus - Voice Control Button =====
'use client';
import { useState, useRef, useEffect } from 'react';
import { useApp } from '@/lib/store';
import { createVoiceRecognition, parseVoiceCommand, isVoiceControlSupported, type VoiceRecognitionResult } from '@/lib/advanced';
import { getDB } from '@/lib/db';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function VoiceControlButton({ onCommand }: { onCommand?: (action: string, params: Record<string, string>) => void }) {
  const { settings } = useApp();
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(isVoiceControlSupported());
  }, []);

  if (!settings.voiceControlEnabled || !supported) return null;

  function startListening() {
    const recognition = createVoiceRecognition(
      (result: VoiceRecognitionResult) => {
        setListening(false);
        toast.info(`🎤 سمعت: "${result.transcript}"`);
        const cmd = parseVoiceCommand(result.transcript);
        if (cmd) {
          toast.success(`✓ تنفيذ: ${cmd.action}`);
          onCommand?.(cmd.action, cmd.params);
          // Log
          const db = getDB();
          db.voiceLogs.add({
            id: crypto.randomUUID(),
            transcript: result.transcript,
            action: cmd.action,
            success: true,
            timestamp: new Date().toISOString(),
          });
        } else {
          toast.error('لم أتعرف على الأمر. جرّب: "سجل حضور أحمد" أو "احفظ الحصة"');
          const db = getDB();
          db.voiceLogs.add({
            id: crypto.randomUUID(),
            transcript: result.transcript,
            action: 'unknown',
            success: false,
            timestamp: new Date().toISOString(),
          });
        }
      },
      (error: string) => {
        setListening(false);
        if (error === 'not-allowed') {
          toast.error('يجب السماح بالوصول للميكروفون');
        } else {
          toast.error('خطأ في التعرّف الصوتي: ' + error);
        }
      },
      () => setListening(false)
    );
    if (recognition) {
      recognitionRef.current = recognition;
      recognition.start();
      setListening(true);
      toast.info('🎤 جاري الاستماع... تكلم الآن');
    }
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  return (
    <button
      onClick={listening ? stopListening : startListening}
      className={cn(
        'fixed top-20 left-4 z-40 w-12 h-12 rounded-full shadow-xl flex items-center justify-center text-white transition-all active:scale-90',
        listening
          ? 'bg-red-500 animate-pulse'
          : 'bg-gradient-to-br from-violet-500 to-purple-700 hover:scale-105'
      )}
      title="تحكم صوتي"
      style={{ left: 'auto', right: '1rem' }}
    >
      {listening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
    </button>
  );
}
