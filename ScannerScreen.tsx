// ===== English Plus - Scanner Screen =====
'use client';
import { useEffect, useState, useRef } from 'react';
import { useApp } from '@/lib/store';
import { getDB, logActivity } from '@/lib/db';
import type { Group, Student, Lesson, Attendance } from '@/lib/types';
import { parseScannedQr, formatArDate, whatsappLink, WHATSAPP_TEMPLATES, fillTemplate } from '@/lib/helpers';
import { getARCardData, type ARCardData } from '@/lib/advanced';
import { Html5Qrcode } from 'html5-qrcode';
import { ScanLine, X, Check, AlertCircle, Pin, Pause, Play, ChevronLeft, MessageCircle, CreditCard, UserCog, Send, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

export function ScannerScreen() {
  const { params, navigate, settings, refreshKey, triggerRefresh, back } = useApp();
  const groupId = params.groupId;
  const lessonId = params.lessonId;
  const [group, setGroup] = useState<Group | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [scanning, setScanning] = useState(true);
  const [lastScanned, setLastScanned] = useState<{ name: string; status: 'success' | 'duplicate' | 'notfound' } | null>(null);
  const [smartActions, setSmartActions] = useState<Student | null>(null);
  const [pinDialog, setPinDialog] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = 'qr-reader';

  useEffect(() => {
    if (!groupId || !lessonId) {
      toast.error('يجب اختيار مجموعة وحصة');
      back();
      return;
    }
    (async () => {
      const db = getDB();
      const [g, les, sts, atts] = await Promise.all([
        db.groups.get(groupId),
        db.lessons.get(lessonId),
        db.students.where('groupId').equals(groupId).toArray(),
        db.attendance.where('lessonId').equals(lessonId).toArray(),
      ]);
      if (!g || !les) { toast.error('بيانات غير صحيحة'); back(); return; }
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
      setLastScanned({ name: 'غير موجود', status: 'notfound' });
      setTimeout(() => setLastScanned(null), 1500);
      return;
    }
    const existing = attendances.find(a => a.studentId === student.id);
    if (existing && existing.status === 'present') {
      setLastScanned({ name: student.name, status: 'duplicate' });
      setTimeout(() => setLastScanned(null), 1500);
      return;
    }
    const db = getDB();
    if (existing) {
      await db.attendance.update(existing.id, { status: 'present', scannedAt: new Date().toISOString() });
      setAttendances(prev => prev.map(a => a.id === existing.id ? { ...a, status: 'present' } : a));
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
    await logActivity('scan_attendance', 'attendance', student.id, `مسح بالباركود - ${student.name}`);
    setLastScanned({ name: student.name, status: 'success' });
    // show smart actions
    setSmartActions(student);
    setTimeout(() => setLastScanned(null), 1200);
  }

  // Start scanner (after handleScan defined)
  useEffect(() => {
    if (!scanning || !lesson) return;
    let mounted = true;
    let retryCount = 0;

    const startScanner = async () => {
      try {
        // First check if camera API is available
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          toast.error('المتصفح لا يدعم الكاميرا - استخدم كود PIN');
          return;
        }
        // Request permission explicitly first
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
          // Stop the test stream immediately
          stream.getTracks().forEach(t => t.stop());
        } catch (permErr: any) {
          if (permErr.name === 'NotAllowedError' || permErr.name === 'PermissionDeniedError') {
            toast.error('يجب السماح بالوصول للكاميرا من إعدادات المتصفح');
          } else if (permErr.name === 'NotFoundError' || permErr.name === 'DevicesNotFoundError') {
            toast.error('لا توجد كاميرا - استخدم كود PIN');
          } else if (permErr.name === 'NotReadableError') {
            toast.error('الكاميرا مستخدمة بواسطة تطبيق آخر - أغلقه وحاول مجددًا');
          } else {
            toast.error('تعذّر تشغيل الكاميرا - استخدم كود PIN');
          }
          return;
        }
        const html5Qrcode = new Html5Qrcode(containerId, { verbose: false });
        scannerRef.current = html5Qrcode;
        const config = {
          fps: 10,
          qrbox: { width: 220, height: 220 },
          aspectRatio: 1,
          disableFlip: false,
        };
        // Try environment camera first
        try {
          await html5Qrcode.start(
            { facingMode: 'environment' },
            config,
            async (decodedText: string) => { await handleScan(decodedText); },
            () => {}
          );
        } catch (err) {
          // Fallback: try any camera
          await html5Qrcode.start(
            { facingMode: 'any' },
            config,
            async (decodedText: string) => { await handleScan(decodedText); },
            () => {}
          );
        }
        if (!mounted) {
          html5Qrcode.stop().catch(() => {});
        }
      } catch (e: any) {
        console.error('Scanner start failed', e);
        retryCount++;
        if (retryCount < 2) {
          setTimeout(startScanner, 1500);
        } else {
          toast.error('تعذّر تشغيل الكاميرا - استخدم كود PIN');
        }
      }
    };

    startScanner();

    return () => {
      mounted = false;
      if (scannerRef.current) {
        scannerRef.current.stop().then(() => scannerRef.current?.clear()).catch(() => {});
        scannerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning, lesson]);

  async function handlePinSubmit() {
    if (!lesson) return;
    const student = students.find(s => s.code === pinInput);
    if (!student) {
      toast.error('الكود غير صحيح');
      return;
    }
    await handleScan(JSON.stringify({ sid: student.id, code: student.code }));
    setPinInput('');
    setPinDialog(false);
  }

  function closeLesson() {
    if (!lesson || !group) return;
    const absentees = students.filter(s => !attendances.some(a => a.studentId === s.id && a.status === 'present'));
    const message = `السلام عليكم ورحمة الله وبركاته
نحيطكم علمًا بأن الطالب {student_name}
قد تغيب عن حصة اليوم ${formatArDate(new Date())}.
مع خالص التحية،
${settings.teacherName}`;
    // open whatsapp for each absentee
    let opened = 0;
    for (const s of absentees) {
      if (opened >= 5) break;
      const msg = message.replace('{student_name}', s.name);
      const url = whatsappLink(s.parentPhone, msg);
      window.open(url, '_blank');
      opened++;
    }
    if (absentees.length === 0) {
      toast.success('الكل حاضر!');
    } else {
      toast.success(`تم فتح واتساب لـ ${Math.min(absentees.length, 5)} من الغائبين`);
    }
  }

  const presentCount = attendances.filter(a => a.status === 'present').length;
  const total = students.length;
  const absentCount = total - presentCount;

  if (!group || !lesson) {
    return <div className="p-4 space-y-3">{[1, 2].map(i => <div key={i} className="h-40 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />)}</div>;
  }

  return (
    <div className="p-4 space-y-3 animate-fade-in pb-32">
      {/* Top stats */}
      <div className="rounded-2xl bg-gradient-to-l from-orange-500 to-amber-600 p-4 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs opacity-80">{formatArDate(new Date())}</div>
            <div className="font-bold">{group.name}</div>
          </div>
          <button
            onClick={() => setScanning(!scanning)}
            className="px-3 py-1.5 rounded-xl bg-white/20 text-xs font-bold flex items-center gap-1"
          >
            {scanning ? <><Pause className="w-3 h-3" /> إيقاف</> : <><Play className="w-3 h-3" /> تشغيل</>}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3 text-center">
          <div className="bg-white/10 rounded-lg py-1.5">
            <div className="text-lg font-bold">{total}</div>
            <div className="text-[10px] opacity-80">الإجمالي</div>
          </div>
          <div className="bg-white/10 rounded-lg py-1.5">
            <div className="text-lg font-bold">{presentCount}</div>
            <div className="text-[10px] opacity-80">حاضر</div>
          </div>
          <div className="bg-white/10 rounded-lg py-1.5">
            <div className="text-lg font-bold">{absentCount}</div>
            <div className="text-[10px] opacity-80">غائب</div>
          </div>
        </div>
        <div className="mt-2 h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-white transition-all" style={{ width: `${total > 0 ? (presentCount / total) * 100 : 0}%` }} />
        </div>
      </div>

      {/* Scanner viewport */}
      <div className="relative aspect-square rounded-2xl overflow-hidden bg-slate-900 shadow-lg">
        <div id={containerId} className="w-full h-full" />
        {/* Overlay frame */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-64 h-64 border-4 border-white/70 rounded-2xl relative">
            <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
            <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
            <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
            <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
          </div>
        </div>
        {/* Flash overlay */}
        {lastScanned?.status === 'success' && (
          <ARCardOverlay studentName={lastScanned.name} />
        )}
        {lastScanned?.status === 'duplicate' && (
          <div className="absolute inset-0 bg-amber-500/40 animate-fade-in flex items-center justify-center">
            <div className="bg-white rounded-2xl px-6 py-4 flex items-center gap-3 shadow-2xl">
              <AlertCircle className="w-8 h-8 text-amber-600" />
              <div>
                <div className="font-bold text-slate-800">{lastScanned.name}</div>
                <div className="text-xs text-amber-600">مسجّل مسبقاً</div>
              </div>
            </div>
          </div>
        )}
        {lastScanned?.status === 'notfound' && (
          <div className="absolute inset-0 bg-red-500/40 animate-fade-in flex items-center justify-center">
            <div className="bg-white rounded-2xl px-6 py-4 flex items-center gap-3 shadow-2xl">
              <X className="w-8 h-8 text-red-600" />
              <div className="font-bold text-slate-800">الطالب غير موجود</div>
            </div>
          </div>
        )}
        {/* Pause overlay */}
        {!scanning && (
          <div className="absolute inset-0 bg-slate-900/70 flex flex-col items-center justify-center text-white">
            <Pause className="w-12 h-12 mb-2" />
            <div className="font-bold">المسح متوقف</div>
            <button onClick={() => setScanning(true)} className="mt-3 px-4 py-2 rounded-xl bg-emerald-600 text-sm font-bold">استئناف</button>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-3 gap-2">
        <button
          onClick={() => setPinDialog(true)}
          className="py-3 rounded-xl bg-blue-600 text-white text-sm font-bold flex items-center justify-center gap-1"
        >
          <Pin className="w-4 h-4" /> PIN
        </button>
        <label className="py-3 rounded-xl bg-violet-600 text-white text-sm font-bold flex items-center justify-center gap-1 cursor-pointer active:scale-95 transition-transform">
          <Upload className="w-4 h-4" /> من الجهاز
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                // Use html5-qrcode to scan from image file
                const html5Qrcode = new Html5Qrcode('barcode-reader-file', { verbose: false });
                // Create a temporary div for scanning if not exists
                let tempDiv = document.getElementById('barcode-reader-file');
                if (!tempDiv) {
                  tempDiv = document.createElement('div');
                  tempDiv.id = 'barcode-reader-file';
                  tempDiv.style.display = 'none';
                  document.body.appendChild(tempDiv);
                }
                const decodedText = await html5Qrcode.scanFile(file, false);
                await handleScan(decodedText);
                toast.success('تم قراءة الباركود من الصورة');
              } catch (err) {
                console.error('File scan error:', err);
                toast.error('لم يتم العثور على باركود في الصورة');
              }
              e.currentTarget.value = '';
            }}
          />
        </label>
        <button
          onClick={closeLesson}
          className="py-3 rounded-xl bg-green-700 text-white text-sm font-bold flex items-center justify-center gap-1"
        >
          <Send className="w-4 h-4" /> إغلاق
        </button>
      </div>

      {/* ===== Swipe-to-Mark: Quick manual attendance list ===== */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="font-bold text-sm text-slate-700 dark:text-slate-200">المناداة السريعة (اضغط للاختبار)</div>
          <div className="text-xs text-slate-500">{presentCount}/{total} حاضر</div>
        </div>
        <div className="space-y-1.5 max-h-60 overflow-y-auto bg-slate-50 dark:bg-slate-900/30 rounded-xl p-2">
          {students.map(s => {
            const isPresent = attendances.some(a => a.studentId === s.id && a.status === 'present');
            return (
              <button
                key={s.id}
                onClick={() => handleScan(JSON.stringify({ sid: s.id, code: s.code }))}
                className={cn(
                  'w-full flex items-center gap-2 p-2 rounded-lg text-right transition-all active:scale-95',
                  isPresent ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                )}
              >
                <div className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold',
                  isPresent ? 'bg-emerald-500' : 'bg-slate-400'
                )}>
                  {isPresent ? '✓' : s.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{s.name}</div>
                  <div className="text-[10px] text-slate-500">كود: {s.code}</div>
                </div>
                {isPresent ? (
                  <span className="text-[10px] text-emerald-600 font-bold">حاضر</span>
                ) : (
                  <span className="text-[10px] text-slate-400">اضغط للحضور</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Scanned students list (live) */}
      <div>
        <div className="font-bold text-sm text-slate-700 dark:text-slate-200 mb-2">الطلاب المسجّلون ({presentCount})</div>
        <div className="space-y-1.5 max-h-60 overflow-y-auto">
          {attendances.filter(a => a.status === 'present').slice().reverse().map(a => {
            const s = students.find(st => st.id === a.studentId);
            if (!s) return null;
            return (
              <button
                key={a.id}
                onClick={() => navigate('student_profile', { id: s.id })}
                className="w-full flex items-center gap-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900"
              >
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex-1 text-right">{s.name}</span>
                <span className="text-xs text-slate-500">{new Date(a.scannedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Smart Actions Dialog */}
      <Dialog open={!!smartActions} onOpenChange={(o) => !o && setSmartActions(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>قائمة سريعة — {smartActions?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => { setSmartActions(null); toast.success('تم تسجيل الحضور'); }}
              className="py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm flex flex-col items-center gap-1"
            >
              <Check className="w-5 h-5" /> تسجيل حضور
            </button>
            <button
              onClick={() => { if (smartActions) navigate('subscriptions', { studentId: smartActions.id }); setSmartActions(null); }}
              className="py-3 rounded-xl bg-amber-600 text-white font-bold text-sm flex flex-col items-center gap-1"
            >
              <CreditCard className="w-5 h-5" /> تسجيل دفعة
            </button>
            <button
              onClick={() => { if (smartActions) navigate('student_profile', { id: smartActions.id }); setSmartActions(null); }}
              className="py-3 rounded-xl bg-blue-600 text-white font-bold text-sm flex flex-col items-center gap-1"
            >
              <UserCog className="w-5 h-5" /> بطاقة الطالب
            </button>
            <button
              onClick={() => {
                if (smartActions) {
                  const t = WHATSAPP_TEMPLATES.find(t => t.key === 'daily_report');
                  if (t) {
                    const body = fillTemplate(t.body, {
                      student_name: smartActions.name,
                      teacher_name: settings.teacherName,
                      app_name: settings.appName,
                      today: formatArDate(new Date()),
                      att: 10, mem: 0, rev: 0, hw: 0, total: 10,
                      grade: 'غير مُقيّم',
                      note: 'تم تسجيل الحضور',
                    });
                    window.open(whatsappLink(smartActions.parentPhone, body), '_blank');
                  }
                }
                setSmartActions(null);
              }}
              className="py-3 rounded-xl bg-green-700 text-white font-bold text-sm flex flex-col items-center gap-1"
            >
              <MessageCircle className="w-5 h-5" /> تقرير سريع
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* PIN Dialog */}
      <Dialog open={pinDialog} onOpenChange={setPinDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إدخال كود الطالب</DialogTitle>
          </DialogHeader>
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="••••"
            className="w-full text-center text-3xl font-bold tracking-widest py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <button
            onClick={handlePinSubmit}
            className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold"
          >
            تسجيل
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// AR Card Overlay - shows student data over the scanned card
function ARCardOverlay({ studentName }: { studentName: string }) {
  const { settings } = useApp();
  const [data, setData] = useState<ARCardData | null>(null);

  useEffect(() => {
    (async () => {
      const db = getDB();
      const students = await db.students.toArray();
      const s = students.find(s => s.name === studentName);
      if (s) {
        const arData = await getARCardData(s.id);
        setData(arData);
      }
    })();
  }, [studentName]);

  if (settings.arCardsEnabled && data) {
    // AR mode: show rich card with student data floating
    return (
      <div className="absolute inset-0 bg-emerald-500/30 animate-fade-in flex items-center justify-center">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-2xl max-w-xs w-full mx-4 animate-scale-in">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white font-bold overflow-hidden">
              {data.photo ? <img src={data.photo} alt={data.studentName} className="w-full h-full object-cover" /> : data.studentName.charAt(0)}
            </div>
            <div className="flex-1">
              <div className="font-bold text-slate-800 dark:text-slate-100">{data.studentName}</div>
              <div className="text-xs text-slate-500">{data.grade} • كود: {data.code}</div>
            </div>
            <Check className="w-6 h-6 text-emerald-600" />
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
              <div className="text-slate-500">آخر تقييم</div>
              <div className="font-bold text-emerald-600">{data.totalScore}/30</div>
              <div className="text-[10px] text-slate-400">{data.gradeLabel}</div>
            </div>
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <div className="text-slate-500">نسبة الحضور</div>
              <div className="font-bold text-blue-600">{data.attendanceRate}%</div>
            </div>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 col-span-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">المديونية</span>
                <span className={`font-bold ${data.debt > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                  {data.debt > 0 ? `${data.debt} ج.م` : 'مسدّد ✅'}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-2 text-[10px] text-slate-400 text-center">AR Card • {data.groupName}</div>
        </div>
      </div>
    );
  }

  // Normal mode: simple flash
  return (
    <div className="absolute inset-0 bg-emerald-500/40 animate-fade-in flex items-center justify-center">
      <div className="bg-white rounded-2xl px-6 py-4 flex items-center gap-3 shadow-2xl">
        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
          <Check className="w-7 h-7 text-emerald-600" />
        </div>
        <div>
          <div className="font-bold text-slate-800">{studentName}</div>
          <div className="text-xs text-emerald-600">تم تسجيل الحضور</div>
        </div>
      </div>
    </div>
  );
}
