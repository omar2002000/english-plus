// ===== English Plus - Student Profile =====
'use client';
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/lib/store';
import { getDB, logActivity } from '@/lib/db';
import type { Student, Group, Attendance, DailyEvaluation, Payment, Lesson, MessageLog, ParentToken } from '@/lib/types';
import { formatMoney, formatArDate, formatArDateShort, formatTime, GRADE_LABELS_AR, GRADE_COLORS, scheduleText, computeMonthlyStats, deriveStrengthsWeaknesses, arMonthName, whatsappLink, fillTemplate, WHATSAPP_TEMPLATES } from '@/lib/helpers';
import { generateQRDataUrl, generateBarcodeDataUrl, generateStudentCardsPDF, generateInvoicePDF, generateDailyReportPDF, downloadBlob } from '@/lib/documents';
import { generateParentToken, getStudentTokens, revokeParentToken, generateCertificateForStudent } from '@/lib/advanced';
import { PackagesManager } from '@/components/PackagesManager';
import { toast } from 'sonner';
import {
  Phone, PhoneCall, Wallet, BookOpen, CalendarDays, FileText, QrCode,
  TrendingUp, Trophy, AlertTriangle, MessageCircle, FileDown, Pencil, Archive, ChevronLeft, Receipt, CreditCard, BarChart3, History, Share2, Gift, Award, Clock, Eye, Trash2,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function StudentProfile() {
  const { params, navigate, settings, refreshKey, back, triggerRefresh } = useApp();
  const id = params.id;
  const initialTab = params.tab || 'info';
  const [student, setStudent] = useState<Student | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [evaluations, setEvaluations] = useState<DailyEvaluation[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [messages, setMessages] = useState<MessageLog[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [qrUrl, setQrUrl] = useState('');
  const [barcodeUrl, setBarcodeUrl] = useState('');
  const [tab, setTab] = useState(initialTab);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const db = getDB();
      const s = await db.students.get(id);
      if (!s) { toast.error('الطالب غير موجود'); back(); return; }
      setStudent(s);
      const g = s.groupId ? await db.groups.get(s.groupId) : null;
      setGroup(g);
      const [att, ev, pay, msg, les] = await Promise.all([
        db.attendance.where('studentId').equals(id).toArray(),
        db.evaluations.where('studentId').equals(id).toArray(),
        db.payments.where('studentId').equals(id).toArray(),
        db.messages.where('studentId').equals(id).toArray(),
        db.lessons.toArray(),
      ]);
      setAttendances(att);
      setEvaluations(ev);
      setPayments(pay.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate)));
      setMessages(msg.sort((a, b) => b.sentAt.localeCompare(a.sentAt)));
      setLessons(les);

      // Generate QR/Barcode
      if (g) {
        const payload = JSON.stringify({ app: settings.appName, sid: s.id, code: s.code, name: s.name });
        const qr = await generateQRDataUrl(payload, 220);
        setQrUrl(qr);
      } else {
        const payload = JSON.stringify({ app: settings.appName, sid: s.id, code: s.code, name: s.name });
        const qr = await generateQRDataUrl(payload, 220);
        setQrUrl(qr);
      }
      setBarcodeUrl(generateBarcodeDataUrl(s.code));
    })();
  }, [id, refreshKey, settings.appName]);

  const monthStats = useMemo(() => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const monthLessonIds = new Set(
      lessons.filter(l => {
        const d = new Date(l.date);
        return d.getMonth() + 1 === month && d.getFullYear() === year;
      }).map(l => l.id)
    );
    const monthAtt = attendances.filter(a => monthLessonIds.has(a.lessonId));
    const monthEvals = evaluations.filter(e => monthLessonIds.has(e.lessonId));
    return computeMonthlyStats(monthAtt, monthEvals);
  }, [attendances, evaluations, lessons]);

  const strengthsWeak = useMemo(() => deriveStrengthsWeaknesses(monthStats), [monthStats]);

  // Chart data: last 10 evaluations for trend visualization
  const chartData = useMemo(() => {
    const sorted = evaluations.slice().sort((a, b) => {
      const la = lessons.find(l => l.id === a.lessonId);
      const lb = lessons.find(l => l.id === b.lessonId);
      const da = la ? new Date(la.date).getTime() : 0;
      const db = lb ? new Date(lb.date).getTime() : 0;
      return da - db;
    });
    return sorted.slice(-10).map((e, i) => {
      const l = lessons.find(l => l.id === e.lessonId);
      return {
        idx: i + 1,
        date: l ? formatArDateShort(l.date) : `حصة ${i + 1}`,
        total: e.totalScore,
        mem: e.memorizationScore,
        rev: e.reviewScore,
        hw: e.homeworkScore,
      };
    });
  }, [evaluations, lessons]);

  if (!student) {
    return <div className="p-4 space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-12 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />)}</div>;
  }

  async function sendTemplate(templateKey: string) {
    if (!student) return;
    const template = WHATSAPP_TEMPLATES.find(t => t.key === templateKey);
    if (!template) return;
    const vars: Record<string, string | number> = {
      student_name: student.name,
      teacher_name: settings.teacherName,
      app_name: settings.appName,
      today: formatArDate(new Date()),
      month: arMonthName(new Date().getMonth() + 1),
      year: new Date().getFullYear(),
      debt: student.debt,
      amount: student.monthlyFee,
      remaining: student.debt,
      group_name: group?.name || '',
      att: monthStats.avgAtt,
      mem: monthStats.avgMem,
      rev: monthStats.avgRev,
      hw: monthStats.avgHw,
      total: monthStats.avgTotal,
      grade: GRADE_LABELS_AR[monthStats.grade],
      lessons: monthStats.lessonsCount,
      present: monthStats.present,
      absent: monthStats.absent,
      avg: monthStats.avgTotal,
      strengths: strengthsWeak.strengths.join('، '),
      weaknesses: strengthsWeak.weaknesses.join('، '),
      absence_count: monthStats.absent,
      last_absence: attendances.filter(a => a.status === 'absent').slice(-1)[0]
        ? formatArDateShort(attendances.filter(a => a.status === 'absent').slice(-1)[0].scannedAt)
        : '—',
      note: evaluations.slice(-1)[0]?.note || 'لا يوجد',
    };
    const body = fillTemplate(template.body, vars);
    const url = whatsappLink(student.parentPhone, body);
    window.open(url, '_blank');
    // log
    const db = getDB();
    const log: MessageLog = {
      id: crypto.randomUUID(),
      studentId: student.id,
      parentPhone: student.parentPhone,
      templateType: templateKey,
      messageBody: body,
      sentAt: new Date().toISOString(),
      status: 'sent',
    };
    await db.messages.add(log);
    await logActivity('send_message', 'student', student.id, `قالب: ${template.title}`);
    setMessages(prev => [log, ...prev]);
    toast.success('تم فتح واتساب');
  }

  async function downloadCard() {
    if (!student) return;
    toast.info('جاري توليد البطاقة...');
    const blob = await generateStudentCardsPDF([student], group ? [group] : [], settings);
    downloadBlob(blob, `card-${student.code}.pdf`);
  }

  async function downloadDailyReport() {
    if (!student) return;
    const lastEval = evaluations[evaluations.length - 1];
    const lastAtt = attendances[attendances.length - 1];
    const lastLesson = lastEval ? lessons.find(l => l.id === lastEval.lessonId) : (lastAtt ? lessons.find(l => l.id === lastAtt.lessonId) : null);
    if (!lastLesson) {
      toast.error('لا توجد حصص مسجلة');
      return;
    }
    const status = lastAtt?.status === 'absent' ? 'غائب' : lastAtt?.status === 'excused' ? 'غياب بعذر' : 'حاضر';
    const blob = await generateDailyReportPDF(student, lastLesson, group, lastEval || null, status, settings);
    downloadBlob(blob, `daily-${student.code}-${lastLesson.date.split('T')[0]}.pdf`);
  }

  async function archive() {
    if (!student) return;
    const db = getDB();
    await db.students.update(student.id, { status: 'archived', updatedAt: new Date().toISOString() });
    await logActivity('archive', 'student', student.id);
    toast.success('تمت الأرشفة');
    triggerRefresh();
    back();
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in pb-32">
      {/* Header card */}
      <div className="rounded-2xl bg-gradient-to-l from-violet-600 to-purple-700 p-4 text-white shadow-lg">
        <div className="flex items-start gap-3">
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-extrabold overflow-hidden">
            {student.photo ? <img src={student.photo} alt={student.name} className="w-full h-full object-cover" /> : student.name.charAt(0)}
          </div>
          <div className="flex-1">
            <div className="text-lg font-extrabold">{student.name}</div>
            <div className="text-sm opacity-90">{student.grade} • {student.subject}</div>
            <div className="flex items-center gap-2 mt-1 text-xs">
              <span className="px-2 py-0.5 rounded-full bg-white/20">كود: {student.code}</span>
              {student.debt > 0 && <span className="px-2 py-0.5 rounded-full bg-red-500/80">دين: {formatMoney(student.debt)}</span>}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3 text-center">
          <div className="bg-white/10 rounded-xl py-2">
            <div className="text-lg font-bold">{monthStats.present}</div>
            <div className="text-[10px] opacity-80">حضور الشهر</div>
          </div>
          <div className="bg-white/10 rounded-xl py-2">
            <div className="text-lg font-bold">{monthStats.absent}</div>
            <div className="text-[10px] opacity-80">غياب الشهر</div>
          </div>
          <div className="bg-white/10 rounded-xl py-2">
            <div className="text-lg font-bold">{monthStats.avgTotal}</div>
            <div className="text-[10px] opacity-80">متوسط /40</div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-4 gap-2">
        <ActionBtn icon={<PhoneCall className="w-5 h-5" />} label="ولي الأمر" color="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" onClick={() => window.open(`tel:${student.parentPhone}`)} />
        <ActionBtn icon={<MessageCircle className="w-5 h-5" />} label="واتساب" color="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" onClick={() => sendTemplate('custom')} />
        <ActionBtn icon={<QrCode className="w-5 h-5" />} label="البطاقة" color="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" onClick={() => setTab('card')} />
        <ActionBtn icon={<Pencil className="w-5 h-5" />} label="تعديل" color="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" onClick={() => navigate('add_student', { id: student.id })} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="info">البيانات</TabsTrigger>
          <TabsTrigger value="attendance">الحضور</TabsTrigger>
          <TabsTrigger value="payments">المدفوعات</TabsTrigger>
          <TabsTrigger value="card">البطاقة</TabsTrigger>
        </TabsList>

        {/* Info Tab */}
        <TabsContent value="info" className="space-y-3 mt-3">
          <InfoCard title="بيانات التواصل" items={[
            { label: 'هاتف الطالب', value: student.phone || '—' },
            { label: 'هاتف ولي الأمر', value: student.parentPhone },
            { label: 'رقم بديل', value: student.parentAltPhone || '—' },
          ]} />
          <InfoCard title="البيانات الدراسية" items={[
            { label: 'الصف', value: student.grade },
            { label: 'المادة', value: student.subject },
            { label: 'المجموعة', value: group?.name || 'بدون مجموعة' },
            { label: 'موعد المجموعة', value: group ? scheduleText(group) : '—' },
            { label: 'ملاحظة المواعيد', value: student.scheduleNote || '—' },
            { label: 'العام الدراسي', value: student.academicYear },
            { label: 'الفصل', value: student.semester === 'first' ? 'الأول' : 'الثاني' },
            { label: 'المدرسة', value: student.school || '—' },
            { label: 'تاريخ التسجيل', value: formatArDateShort(student.joinDate) },
          ]} />
          <InfoCard title="البيانات المالية" items={[
            { label: 'الاشتراك الشهري', value: formatMoney(student.monthlyFee) },
            { label: 'المديونية الحالية', value: formatMoney(student.debt) },
            { label: 'نظام الدفع', value: group?.paymentMode === 'start' ? 'أول الشهر' : group?.paymentMode === 'end' ? 'آخر الشهر' : '—' },
          ]} />

          {/* Packages & Scholarships */}
          <PackagesManager student={student} onRefresh={async () => {
            const db = getDB();
            const s = await db.students.get(student.id);
            if (s) setStudent(s);
          }} />

          {/* Parent App Link - v3 with advanced options */}
          <ParentTokenManager student={student} />

          {/* Certificates - v3 */}
          <CertificatesSection student={student} settings={settings} />

          {/* Monthly report mini */}
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-4">
            <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200 mb-3">
              <BarChart3 className="w-4 h-4 text-cyan-600" />
              التقرير الشهري
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <StatBox label="عدد الحصص" value={monthStats.lessonsCount} />
              <StatBox label="الحضور" value={monthStats.present} color="text-emerald-600" />
              <StatBox label="الغياب" value={monthStats.absent} color="text-red-600" />
              <StatBox label="بعذر" value={monthStats.excused} color="text-blue-600" />
              <StatBox label="متوسط الحضور" value={monthStats.avgAtt} color="text-emerald-600" />
              <StatBox label="متوسط الحفظ" value={monthStats.avgMem} color="text-blue-600" />
              <StatBox label="متوسط المراجعة" value={monthStats.avgRev} color="text-amber-600" />
              <StatBox label="متوسط الواجب" value={monthStats.avgHw} color="text-violet-600" />
              <StatBox label="المتوسط العام" value={monthStats.avgTotal} color="text-cyan-600" />
              <div className="flex flex-col">
                <span className="text-xs text-slate-500">التقدير</span>
                <span className={cn('font-bold text-sm', GRADE_COLORS[monthStats.grade].text)}>{GRADE_LABELS_AR[monthStats.grade]}</span>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 space-y-2">
              <div className="text-xs">
                <span className="font-bold text-emerald-600">نقاط القوة: </span>
                <span className="text-slate-600 dark:text-slate-300">{strengthsWeak.strengths.join('، ')}</span>
              </div>
              <div className="text-xs">
                <span className="font-bold text-amber-600">نقاط تحتاج متابعة: </span>
                <span className="text-slate-600 dark:text-slate-300">{strengthsWeak.weaknesses.join('، ')}</span>
              </div>
            </div>

            {/* ===== Chart: trend visualization (last 10 evaluations) ===== */}
            {chartData.length > 1 && (
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">📈 رسم بياني للتحسن/التراجع (آخر {chartData.length} حصص)</div>
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3">
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="idx" tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" />
                      <YAxis domain={[0, 40]} tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" />
                      <Tooltip
                        contentStyle={{ fontSize: '11px', borderRadius: '8px', direction: 'rtl' }}
                        labelFormatter={(label) => `حصة ${label}`}
                        formatter={(value: number, name: string) => {
                          const labels: Record<string, string> = { total: 'الإجمالي', mem: 'الحفظ', rev: 'المراجعة', hw: 'الواجب' };
                          return [`${value}/10`, labels[name] || name];
                        }}
                      />
                      <Line type="monotone" dataKey="total" stroke="#0891b2" strokeWidth={3} dot={{ fill: '#0891b2', r: 4 }} name="الإجمالي" />
                      <Line type="monotone" dataKey="mem" stroke="#1e3a8a" strokeWidth={1.5} dot={false} name="الحفظ" strokeDasharray="4 2" />
                      <Line type="monotone" dataKey="rev" stroke="#d97706" strokeWidth={1.5} dot={false} name="المراجعة" strokeDasharray="4 2" />
                      <Line type="monotone" dataKey="hw" stroke="#7c3aed" strokeWidth={1.5} dot={false} name="الواجب" strokeDasharray="4 2" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-2 mt-2 text-[10px]">
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-cyan-600"></span> الإجمالي/40</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-700"></span> الحفظ</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-amber-600"></span> المراجعة</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-violet-700"></span> الواجب</span>
                </div>
              </div>
            )}

            <button
              onClick={() => sendTemplate('monthly_report')}
              className="w-full mt-3 py-2 rounded-xl bg-green-600 text-white text-sm font-bold flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-4 h-4" /> إرسال التقرير لولي الأمر
            </button>
          </div>

          {student.notes || student.healthNotes || student.behaviorNotes ? (
            <InfoCard title="ملاحظات" items={[
              ...(student.notes ? [{ label: 'ملاحظات عامة', value: student.notes }] : []),
              ...(student.healthNotes ? [{ label: 'ملاحظات صحية', value: student.healthNotes }] : []),
              ...(student.behaviorNotes ? [{ label: 'ملاحظات سلوكية', value: student.behaviorNotes }] : []),
            ]} />
          ) : null}
        </TabsContent>

        {/* Attendance Tab */}
        <TabsContent value="attendance" className="space-y-3 mt-3">
          <div className="grid grid-cols-3 gap-2">
            <StatBox label="إجمالي الحضور" value={attendances.filter(a => a.status === 'present').length} color="text-emerald-600" />
            <StatBox label="إجمالي الغياب" value={attendances.filter(a => a.status === 'absent').length} color="text-red-600" />
            <StatBox label="بعذر" value={attendances.filter(a => a.status === 'excused').length} color="text-blue-600" />
          </div>
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-3">
            <div className="font-bold text-sm text-slate-700 dark:text-slate-200 mb-2">سجل الحضور</div>
            {attendances.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-sm">لا يوجد سجل</div>
            ) : (
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {attendances.slice().reverse().map(a => {
                  const lesson = lessons.find(l => l.id === a.lessonId);
                  const status = a.status === 'present' ? 'حاضر' : a.status === 'absent' ? 'غائب' : a.status === 'excused' ? 'بعذر' : 'متأخر';
                  const color = a.status === 'present' ? 'text-emerald-600' : a.status === 'absent' ? 'text-red-600' : 'text-blue-600';
                  return (
                    <div key={a.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                      <span className="text-xs text-slate-600 dark:text-slate-300">{lesson ? formatArDateShort(lesson.date) : '—'}</span>
                      <span className={cn('text-xs font-bold', color)}>{status}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments" className="space-y-3 mt-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-3 text-center">
              <div className="text-xs text-emerald-700 dark:text-emerald-300">إجمالي المدفوع</div>
              <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{formatMoney(payments.reduce((s, p) => s + p.amountPaid, 0))}</div>
            </div>
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-3 text-center">
              <div className="text-xs text-red-700 dark:text-red-300">المديونية</div>
              <div className="text-lg font-bold text-red-700 dark:text-red-300">{formatMoney(student.debt)}</div>
            </div>
          </div>
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-3">
            <div className="font-bold text-sm text-slate-700 dark:text-slate-200 mb-2">سجل المدفوعات</div>
            {payments.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-sm">لا يوجد مدفوعات</div>
            ) : (
              <div className="space-y-2">
                {payments.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                    <div>
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-200">{arMonthName(p.month)} {p.year}</div>
                      <div className="text-[10px] text-slate-500">{formatArDateShort(p.paymentDate)} • {p.invoiceNumber}</div>
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-bold text-emerald-600">{formatMoney(p.amountPaid)}</div>
                      {p.amountRemaining > 0 && <div className="text-[10px] text-red-600">متبقي: {formatMoney(p.amountRemaining)}</div>}
                    </div>
                    <button
                      onClick={async () => {
                        const blob = await generateInvoicePDF(student, group, p, settings);
                        downloadBlob(blob, `${p.invoiceNumber}.pdf`);
                      }}
                      className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center"
                    >
                      <Receipt className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => navigate('subscriptions', { studentId: student.id })}
            className="w-full py-2.5 rounded-xl bg-amber-600 text-white text-sm font-bold flex items-center justify-center gap-2"
          >
            <CreditCard className="w-4 h-4" /> تسجيل دفعة جديدة
          </button>
        </TabsContent>

        {/* Card Tab */}
        <TabsContent value="card" className="space-y-3 mt-3">
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-4 flex flex-col items-center">
            {/* Preview card */}
            <div className="w-full max-w-sm rounded-2xl bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-600 p-4 text-white shadow-xl">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-lg font-extrabold">{settings.appName}</div>
                  <div className="text-xs opacity-80">بطاقة هوية الطالب</div>
                </div>
                <div className="text-2xl font-extrabold">E+</div>
              </div>
              <div className="mt-4 font-bold text-lg">{student.name}</div>
              <div className="text-sm opacity-90 space-y-0.5">
                <div>الصف: {student.grade}</div>
                {group && <div>المجموعة: {group.name}</div>}
                {group && <div>الموعد: {scheduleText(group)}</div>}
                <div>الكود: {student.code}</div>
                <div>العام: {student.academicYear}</div>
              </div>
              <div className="mt-3 flex justify-center">
                {qrUrl && <img src={qrUrl} alt="QR" className="w-24 h-24 rounded-lg bg-white p-1" />}
              </div>
              <div className="mt-2 text-center text-xs opacity-90 border-t border-white/20 pt-2">
                {settings.teacherName} • {settings.teacherPhone}
              </div>
            </div>

            <div className="mt-3 text-xs text-slate-500 text-center">
              الكود البديل للطوارئ (PIN)
            </div>
            <div className="mt-1 text-2xl font-extrabold tracking-widest text-slate-800 dark:text-slate-100">
              {student.code}
            </div>

            {barcodeUrl && (
              <div className="mt-3">
                <img src={barcodeUrl} alt="Barcode" className="h-16" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 w-full mt-4">
              <button
                onClick={downloadCard}
                className="py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold flex items-center justify-center gap-2"
              >
                <FileDown className="w-4 h-4" /> تحميل PDF
              </button>
              <button
                onClick={() => sendTemplate('welcome')}
                className="py-2.5 rounded-xl bg-green-600 text-white text-sm font-bold flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" /> مشاركة واتساب
              </button>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Bottom actions */}
      <div className="fixed bottom-0 left-0 right-0 z-20 p-3 glass border-t border-slate-200 dark:border-slate-700 safe-bottom" style={{ maxWidth: '480px', margin: '0 auto' }}>
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={downloadDailyReport}
            className="py-2.5 rounded-xl bg-cyan-600 text-white text-xs font-bold flex items-center justify-center gap-1"
          >
            <FileText className="w-4 h-4" /> تقرير اليوم
          </button>
          <button
            onClick={() => sendTemplate('payment_reminder')}
            className="py-2.5 rounded-xl bg-amber-600 text-white text-xs font-bold flex items-center justify-center gap-1"
          >
            <Wallet className="w-4 h-4" /> تذكير دفع
          </button>
          <button
            onClick={archive}
            className="py-2.5 rounded-xl bg-slate-400 text-white text-xs font-bold flex items-center justify-center gap-1"
          >
            <Archive className="w-4 h-4" /> أرشفة
          </button>
        </div>
      </div>
    </div>
  );
}

function ActionBtn({ icon, label, color, onClick }: { icon: React.ReactNode; label: string; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 hover:shadow-md transition-all active:scale-95">
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', color)}>{icon}</div>
      <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">{label}</span>
    </button>
  );
}

function InfoCard({ title, items }: { title: string; items: Array<{ label: string; value: string }> }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-4">
      <div className="font-bold text-sm text-slate-700 dark:text-slate-200 mb-2">{title}</div>
      <div className="space-y-1.5">
        {items.map((it, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-slate-500">{it.label}</span>
            <span className="font-semibold text-slate-700 dark:text-slate-200 text-left">{it.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={cn('font-bold text-sm', color || 'text-slate-800 dark:text-slate-100')}>{value}</span>
    </div>
  );
}

// ===== Parent Token Manager (v3 - with expiration + open count) =====
function ParentTokenManager({ student }: { student: Student }) {
  const { settings } = useApp();
  const [tokens, setTokens] = useState<ParentToken[]>([]);
  const [showOptions, setShowOptions] = useState(false);
  const [expirationDays, setExpirationDays] = useState<number>(30);
  const [maxOpens, setMaxOpens] = useState<number>(0); // 0 = unlimited

  useEffect(() => {
    (async () => {
      const t = await getStudentTokens(student.id);
      setTokens(t);
    })();
  }, [student.id]);

  async function generateLink() {
    const options: { expiresAt?: string; maxOpens?: number } = {};
    if (expirationDays > 0) {
      const d = new Date();
      d.setDate(d.getDate() + expirationDays);
      options.expiresAt = d.toISOString();
    }
    if (maxOpens > 0) options.maxOpens = maxOpens;
    const token = await generateParentToken(student.id, options);
    const url = `${window.location.origin}/?parent=${token}`;
    await navigator.clipboard.writeText(url).catch(() => {});
    toast.success('تم نسخ الرابط - يمكنك مشاركته مع ولي الأمر');
    const t = await getStudentTokens(student.id);
    setTokens(t);
    setShowOptions(false);
    if (confirm('هل تريد فتح معاينة لتطبيق ولي الأمر؟')) {
      window.open(url, '_blank');
    }
  }

  async function revoke(token: string) {
    if (!confirm('إلغاء هذا الرابط؟ لن يعمل بعد الآن.')) return;
    await revokeParentToken(token);
    const t = await getStudentTokens(student.id);
    setTokens(t);
    toast.success('تم إلغاء الرابط');
  }

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-4">
      <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200 mb-2">
        <Share2 className="w-4 h-4 text-blue-600" />
        تطبيق ولي الأمر (آمن)
      </div>
      <p className="text-xs text-slate-500 mb-3">أنشئ رابطاً خاصاً لولي الأمر ليرى حالة الطالب (للقراءة فقط) مع خيارات أمان متقدمة</p>

      {/* Existing tokens */}
      {tokens.length > 0 && (
        <div className="space-y-2 mb-3">
          {tokens.slice(0, 3).map(t => (
            <div key={t.token} className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center justify-between">
                <div className="text-xs">
                  <div className="font-bold text-slate-700 dark:text-slate-200">
                    {t.active ? '✓ نشط' : '✗ ملغي'}
                    {t.expiresAt && <span className="text-amber-600 mr-2">• ينتهي: {formatArDateShort(t.expiresAt)}</span>}
                  </div>
                  <div className="text-slate-500 mt-0.5">
                    فتح: {t.opensCount}{t.maxOpens ? `/${t.maxOpens}` : ' (غير محدود)'} مرة
                  </div>
                </div>
                {t.active && (
                  <button
                    onClick={() => revoke(t.token)}
                    className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 flex items-center justify-center"
                    title="إلغاء الرابط"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!showOptions ? (
        <button
          onClick={() => setShowOptions(true)}
          className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold flex items-center justify-center gap-2"
        >
          <Share2 className="w-4 h-4" /> توليد رابط جديد
        </button>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">مدة الصلاحية (يوم) - 0 = دائم</label>
            <select value={expirationDays} onChange={e => setExpirationDays(Number(e.target.value))} className="w-full mt-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-sm">
              <option value={0}>دائم (بدون انتهاء)</option>
              <option value={7}>أسبوع</option>
              <option value={30}>شهر</option>
              <option value={90}>3 شهور</option>
              <option value={365}>سنة</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 dark:text-slate-300">الحد الأقصى لعدد الفتح (0 = غير محدود)</label>
            <select value={maxOpens} onChange={e => setMaxOpens(Number(e.target.value))} className="w-full mt-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-sm">
              <option value={0}>غير محدود</option>
              <option value={10}>10 مرات</option>
              <option value={50}>50 مرة</option>
              <option value={100}>100 مرة</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setShowOptions(false)} className="py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold">إلغاء</button>
            <button onClick={generateLink} className="py-2 rounded-xl bg-blue-600 text-white text-xs font-bold">توليد ونسخ</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== Certificates Section (v3) =====
function CertificatesSection({ student, settings }: { student: Student; settings: any }) {
  const [generating, setGenerating] = useState<string | null>(null);

  async function generateCert(type: 'excellence' | 'commitment' | 'improvement') {
    setGenerating(type);
    try {
      const blob = await generateCertificateForStudent(student.id, type, settings);
      if (blob) {
        downloadBlob(blob, `certificate-${student.code}-${type}.pdf`);
        toast.success('تم توليد الشهادة');
      } else {
        toast.error('تعذّر توليد الشهادة');
      }
    } catch (e) {
      console.error(e);
      toast.error('خطأ في توليد الشهادة');
    } finally {
      setGenerating(null);
    }
  }

  const certs = [
    { type: 'excellence' as const, title: 'شهادة تفوق', icon: '🏆', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300', desc: 'للحاصلين على أعلى الدرجات (36+/40)' },
    { type: 'commitment' as const, title: 'شهادة التزام', icon: '✅', color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300', desc: 'للملتزمين بالحضور (90%+)' },
    { type: 'improvement' as const, title: 'شهادة تحسّن', icon: '📈', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300', desc: 'لمن أظهروا تحسناً ملحوظاً' },
  ];

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-4">
      <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200 mb-3">
        <Award className="w-4 h-4 text-amber-500" />
        الشهادات الشهرية
      </div>
      <div className="space-y-2">
        {certs.map(c => (
          <button
            key={c.type}
            onClick={() => generateCert(c.type)}
            disabled={generating === c.type}
            className={cn('w-full p-3 rounded-xl border text-right transition-all disabled:opacity-50', c.color, 'border-current/20 hover:scale-[1.02]')}
          >
            <div className="flex items-center gap-2">
              <span className="text-2xl">{c.icon}</span>
              <div className="flex-1">
                <div className="font-bold text-sm">{c.title}</div>
                <div className="text-[10px] opacity-80">{c.desc}</div>
              </div>
              {generating === c.type ? (
                <div className="text-xs">جاري...</div>
              ) : (
                <FileDown className="w-4 h-4" />
              )}
            </div>
          </button>
        ))}
      </div>
      <p className="text-[10px] text-slate-400 mt-2 text-center">الشهادة تتضمن اسم الطالب، المتوسط، نسبة الحضور، والمركز (إن كان من أوائل الطلبة)</p>
    </div>
  );
}
