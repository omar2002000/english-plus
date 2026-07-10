// ===== English Plus - Parent App View =====
'use client';
import { useEffect, useState } from 'react';
import { useApp } from '@/lib/store';
import { getParentAppData, validateParentToken } from '@/lib/advanced';
import { formatArDate, formatArDateShort, arMonthName, formatMoney, GRADE_LABELS_AR, GRADE_COLORS, scheduleText } from '@/lib/helpers';
import { BookOpen, CalendarDays, Wallet, MessageCircle, Trophy, AlertCircle, TrendingUp, Phone, Award, CheckCircle2, Lock, Eye, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Student, Group } from '@/lib/types';

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
      // First check token validity (this increments open count)
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

  const { student, group, todayStats, monthlyStats, recentEvals, payments, upcomingLessons, messages, teacherName, teacherPhone, appName } = data;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-12">
      {/* Header */}
      <div className="bg-gradient-to-l from-blue-700 to-cyan-600 p-5 text-white shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-xs opacity-80">{appName}</div>
            <div className="text-lg font-extrabold">تطبيق ولي الأمر</div>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center overflow-hidden">
            {student.photo ? <img src={student.photo} alt={student.name} className="w-full h-full object-cover" /> : <span className="text-2xl font-extrabold">{student.name.charAt(0)}</span>}
          </div>
        </div>
        <div className="font-bold text-xl">{student.name}</div>
        <div className="text-sm opacity-90">{student.grade} • {group?.name || 'بدون مجموعة'}</div>
      </div>

      <div className="p-4 space-y-4 max-w-md mx-auto">
        {/* Today's stats */}
        <div className="grid grid-cols-3 gap-2">
          <StatBox label="حضور الشهر" value={String(monthlyStats.present)} color="text-emerald-600" />
          <StatBox label="غياب الشهر" value={String(monthlyStats.absent)} color="text-red-600" />
          <StatBox label="المتوسط" value={`${monthlyStats.avgTotal}/40`} color="text-blue-600" />
        </div>

        {/* Monthly performance */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-5 h-5 text-amber-500" />
            <div className="font-bold text-slate-800 dark:text-slate-100">التقرير الشهري</div>
            <span className={cn('mr-auto text-xs px-2 py-0.5 rounded-full font-bold', GRADE_COLORS[Object.keys(GRADE_LABELS_AR).find(k => GRADE_LABELS_AR[k as keyof typeof GRADE_LABELS_AR] === monthlyStats.grade) as keyof typeof GRADE_COLORS || 'unevaluated'].bg, GRADE_COLORS[Object.keys(GRADE_LABELS_AR).find(k => GRADE_LABELS_AR[k as keyof typeof GRADE_LABELS_AR] === monthlyStats.grade) as keyof typeof GRADE_COLORS || 'unevaluated'].text)}>
              {monthlyStats.grade}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <span className="text-slate-500">عدد الحصص</span>
              <span className="font-bold text-slate-800 dark:text-slate-100">{monthlyStats.lessonsCount}</span>
            </div>
            <div className="flex justify-between p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
              <span className="text-slate-500">الحضور</span>
              <span className="font-bold text-emerald-600">{monthlyStats.present}</span>
            </div>
            <div className="flex justify-between p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
              <span className="text-slate-500">الغياب</span>
              <span className="font-bold text-red-600">{monthlyStats.absent}</span>
            </div>
            <div className="flex justify-between p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <span className="text-slate-500">المتوسط</span>
              <span className="font-bold text-blue-600">{monthlyStats.avgTotal}/40</span>
            </div>
          </div>
          {monthlyStats.strengths.length > 0 && (
            <div className="mt-3 p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
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
        </div>

        {/* Recent reports */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-5 h-5 text-cyan-600" />
            <div className="font-bold text-slate-800 dark:text-slate-100">آخر التقارير</div>
          </div>
          {recentEvals.length === 0 ? (
            <div className="text-center py-4 text-slate-400 text-sm">لا توجد تقارير بعد</div>
          ) : (
            <div className="space-y-2">
              {recentEvals.map((e, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <div className="text-xs">
                    <div className="font-bold text-slate-700 dark:text-slate-200">{e.date}</div>
                    {e.note && <div className="text-slate-500 mt-0.5">{e.note}</div>}
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-sm text-slate-800 dark:text-slate-100">{e.total}/40</div>
                    <div className="text-[10px] text-slate-500">{e.grade}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming lessons */}
        {upcomingLessons.length > 0 && (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4">
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays className="w-5 h-5 text-blue-600" />
              <div className="font-bold text-slate-800 dark:text-slate-100">الحصص القادمة</div>
            </div>
            <div className="space-y-2">
              {upcomingLessons.slice(0, 5).map(g => (
                <div key={g.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <div>
                    <div className="font-bold text-sm text-slate-800 dark:text-slate-100">{g.name}</div>
                    <div className="text-xs text-slate-500">{g.subject} • {g.grade}</div>
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300">{scheduleText(g)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payments */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="w-5 h-5 text-amber-600" />
            <div className="font-bold text-slate-800 dark:text-slate-100">سجل المدفوعات</div>
          </div>
          <div className="mb-3 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-between">
            <div className="text-sm text-slate-600 dark:text-slate-300">المديونية الحالية</div>
            <div className={cn('font-bold', student.debt > 0 ? 'text-red-600' : 'text-emerald-600')}>
              {formatMoney(student.debt)}
            </div>
          </div>
          {payments.length === 0 ? (
            <div className="text-center py-4 text-slate-400 text-sm">لا توجد مدفوعات</div>
          ) : (
            <div className="space-y-1.5">
              {payments.map((p, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <div>
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-200">{arMonthName(p.month)} {p.year}</div>
                    <div className="text-[10px] text-slate-500">{p.date} • {p.invoiceNo}</div>
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-emerald-600 text-sm">{formatMoney(p.amount)}</div>
                    {p.remaining > 0 && <div className="text-[10px] text-red-500">متبقي: {formatMoney(p.remaining)}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Messages from teacher */}
        {messages.length > 0 && (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4">
            <div className="flex items-center gap-2 mb-3">
              <MessageCircle className="w-5 h-5 text-green-600" />
              <div className="font-bold text-slate-800 dark:text-slate-100">رسائل من المدرس</div>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {messages.map((m, i) => (
                <div key={i} className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
                  <div className="text-[10px] text-slate-500 mb-1">{m.date}</div>
                  <div className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{m.body}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Teacher contact */}
        <div className="rounded-2xl bg-gradient-to-l from-blue-600 to-cyan-700 p-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs opacity-80">المدرس</div>
              <div className="font-bold">{teacherName}</div>
            </div>
            <a
              href={`tel:${teacherPhone}`}
              className="w-12 h-12 rounded-2xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
            >
              <Phone className="w-5 h-5" />
            </a>
          </div>
        </div>

        <div className="text-center text-xs text-slate-400 pt-4">
          {appName} — تطبيق ولي الأمر
          <br />
          لا يمكن التعديل من هنا — للاستفسار تواصل مع المدرس
        </div>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 text-center">
      <div className={cn('text-xl font-extrabold', color)}>{value}</div>
      <div className="text-[10px] text-slate-500 mt-0.5">{label}</div>
    </div>
  );
}
