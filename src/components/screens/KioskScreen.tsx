// ===== English Plus - Kiosk Mode =====
'use client';
import { useEffect, useState, useRef } from 'react';
import { useApp } from '@/lib/store';
import { getDB, logActivity } from '@/lib/db';
import type { Group, Student, Lesson, Attendance } from '@/lib/types';
import { parseScannedQr } from '@/lib/helpers';
import { Html5Qrcode } from 'html5-qrcode';
import { Check, X, Lock, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function KioskScreen() {
  const { params, settings, back, refreshKey } = useApp();
  const groupId = params.groupId;
  const lessonId = params.lessonId;
  const [group, setGroup] = useState<Group | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [flash, setFlash] = useState<{ type: 'green' | 'red'; student?: Student; msg: string } | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'kiosk-reader';

  useEffect(() => {
    if (!groupId || !lessonId) { back(); return; }
    (async () => {
      const db = getDB();
      const [g, les, sts, atts] = await Promise.all([
        db.groups.get(groupId),
        db.lessons.get(lessonId),
        db.students.where('groupId').equals(groupId).toArray(),
        db.attendance.where('lessonId').equals(lessonId).toArray(),
      ]);
      if (!g || !les) { back(); return; }
      setGroup(g);
      setLesson(les);
      setStudents(sts.filter(s => s.status === 'active'));
      setAttendances(atts);
    })();
  }, [groupId, lessonId, refreshKey, back]);

  async function handleScan(raw: string) {
    if (!lesson) return;
    const parsed = parseScannedQr(raw);
    if (!parsed) return;
    const student = students.find(s => (parsed.sid && s.id === parsed.sid) || (parsed.code && s.code === parsed.code));
    if (!student) {
      setFlash({ type: 'red', msg: 'الطالب غير موجود في المجموعة' });
      setTimeout(() => setFlash(null), 2000);
      return;
    }
    const existing = attendances.find(a => a.studentId === student.id && a.status === 'present');
    if (existing) {
      setFlash({ type: 'red', student, msg: 'مسجّل مسبقاً' });
      setTimeout(() => setFlash(null), 2000);
      return;
    }
    const db = getDB();
    if (attendances.some(a => a.studentId === student.id)) {
      await db.attendance.where('studentId').equals(student.id).modify({ status: 'present', scannedAt: new Date().toISOString() });
      setAttendances(prev => prev.map(a => a.studentId === student.id ? { ...a, status: 'present' } : a));
    } else {
      const att: Attendance = {
        id: crypto.randomUUID(),
        studentId: student.id,
        lessonId: lesson.id,
        groupId: lesson.groupId,
        status: 'present',
        scannedAt: new Date().toISOString(),
      };
      await db.attendance.add(att);
      setAttendances(prev => [...prev, att]);
      await db.students.update(student.id, { lastAttendance: new Date().toISOString() });
    }
    await logActivity('kiosk_scan', 'attendance', student.id, `بوابة - ${student.name}`);
    setFlash({ type: 'green', student, msg: student.debt > 0 ? 'لديك متأخرات' : 'مرحباً بك' });
    setTimeout(() => setFlash(null), 2500);
  }

  useEffect(() => {
    if (!lesson) return;
    let mounted = true;
    let retryCount = 0;
    const start = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          toast.error('المتصفح لا يدعم الكاميرا');
          return;
        }
        // Pre-check permission
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          stream.getTracks().forEach(t => t.stop());
        } catch (e: any) {
          toast.error('يجب السماح بالكاميرا لاستخدام وضع البوابة');
          return;
        }
        const html5Qrcode = new Html5Qrcode(containerId, { verbose: false });
        scannerRef.current = html5Qrcode;
        const config = { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 };
        try {
          await html5Qrcode.start(
            { facingMode: 'environment' },
            config,
            async (text: string) => { await handleScan(text); },
            () => {}
          );
        } catch (err) {
          await html5Qrcode.start(
            { facingMode: 'any' },
            config,
            async (text: string) => { await handleScan(text); },
            () => {}
          );
        }
        if (!mounted) html5Qrcode.stop().catch(() => {});
      } catch (e) {
        console.error(e);
        retryCount++;
        if (retryCount < 2) setTimeout(start, 1500);
        else toast.error('تعذّر تشغيل الكاميرا');
      }
    };
    start();
    return () => {
      mounted = false;
      if (scannerRef.current) {
        scannerRef.current.stop().then(() => scannerRef.current?.clear()).catch(() => {});
        scannerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson]);

  if (!group || !lesson) {
    return <div className="p-4 space-y-3">{[1, 2].map(i => <div key={i} className="h-40 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />)}</div>;
  }

  const presentCount = attendances.filter(a => a.status === 'present').length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col" style={{ maxWidth: '480px', margin: '0 auto' }}>
      {/* Top bar */}
      <div className="p-4 flex items-center justify-between text-white">
        <div>
          <div className="text-xs opacity-70">وضع البوابة الذاتية</div>
          <div className="font-bold text-lg">{group.name}</div>
        </div>
        <button onClick={back} className="px-3 py-2 rounded-xl bg-white/10 text-xs font-bold flex items-center gap-1">
          <Lock className="w-3 h-3" /> خروج
        </button>
      </div>

      {/* Flash overlay */}
      {flash && (
        <div
          className={cn(
            'fixed inset-0 z-50 flex flex-col items-center justify-center text-white transition-all',
            flash.type === 'green' ? 'bg-emerald-600' : 'bg-red-600'
          )}
          style={{ maxWidth: '480px', margin: '0 auto' }}
        >
          {flash.type === 'green' ? (
            <>
              <div className="w-32 h-32 rounded-full bg-white/20 flex items-center justify-center mb-4 animate-scale-in">
                <Check className="w-20 h-20" />
              </div>
              <div className="text-3xl font-extrabold mb-2">{flash.student?.name}</div>
              <div className="text-lg opacity-90">{flash.msg}</div>
              {flash.student && flash.student.debt > 0 && (
                <div className="mt-4 px-4 py-2 rounded-xl bg-red-900/60 font-bold">
                  متأخرات: {flash.student.debt} ج.م
                </div>
              )}
            </>
          ) : (
            <>
              <div className="w-32 h-32 rounded-full bg-white/20 flex items-center justify-center mb-4 animate-scale-in">
                <X className="w-20 h-20" />
              </div>
              <div className="text-3xl font-extrabold mb-2">{flash.student?.name || 'تنبيه'}</div>
              <div className="text-lg opacity-90">{flash.msg}</div>
            </>
          )}
        </div>
      )}

      {/* Camera viewport */}
      <div className="flex-1 relative">
        <div id={containerId} className="w-full h-full" />
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-72 h-72 border-4 border-white/60 rounded-3xl" />
        </div>
      </div>

      {/* Bottom info */}
      <div className="p-6 text-center text-white">
        <div className="text-5xl font-extrabold mb-1">{presentCount}</div>
        <div className="text-sm opacity-70">طالب حضر حتى الآن</div>
        <div className="mt-3 text-xs opacity-50">امسح بطاقتك للدخول</div>
      </div>
    </div>
  );
}
