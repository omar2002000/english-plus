// ===== English Plus - Dashboard Screen =====
'use client';
import { useEffect, useState } from 'react';
import { useApp } from '@/lib/store';
import { getDB } from '@/lib/db';
import type { Student, Group } from '@/lib/types';
import { StatCard, SectionHeader, QuickAction, EmptyState } from '@/components/ui-shared';
import { SmartRecommendations } from '@/components/SmartRecommendations';
import { formatMoney, formatArDate, arDayName, scheduleText, getGroupDays, computeFinancialSummary } from '@/lib/helpers';
import {
  Users, UserCheck, UserX, Wallet, AlertTriangle, CalendarClock,
  UserPlus, FolderPlus, ScanLine, BookOpen, TrendingUp, Trophy, AlertCircle, ChevronLeft, Zap
} from 'lucide-react';

interface DashboardData {
  totalToday: number;
  presentToday: number;
  absentToday: number;
  paymentsToday: number;
  totalDebt: number;
  upcomingLessons: Group[];
  latePayers: Student[];
  frequentAbsents: Array<{ student: Student; count: number }>;
  topStudents: Array<{ student: Student; avg: number }>;
  dailyRevenue: number;
  monthlyRevenue: number;
  collectionRate: number;
  bestGroup?: { group: Group; rate: number };
  worstGroup?: { group: Group; rate: number };
}

export function Dashboard() {
  const { navigate, settings, refreshKey } = useApp();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const db = getDB();
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const month = today.getMonth() + 1;
        const year = today.getFullYear();

        const [students, groups, lessons, attendances, payments, evals] = await Promise.all([
          db.students.toArray(),
          db.groups.toArray(),
          db.lessons.toArray(),
          db.attendance.toArray(),
          db.payments.toArray(),
          db.evaluations.toArray(),
        ]);

        const activeStudents = students.filter(s => s.status === 'active');
        const activeGroups = groups.filter(g => !g.archived);

        // Today's lessons
        const todayLessons = lessons.filter(l => l.date.split('T')[0] === todayStr);
        const todayStudentIds = new Set<string>();
        for (const l of todayLessons) {
          const group = activeGroups.find(g => g.id === l.groupId);
          if (group) {
            const groupStudents = activeStudents.filter(s => s.groupId === group.id);
            groupStudents.forEach(s => todayStudentIds.add(s.id));
          }
        }

        const todayAttendances = attendances.filter(a => {
          const lesson = lessons.find(l => l.id === a.lessonId);
          return lesson && lesson.date.split('T')[0] === todayStr;
        });
        const presentTodaySet = new Set(todayAttendances.filter(a => a.status === 'present').map(a => a.studentId));
        const absentTodaySet = new Set(todayAttendances.filter(a => a.status === 'absent').map(a => a.studentId));

        const paymentsToday = payments.filter(p => p.paymentDate.split('T')[0] === todayStr);
        const dailyRevenue = paymentsToday.reduce((s, p) => s + p.amountPaid, 0);
        const totalDebt = activeStudents.reduce((s, st) => s + (st.debt || 0), 0);
        // v5: Use unified financial summary for correct outstanding calculation
        const finSummary = computeFinancialSummary(students, payments, month, year);
        const expectedMonthly = finSummary.expectedTotal;
        const monthlyRevenue = finSummary.collectedTotal;
        const correctOutstanding = finSummary.outstandingTotal;
        const collectionRate = finSummary.collectionRate;

        // Late payers
        const latePayers = activeStudents.filter(s => s.debt > 0).sort((a, b) => b.debt - a.debt).slice(0, 5);

        // Frequent absents
        const monthAttendances = attendances.filter(a => {
          const lesson = lessons.find(l => l.id === a.lessonId);
          if (!lesson) return false;
          const d = new Date(lesson.date);
          return d.getMonth() + 1 === month && d.getFullYear() === year;
        });
        const absentCounts = new Map<string, number>();
        for (const a of monthAttendances) {
          if (a.status === 'absent') {
            absentCounts.set(a.studentId, (absentCounts.get(a.studentId) || 0) + 1);
          }
        }
        const frequentAbsents = Array.from(absentCounts.entries())
          .filter(([_, c]) => c >= 3)
          .map(([sid, c]) => ({ student: students.find(s => s.id === sid)!, count: c }))
          .filter(x => x.student)
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        // Top students
        const evalsByStudent = new Map<string, number[]>();
        for (const e of evals) {
          const lesson = lessons.find(l => l.id === e.lessonId);
          if (!lesson) continue;
          const d = new Date(lesson.date);
          if (d.getMonth() + 1 === month && d.getFullYear() === year) {
            if (!evalsByStudent.has(e.studentId)) evalsByStudent.set(e.studentId, []);
            evalsByStudent.get(e.studentId)!.push(e.totalScore);
          }
        }
        const topStudents = Array.from(evalsByStudent.entries())
          .map(([sid, scores]) => ({
            student: students.find(s => s.id === sid)!,
            avg: scores.reduce((a, b) => a + b, 0) / scores.length,
          }))
          .filter(x => x.student)
          .sort((a, b) => b.avg - a.avg)
          .slice(0, 3);

        // Group rates
        const groupRates = activeGroups.map(g => {
          const gAtt = monthAttendances.filter(a => a.groupId === g.id);
          const present = gAtt.filter(a => a.status === 'present').length;
          const rate = gAtt.length > 0 ? (present / gAtt.length) * 100 : 0;
          return { group: g, rate };
        });
        const bestGroup = groupRates.slice().sort((a, b) => b.rate - a.rate)[0];
        const worstGroup = groupRates.slice().sort((a, b) => a.rate - b.rate)[0];

        // Upcoming lessons
        const upcoming: Group[] = [];
        for (let i = 0; i < 7; i++) {
          const d = new Date(today);
          d.setDate(d.getDate() + i);
          const dayName = arDayName(d);
          const matched = activeGroups.filter(g => getGroupDays(g).includes(dayName));
          for (const g of matched) {
            if (!upcoming.find(u => u.id === g.id)) upcoming.push(g);
          }
        }

        setData({
          totalToday: todayStudentIds.size || activeStudents.length,
          presentToday: presentTodaySet.size,
          absentToday: absentTodaySet.size,
          paymentsToday: paymentsToday.length,
          totalDebt: correctOutstanding, // v5: correct outstanding = expected - collected
          upcomingLessons: upcoming.slice(0, 5),
          latePayers,
          frequentAbsents,
          topStudents,
          dailyRevenue,
          monthlyRevenue,
          collectionRate,
          bestGroup: bestGroup && bestGroup.rate > 0 ? bestGroup : undefined,
          worstGroup: worstGroup && worstGroup.rate < 100 && worstGroup.rate > 0 ? worstGroup : undefined,
        });
      } catch (e) {
        console.error('Dashboard load error', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshKey]);

  if (loading || !data) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5 animate-fade-in">
      {/* Smart Recommendations */}
      {settings.smartRecommendationsEnabled && <SmartRecommendationsWrapper />}

      <div className="rounded-2xl bg-gradient-to-l from-blue-700 to-cyan-600 p-4 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm opacity-90">{formatArDate(new Date())}</div>
            <div className="text-xl font-extrabold mt-1">{settings.teacherName}</div>
            <div className="text-xs opacity-80 mt-0.5">{settings.appName}</div>
          </div>
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
            <span className="text-3xl font-extrabold">E+</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard title="طلاب اليوم" value={data.totalToday} icon={<Users className="w-7 h-7" />} color="blue" onClick={() => navigate('students')} />
        <StatCard title="الحاضرون" value={data.presentToday} icon={<UserCheck className="w-7 h-7" />} color="green" onClick={() => navigate('attendance')} />
        <StatCard title="الغائبون" value={data.absentToday} icon={<UserX className="w-7 h-7" />} color="red" onClick={() => navigate('attendance')} />
        <StatCard title="مدفوعات اليوم" value={data.paymentsToday} icon={<Wallet className="w-7 h-7" />} color="amber" onClick={() => navigate('subscriptions')} />
        <StatCard title="إيراد اليوم" value={formatMoney(data.dailyRevenue)} icon={<TrendingUp className="w-7 h-7" />} color="cyan" />
        <StatCard title="إيراد الشهر" value={formatMoney(data.monthlyRevenue)} icon={<TrendingUp className="w-7 h-7" />} color="violet" />
        <StatCard title="إجمالي المتأخرات" value={formatMoney(data.totalDebt)} icon={<AlertTriangle className="w-7 h-7" />} color="red" onClick={() => navigate('subscriptions')} />
        <StatCard title="نسبة التحصيل" value={`${data.collectionRate}%`} icon={<Wallet className="w-7 h-7" />} color="emerald" />
      </div>

      <div>
        <SectionHeader title="إجراءات سريعة" />
        <div className="grid grid-cols-4 gap-2">
          <QuickAction label="بدء الحضور" icon={<ScanLine className="w-6 h-6" />} color="bg-gradient-to-br from-orange-500 to-amber-600" onClick={() => navigate('scanner')} />
          <QuickAction label="حصة سريعة" icon={<Zap className="w-6 h-6" />} color="bg-gradient-to-br from-yellow-500 to-orange-600" onClick={() => navigate('today_class', { quick: '1' })} />
          <QuickAction label="إضافة طالب" icon={<UserPlus className="w-6 h-6" />} color="bg-gradient-to-br from-violet-500 to-purple-700" onClick={() => navigate('add_student')} />
          <QuickAction label="حصة اليوم" icon={<BookOpen className="w-6 h-6" />} color="bg-gradient-to-br from-cyan-500 to-teal-700" onClick={() => navigate('today_class')} />
        </div>
      </div>

      {data.upcomingLessons.length > 0 && (
        <div>
          <SectionHeader
            title="الحصص القادمة"
            icon={<CalendarClock className="w-5 h-5 text-blue-600" />}
            action={<button onClick={() => navigate('groups')} className="text-xs text-blue-600 font-semibold flex items-center gap-0.5">الكل <ChevronLeft className="w-3 h-3" /></button>}
          />
          <div className="space-y-2">
            {data.upcomingLessons.map(g => (
              <button
                key={g.id}
                onClick={() => navigate('group_details', { id: g.id })}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 hover:shadow-md transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-sm text-slate-800 dark:text-slate-100">{g.name}</div>
                    <div className="text-xs text-slate-500">{scheduleText(g)}</div>
                  </div>
                </div>
                <ChevronLeft className="w-4 h-4 text-slate-400" />
              </button>
            ))}
          </div>
        </div>
      )}

      {data.latePayers.length > 0 && (
        <div>
          <SectionHeader
            title="متأخرو السداد"
            icon={<AlertTriangle className="w-5 h-5 text-red-600" />}
            action={<button onClick={() => navigate('subscriptions')} className="text-xs text-red-600 font-semibold flex items-center gap-0.5">الكل <ChevronLeft className="w-3 h-3" /></button>}
          />
          <div className="space-y-2">
            {data.latePayers.map(s => (
              <button
                key={s.id}
                onClick={() => navigate('student_profile', { id: s.id })}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/30 hover:shadow-md transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center text-red-600 font-bold">
                    {s.name.charAt(0)}
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-sm text-slate-800 dark:text-slate-100">{s.name}</div>
                    <div className="text-xs text-slate-500">{s.grade}</div>
                  </div>
                </div>
                <div className="text-left">
                  <div className="font-bold text-red-600 text-sm">{formatMoney(s.debt)}</div>
                  <div className="text-[10px] text-slate-400">مديونية</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {data.frequentAbsents.length > 0 && (
        <div>
          <SectionHeader
            title="كثيرو الغياب"
            icon={<AlertCircle className="w-5 h-5 text-amber-600" />}
          />
          <div className="space-y-2">
            {data.frequentAbsents.map(({ student, count }) => (
              <button
                key={student.id}
                onClick={() => navigate('student_profile', { id: student.id })}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/30 hover:shadow-md transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-amber-600 font-bold">
                    {student.name.charAt(0)}
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-sm text-slate-800 dark:text-slate-100">{student.name}</div>
                    <div className="text-xs text-slate-500">{student.grade}</div>
                  </div>
                </div>
                <div className="text-left">
                  <div className="font-bold text-amber-600 text-sm">{count}</div>
                  <div className="text-[10px] text-slate-400">غياب</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {data.topStudents.length > 0 && (
        <div>
          <SectionHeader
            title="أفضل الطلاب هذا الشهر"
            icon={<Trophy className="w-5 h-5 text-amber-500" />}
          />
          <div className="space-y-2">
            {data.topStudents.map(({ student, avg }, idx) => (
              <button
                key={student.id}
                onClick={() => navigate('student_profile', { id: student.id })}
                className="w-full flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 hover:shadow-md transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white ${idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-slate-400' : 'bg-orange-400'}`}>
                    {idx + 1}
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-sm text-slate-800 dark:text-slate-100">{student.name}</div>
                    <div className="text-xs text-slate-500">{student.grade}</div>
                  </div>
                </div>
                <div className="text-left">
                  <div className="font-bold text-emerald-600 text-sm">{avg.toFixed(1)}/30</div>
                  <div className="text-[10px] text-slate-400">المتوسط</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {(data.bestGroup || data.worstGroup) && (
        <div className="grid grid-cols-2 gap-3">
          {data.bestGroup && (
            <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-green-700 p-4 text-white shadow-md">
              <div className="text-xs opacity-90">أعلى مجموعة حضوراً</div>
              <div className="font-bold mt-1">{data.bestGroup.group.name}</div>
              <div className="text-2xl font-extrabold mt-2">{Math.round(data.bestGroup.rate)}%</div>
            </div>
          )}
          {data.worstGroup && (
            <div className="rounded-2xl bg-gradient-to-br from-red-500 to-rose-700 p-4 text-white shadow-md">
              <div className="text-xs opacity-90">أقل مجموعة التزاماً</div>
              <div className="font-bold mt-1">{data.worstGroup.group.name}</div>
              <div className="text-2xl font-extrabold mt-2">{Math.round(data.worstGroup.rate)}%</div>
            </div>
          )}
        </div>
      )}

      {data.latePayers.length === 0 && data.frequentAbsents.length === 0 && data.upcomingLessons.length === 0 && (
        <EmptyState
          title="مرحباً بك في English Plus! 👋"
          subtitle="التطبيق فارغ — ابدأ بإضافة مجموعاتك وطلابك، أو أضف بيانات تجريبية من الإعدادات للتجربة"
          icon={<Users className="w-10 h-10" />}
          action={
            <div className="flex flex-col gap-2">
              <button
                onClick={() => navigate('add_student')}
                className="px-4 py-2 rounded-xl bg-violet-600 text-white font-bold text-sm flex items-center gap-2 justify-center"
              >
                <UserPlus className="w-4 h-4" /> إضافة أول طالب
              </button>
              <button
                onClick={() => navigate('add_group')}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-sm flex items-center gap-2 justify-center"
              >
                <FolderPlus className="w-4 h-4" /> إنشاء مجموعة
              </button>
              <button
                onClick={async () => {
                  const { addDemoDataManually } = await import('@/lib/db');
                  await addDemoDataManually();
                  toast.success('تمت إضافة بيانات تجريبية');
                  triggerRefresh();
                }}
                className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-sm"
              >
                أو أضف بيانات تجريبية للتجربة
              </button>
            </div>
          }
        />
      )}
    </div>
  );
}

function SmartRecommendationsWrapper() {
  const [closed, setClosed] = useState(false);
  if (closed) return null;
  return <SmartRecommendations onClose={() => setClosed(true)} />;
}
