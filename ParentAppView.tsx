// ===== English Plus - Parent App View (v4 - Complete Redesign) =====
'use client';
import { useEffect, useState } from 'react';
import { useApp } from '@/lib/store';
import { getParentAppData, validateParentToken } from '@/lib/advanced';
import { formatArDate, formatArDateShort, arMonthName, formatMoney, GRADE_LABELS_AR, GRADE_COLORS, scheduleText, getGroupDays } from '@/lib/helpers';
import { BookOpen, CalendarDays, Wallet, MessageCircle, Trophy, AlertCircle, TrendingUp, Phone, Award, CheckCircle2, Lock, Clock, FileDown, GraduationCap, Users, BarChart3, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Student, Group, Lesson, Attendance, DailyEvaluation, Payment } from '@/lib/types';

interface ParentData {
  student: Student;
  group: Group | null;
  todayStats: { present: number; absent: number; avgTotal: number; grade: string };
  monthlyStats: { lessonsCount: number; present: number; absent: number; avgTotal: number; grade: string; strengths: string[]; weaknesses: string[] };
  recentEvals: Array<{ date: string; total: number; grade: string; note?: string }>;
  payments: Array<{ date: string; amount: number; month: number; year: number; remaining: number; invoiceNo: string }>;
  upcomingLessons: Group[];
  messages: Array<{ date: string; template: string; body: string }>;
  teacherName: string;
  teacherPhone: string;
  appName: string;
}

export function ParentAppView({ token }: { token: string }) {
  const { settings } = useApp();
  const [data, setData] = useState<ParentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const validation = await validateParentToken(token);
      if (!validation.valid) {
        setError(validation.reason || 'الرابط غير صالح');
        setLoading(false);
        return;
      }
      const r = await getParentAppData(token, settings);
      if (!r) {
        setError('تعذّر تحميل البيانات');
      } else {
        setData(r as ParentData);
      }
      setLoading(false);
    })();
  }, [token, settings]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-cyan-900 flex items-center justify-center p-4">
        <div className="text-white text-center">
          <div className="w-20 h-20 rounded-3xl bg-white/10 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-3xl font-extrabold">E+</span>
          </div>
          <div className="text-sm opacity-80">جارٍ التحميل...</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-rose-800 to-red-900 flex items-center justify-center p-4">
        <div className="text-white text-center">
          <AlertCircle className="w-16 h-16 mx-auto mb-3" />
          <div className="font-bold text-lg mb-1">الرابط غير صالح</div>
          <div className="text-sm opacity-80">{error || 'تعذّر تحميل البيانات'}</div>
        </div>
      </div>
    );
  }

  const { student, group, monthlyStats, recentEvals, payments, teacherName, teacherPhone, appName } = data;
  const present = monthlyStats.present;
  const absent = monthlyStats.absent;
  const attendanceRate = monthlyStats.lessonsCount > 0 ? Math.round((present / monthlyStats.lessonsCount) * 100) : 0;
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const lastPayment = payments[0];
  const nextPaymentMonth = lastPayment ? lastPayment.month + 1 : new Date().getMonth() + 1;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-12">
      {/* Header */}
      <div className="bg-gradient-to-l from-blue-800 to-cyan-700 p-5 text-white shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs opacity-80">{appName}</div>
            <div className="text-lg font-extrabold">بوابة ولي الأمر</div>
          </div>
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center overflow-hidden">
            {student.photo ? <img src={student.photo} alt={student.name} className="w-full h-full object-cover" /> : <span className="text-2xl font-extrabold">{student.name.charAt(0)}</span>}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-md mx-auto">
        {/* 1. Student Data */}
        <Section icon={<GraduationCap className="w-5 h-5" />} title="بيانات الطالب" color="from-violet-600 to-purple-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white font-extrabold text-2xl overflow-hidden">
              {student.photo ? <img src={student.photo} alt={student.name} className="w-full h-full object-cover" /> : student.name.charAt(0)}
            </div>
            <div>
              <div className="font-bold text-lg text-slate-800 dark:text-slate-100">{student.name}</div>
              <div className="text-xs text-slate-500">كود: {student.code}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <InfoRow label="المجموعة" value={group?.name || '—'} />
            <InfoRow label="الصف الدراسي" value={student.grade} />
            <InfoRow label="المادة" value={student.subject} />
            <InfoRow label="تاريخ الالتحاق" value={formatArDateShort(student.joinDate)} />
          </div>
        </Section>

        {/* 2. Group Schedules */}
        {group && (
          <Section icon={<CalendarDays className="w-5 h-5" />} title="مواعيد المجموعة" color="from-emerald-600 to-green-700">
            <div className="space-y-1.5">
              {(group.schedules && group.schedules.length > 0 ? group.schedules : [{ id: '1', day: group.scheduleDay, hour: group.scheduleHour, minute: group.scheduleMinute, period: group.schedulePeriod }]).map((s, i) => {
                const period = s.period === 'am' ? 'صباحاً' : 'مساءً';
                const h = s.hour % 12 || 12;
                return (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                    <span className="font-bold text-slate-700 dark:text-slate-200">{s.day}</span>
                    <span className="text-slate-600 dark:text-slate-300">{h}:{String(s.minute).padStart(2, '0')} {period}</span>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {/* 3. Lesson Log (last 10) */}
        <Section icon={<BookOpen className="w-5 h-5" />} title="سجل الحصص (آخر 10)" color="from-cyan-600 to-teal-700">
          {recentEvals.length === 0 ? (
            <div className="text-center py-4 text-slate-400 text-sm">لا يوجد سجل</div>
          ) : (
            <div className="space-y-1.5">
              {recentEvals.slice(0, 10).map((e, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                  <span className="text-xs text-slate-600 dark:text-slate-300">{e.date}</span>
                  <span className={cn('text-xs font-bold', e.total > 0 ? 'text-emerald-600' : 'text-red-600')}>
                    {e.total > 0 ? `حاضر - ${e.total}/30` : 'غائب'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* 4. Attendance Stats */}
        <Section icon={<Users className="w-5 h-5" />} title="الحضور والغياب" color="from-orange-600 to-amber-700">
          <div className="grid grid-cols-4 gap-2 text-center">
            <StatBox label="الحضور" value={present} color="text-emerald-600" />
            <StatBox label="الغياب" value={absent} color="text-red-600" />
            <StatBox label="بعذر" value={monthlyStats.lessonsCount - present - absent} color="text-blue-600" />
            <StatBox label="النسبة" value={`${attendanceRate}%`} color="text-violet-600" />
          </div>
        </Section>

        {/* 5. Monthly Stats */}
        <Section icon={<BarChart3 className="w-5 h-5" />} title="الإحصائيات الشهرية" color="from-blue-600 to-indigo-700">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <InfoRow label="عدد الحصص" value={String(monthlyStats.lessonsCount)} />
            <InfoRow label="المتوسط العام" value={`${monthlyStats.avgTotal}/30`} />
            <InfoRow label="التقدير الشهري" value={monthlyStats.grade} />
            <InfoRow label="نسبة الحضور" value={`${attendanceRate}%`} />
          </div>
          {monthlyStats.strengths.length > 0 && (
            <div className="mt-2 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
              <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300 mb-1">✅ نقاط القوة</div>
              <div className="text-xs text-slate-700 dark:text-slate-200">{monthlyStats.strengths.join('، ')}</div>
            </div>
          )}
          {monthlyStats.weaknesses.length > 0 && (
            <div className="mt-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
              <div className="text-xs font-bold text-amber-700 dark:text-amber-300 mb-1">⚠️ يحتاج متابعة</div>
              <div className="text-xs text-slate-700 dark:text-slate-200">{monthlyStats.weaknesses.join('، ')}</div>
            </div>
          )}
        </Section>

        {/* 6. Teacher Notes */}
        {recentEvals.some(e => e.note) && (
          <Section icon={<ClipboardList className="w-5 h-5" />} title="ملاحظات المعلم" color="from-amber-600 to-orange-700">
            <div className="space-y-1.5">
              {recentEvals.filter(e => e.note).slice(0, 5).map((e, i) => (
                <div key={i} className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                  <div className="text-[10px] text-slate-400">{e.date}</div>
                  <div className="text-xs text-slate-700 dark:text-slate-200">{e.note}</div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* 7. Financial Status — v7 Enhanced with full details */}
        <Section icon={<Wallet className="w-5 h-5" />} title="الحالة المالية التفصيلية" color="from-amber-600 to-yellow-700">
          <div className="space-y-2">
            {/* Main info */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <InfoRow label="الاشتراك الشهري" value={formatMoney(student.monthlyFee)} />
              <InfoRow label="إجمالي المدفوع (كلي)" value={formatMoney(totalPaid)} />
              <InfoRow label="المديونية الحالية" value={formatMoney(student.debt)} color={student.debt > 0 ? 'text-red-600' : 'text-emerald-600'} />
              <InfoRow label="المتبقي هذا الشهر" value={formatMoney(Math.max(0, student.monthlyFee - (payments.filter(p => p.month === new Date().getMonth() + 1 && p.year === new Date().getFullYear()).reduce((s, p) => s + p.amount, 0))))} color="text-amber-600" />
            </div>

            {/* Last payment details */}
            {lastPayment && (
              <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
                <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300 mb-1">آخر دفعة</div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-300">التاريخ: {formatArDateShort(lastPayment.date)}</span>
                  <span className="font-bold text-emerald-600">{formatMoney(lastPayment.amount)}</span>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-slate-500">الشهر: {arMonthName(lastPayment.month)} {lastPayment.year}</span>
                  <span className="text-slate-500">{lastPayment.remaining > 0 ? `متبقي: ${formatMoney(lastPayment.remaining)}` : 'مسدد كامل ✅'}</span>
                </div>
              </div>
            )}

            {/* Next payment */}
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <div className="flex justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300">موعد الدفعة القادمة:</span>
                <span className="font-bold text-blue-600">{arMonthName(nextPaymentMonth)} {new Date().getFullYear()}</span>
              </div>
            </div>

            {/* Overdue debt warning */}
            {student.debt > 0 && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  <div className="text-xs font-bold text-red-700 dark:text-red-300">⚠️ متأخرات مالية</div>
                </div>
                <div className="text-xs text-slate-700 dark:text-slate-200">
                  يوجد مديونية متأخرة بقيمة <strong className="text-red-600">{formatMoney(student.debt)}</strong>
                  <br />
                  يشمل ذلك متأخرات من شهور سابقة. يرجى تسويتها في أقرب فرصة.
                </div>
              </div>
            )}

            {/* Status badge */}
            <div className="flex justify-center">
              <span className={cn('px-4 py-1.5 rounded-full text-sm font-bold', student.debt > 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300')}>
                {student.debt > 0 ? '🔔 متأخر في السداد' : '✅ مسدد بالكامل'}
              </span>
            </div>
          </div>
        </Section>

        {/* 8. Payment History */}
        {payments.length > 0 && (
          <Section icon={<Wallet className="w-5 h-5" />} title="سجل الدفعات" color="from-slate-600 to-slate-800">
            <div className="space-y-1.5">
              {payments.slice(0, 10).map((p, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                  <div>
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-200">{formatArDateShort(p.date)}</div>
                    <div className="text-[10px] text-slate-500">{arMonthName(p.month)} {p.year} • {p.invoiceNo}</div>
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-bold text-emerald-600">{formatMoney(p.amount)}</div>
                    <div className="text-[10px] text-slate-400">{p.remaining > 0 ? `متبقي: ${formatMoney(p.remaining)}` : 'مسدد كامل'}</div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* 9. Download Report */}
        <button
          onClick={() => window.print()}
          className="w-full py-3 rounded-2xl bg-gradient-to-l from-blue-700 to-cyan-700 text-white font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg"
        >
          <FileDown className="w-5 h-5" /> تحميل التقرير
        </button>

        {/* 10. Contact Teacher */}
        <div className="rounded-2xl bg-gradient-to-l from-blue-700 to-cyan-700 p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs opacity-80">المدرس</div>
              <div className="font-bold">{teacherName}</div>
            </div>
            <a href={`tel:${teacherPhone}`} className="w-12 h-12 rounded-2xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors">
              <Phone className="w-5 h-5" />
            </a>
          </div>
        </div>

        {/* 11. Logo */}
        <div className="text-center pt-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-700 to-cyan-600 flex items-center justify-center mx-auto mb-2">
            <span className="text-2xl font-extrabold text-white">E+</span>
          </div>
          <div className="text-sm font-bold text-slate-700 dark:text-slate-200">{appName}</div>
          <div className="text-xs text-slate-400 mt-1">بوابة ولي الأمر — للقراءة فقط</div>
        </div>
      </div>
    </div>
  );
}

function Section({ icon, title, color, children }: { icon: React.ReactNode; title: string; color: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
      <div className={cn('flex items-center gap-2 p-3 text-white bg-gradient-to-l', color)}>
        {icon}
        <div className="font-bold text-sm">{title}</div>
      </div>
      <div className="p-3">{children}</div>
    </div>
  );
}

function InfoRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={cn('font-bold text-xs', color || 'text-slate-700 dark:text-slate-200')}>{value}</span>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-2 text-center">
      <div className={cn('text-xl font-extrabold', color)}>{value}</div>
      <div className="text-[10px] text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}
