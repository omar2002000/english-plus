// ===== English Plus - Group Details =====
'use client';
import { useEffect, useState, useMemo } from 'react';
import { useApp } from '@/lib/store';
import { getDB, logActivity } from '@/lib/db';
import type { Group, Student, Lesson, Attendance, Payment, DailyEvaluation } from '@/lib/types';
import { formatMoney, scheduleText, formatArDate, arDayName, arMonthName } from '@/lib/helpers';
import { SearchBar, EmptyState } from '@/components/ui-shared';
import { Users, BookOpen, CalendarDays, Wallet, TrendingUp, Plus, UserMinus, ChevronLeft, FileDown, ScanLine, BarChart3, Trophy, Trash2, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function GroupDetails() {
  const { params, navigate, settings, refreshKey, triggerRefresh } = useApp();
  const id = params.id;
  const [group, setGroup] = useState<Group | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [evaluations, setEvaluations] = useState<DailyEvaluation[]>([]);
  const [search, setSearch] = useState('');
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const db = getDB();
      const g = await db.groups.get(id);
      if (!g) { toast.error('المجموعة غير موجودة'); return; }
      setGroup(g);
      const [allS, les, att, pay, evs] = await Promise.all([
        db.students.toArray(),
        db.lessons.where('groupId').equals(id).toArray(),
        db.attendance.where('groupId').equals(id).toArray(),
        db.payments.toArray(),
        db.evaluations.toArray(),
      ]);
      setAllStudents(allS);
      setStudents(allS.filter(s => s.groupId === id));
      setLessons(les.sort((a, b) => b.date.localeCompare(a.date)));
      setAttendances(att);
      setPayments(pay);
      setEvaluations(evs);
    })();
  }, [id, refreshKey]);

  const stats = useMemo(() => {
    const activeStudents = students.filter(s => s.status === 'active');
    const totalIncome = activeStudents.length * (group?.monthlyFee || 0);
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const monthPayments = payments.filter(p => {
      const s = students.find(st => st.id === p.studentId);
      return s && p.month === month && p.year === year;
    });
    const collected = monthPayments.reduce((s, p) => s + p.amountPaid, 0);
    const paidCount = activeStudents.filter(s => {
      const sp = monthPayments.filter(p => p.studentId === s.id);
      return sp.reduce((sum, p) => sum + p.amountPaid, 0) >= s.monthlyFee;
    }).length;
    const lateCount = activeStudents.length - paidCount;
    const attendanceRate = attendances.length > 0
      ? Math.round((attendances.filter(a => a.status === 'present').length / attendances.length) * 100)
      : 0;
    return {
      totalStudents: activeStudents.length,
      totalIncome,
      collected,
      paidCount,
      lateCount,
      attendanceRate,
      lessonsCount: lessons.length,
    };
  }, [students, group, payments, attendances, lessons]);

  const filteredStudents = useMemo(() => {
    let list = students.slice();
    if (search.trim()) {
      const q = search.trim();
      list = list.filter(s => s.name.includes(q) || s.code.includes(q));
    }
    return list.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [students, search]);

  const availableStudents = useMemo(() => {
    return allStudents.filter(s => s.status === 'active' && !s.groupId).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [allStudents]);

  async function addStudentToGroup(sid: string) {
    if (!group) return;
    const db = getDB();
    await db.students.update(sid, { groupId: group.id, updatedAt: new Date().toISOString() });
    await logActivity('link_student', 'group', group.id, `إضافة طالب للمجموعة`);
    const s = await db.students.get(sid);
    if (s) {
      setStudents(prev => [...prev, s]);
      setAllStudents(prev => prev.map(p => p.id === sid ? s : p));
    }
    toast.success('تمت الإضافة للمجموعة');
  }

  async function removeStudentFromGroup(sid: string) {
    const db = getDB();
    await db.students.update(sid, { groupId: null, updatedAt: new Date().toISOString() });
    await logActivity('unlink_student', 'group', group?.id, `إزالة طالب من المجموعة`);
    setStudents(prev => prev.filter(s => s.id !== sid));
    toast.success('تمت الإزالة من المجموعة');
  }

  async function startLessonToday() {
    if (!group) return;
    const db = getDB();
    const today = new Date().toISOString();
    // check if lesson exists today
    const existing = await db.lessons.where('groupId').equals(group.id).toArray();
    if (existing.some(l => l.date.split('T')[0] === today.split('T')[0])) {
      toast.info('يوجد حصة مسجلة اليوم بالفعل');
    } else {
      const lesson: Lesson = {
        id: crypto.randomUUID(),
        groupId: group.id,
        date: today,
        teacherName: group.teacherName,
        closed: false,
        status: 'open' as const,
        createdAt: today,
      };
      await db.lessons.add(lesson);
      await logActivity('create_lesson', 'lesson', lesson.id, `حصة جديدة للمجموعة ${group.name}`);
      toast.success('تم إنشاء حصة اليوم');
    }
    navigate('today_class', { groupId: group.id });
  }

  if (!group) {
    return <div className="p-4 space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-12 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />)}</div>;
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in pb-32">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-l from-emerald-500 to-green-700 p-4 text-white shadow-lg">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="text-lg font-extrabold">{group.name}</div>
            <div className="text-sm opacity-90">{group.code} • {group.grade}</div>
            <div className="text-xs opacity-80 mt-1">{scheduleText(group)} • {group.teacherName}</div>
          </div>
          <div className="text-left">
            <div className="text-2xl font-extrabold">{stats.totalStudents}</div>
            <div className="text-xs opacity-80">طالب</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatBox icon={<Wallet className="w-5 h-5" />} color="bg-amber-500" label="الدخل المتوقع" value={formatMoney(stats.totalIncome)} />
        <StatBox icon={<TrendingUp className="w-5 h-5" />} color="bg-emerald-500" label="المحصّل هذا الشهر" value={formatMoney(stats.collected)} />
        <StatBox icon={<Users className="w-5 h-5" />} color="bg-blue-500" label="مسددين" value={`${stats.paidCount} / ${stats.totalStudents}`} />
        <StatBox icon={<BarChart3 className="w-5 h-5" />} color="bg-violet-500" label="نسبة الحضور" value={`${stats.attendanceRate}%`} />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={startLessonToday}
          className="py-3 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-700 text-white font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-md"
        >
          <ScanLine className="w-5 h-5" /> بدء حصة اليوم
        </button>
        {/* v7: Printable attendance sheet */}
        <button
          onClick={() => {
            const printWin = window.open('', '_blank');
            if (!printWin) return;
            const rows = students.filter(s => s.status === 'active').map((s, i) =>
              `<tr><td>${i+1}</td><td>${s.name}</td><td>${s.code}</td><td style="width:60px;height:30px;border:1px solid #999"></td><td style="width:60px;height:30px;border:1px solid #999"></td></tr>`
            ).join('');
            printWin.document.write(`<html dir="rtl"><head><title>ورقة حضور - ${group?.name}</title><style>body{font-family:sans-serif;padding:20px}h1{text-align:center}table{width:100%;border-collapse:collapse;margin-top:20px}td,th{border:1px solid #333;padding:8px;text-align:center}th{background:#1e3a8a;color:white}</style></head><body><h1>ورقة الحضور - ${group?.name}</h1><p>التاريخ: ${new Date().toLocaleDateString('ar-EG')}</p><table><tr><th>م</th><th>الاسم</th><th>الكود</th><th>حاضر</th><th>غائب</th></tr>${rows}</table></body></html>`);
            printWin.document.close();
            printWin.print();
          }}
          className="flex-1 py-3 rounded-2xl bg-gradient-to-br from-slate-500 to-slate-700 text-white font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-md"
        >
          <Printer className="w-5 h-5" /> 📋 ورقة حضور للطباعة
        </button>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="py-3 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 text-white font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-md"
        >
          <Plus className="w-5 h-5" /> ربط طلاب
        </button>
      </div>

      {/* Add students panel */}
      {showAdd && (
        <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-3">
          <div className="font-bold text-sm text-slate-700 dark:text-slate-200 mb-2">طلاب بدون مجموعة</div>
          {availableStudents.length === 0 ? (
            <div className="text-center py-4 text-slate-400 text-sm">لا يوجد طلاب متاحون</div>
          ) : (
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {availableStudents.map(s => (
                <div key={s.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                  <div className="text-sm">
                    <div className="font-bold text-slate-700 dark:text-slate-200">{s.name}</div>
                    <div className="text-xs text-slate-500">{s.grade} • {s.code}</div>
                  </div>
                  <button
                    onClick={() => addStudentToGroup(s.id)}
                    className="px-3 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold"
                  >
                    إضافة
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Students list */}
      <div>
        <SearchBar value={search} onChange={setSearch} placeholder="بحث عن طالب في المجموعة" />

        {/* Top 3 students in group this month */}
        {(() => {
          const now = new Date();
          const month = now.getMonth() + 1;
          const year = now.getFullYear();
          const monthLessons = lessons.filter(l => {
            const d = new Date(l.date);
            return d.getMonth() + 1 === month && d.getFullYear() === year;
          });
          const monthLessonIds = new Set(monthLessons.map(l => l.id));
          // Compute avg score per student in group this month
          const topStudents: Array<{ student: typeof students[0]; avg: number }> = [];
          for (const s of students) {
            const sEvals = evaluations.filter(e => e.studentId === s.id && monthLessonIds.has(e.lessonId));
            if (sEvals.length === 0) continue;
            const avg = sEvals.reduce((sum, e) => sum + e.totalScore, 0) / sEvals.length;
            topStudents.push({ student: s, avg });
          }
          topStudents.sort((a, b) => b.avg - a.avg);
          const top3 = topStudents.slice(0, 3);
          if (top3.length === 0) return null;
          return (
            <div className="mt-3 p-3 rounded-2xl bg-gradient-to-l from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border border-amber-200 dark:border-amber-900/30">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                <div className="font-bold text-sm text-slate-800 dark:text-slate-100">أفضل 3 طلاب هذا الشهر</div>
              </div>
              <div className="space-y-1.5">
                {top3.map((t, idx) => (
                  <button
                    key={t.student.id}
                    onClick={() => navigate('student_profile', { id: t.student.id })}
                    className="w-full flex items-center gap-2 p-2 rounded-lg bg-white/50 dark:bg-slate-900/30 hover:bg-white dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white text-xs ${idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-slate-400' : 'bg-orange-400'}`}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 text-right">
                      <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{t.student.name}</div>
                      <div className="text-[10px] text-slate-500">{t.student.grade}</div>
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-emerald-600 text-sm">{t.avg.toFixed(1)}/30</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })()}

        <div className="mt-3 space-y-2">
          {filteredStudents.length === 0 ? (
            <EmptyState title="لا يوجد طلاب" subtitle="اربط طلاب بالمجموعة" icon={<Users className="w-10 h-10" />} />
          ) : (
            filteredStudents.map(s => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                <button onClick={() => navigate('student_profile', { id: s.id })} className="flex-1 flex items-center gap-3 text-right">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-green-700 flex items-center justify-center text-white font-bold">
                    {s.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-800 dark:text-slate-100">{s.name}</div>
                    <div className="text-xs text-slate-500">
                      كود: {s.code}
                      {s.debt > 0 && <span className="text-red-600 font-bold mr-2">• دين: {formatMoney(s.debt)}</span>}
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => removeStudentFromGroup(s.id)}
                  className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 flex items-center justify-center"
                  title="إزالة من المجموعة"
                >
                  <UserMinus className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Lessons history */}
      {lessons.length > 0 && (
        <div>
          <div className="font-bold text-sm text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-emerald-600" /> سجل الحصص ({lessons.length})
          </div>

          {/* Suggest makeup lesson */}
          {group && (
            <div className="mb-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/30">
              <div className="flex items-center gap-2 mb-1">
                <CalendarDays className="w-4 h-4 text-blue-600" />
                <div className="text-xs font-bold text-blue-700 dark:text-blue-300">اقتراح موعد تعويض الحصة القادمة</div>
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-300">
                {(() => {
                  const days = group.schedules && group.schedules.length > 0
                    ? Array.from(new Set(group.schedules.map(s => s.day)))
                    : [group.scheduleDay];
                  const arDays = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
                  const today = new Date();
                  for (let i = 1; i <= 14; i++) {
                    const d = new Date(today);
                    d.setDate(d.getDate() + i);
                    const dayName = arDays[d.getDay()];
                    if (days.includes(dayName)) {
                      const dateStr = d.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' });
                      const sched = group.schedules?.find(s => s.day === dayName);
                      const time = sched ? `${sched.hour % 12 || 12}:${String(sched.minute).padStart(2, '0')} ${sched.period === 'am' ? 'ص' : 'م'}` : '';
                      return `📅 أقرب موعد متاح: ${dateStr} ${time ? `الساعة ${time}` : ''}`;
                    }
                  }
                  return 'لا يوجد موعد متاح خلال الأسبوعين القادمين';
                })()}
              </div>
            </div>
          )}

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {lessons.slice(0, 10).map(l => {
              const present = attendances.filter(a => a.lessonId === l.id && a.status === 'present').length;
              const absent = attendances.filter(a => a.lessonId === l.id && a.status === 'absent').length;
              return (
                <div key={l.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                  <div>
                    <div className="text-sm font-bold text-slate-700 dark:text-slate-200">{formatArDate(l.date)}</div>
                    <div className="text-xs text-slate-500">{l.closed ? 'مغلقة' : 'مفتوحة'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-600 font-bold text-xs">حاضر: {present}</span>
                    <span className="text-red-600 font-bold text-xs">غائب: {absent}</span>
                    <button
                      onClick={async () => {
                        if (!confirm(`حذف حصة ${formatArDate(l.date)}؟ سيتم حذف كل سجلات الحضور والتقييم المرتبطة بها.`)) return;
                        const db = getDB();
                        await db.attendance.where('lessonId').equals(l.id).delete();
                        await db.evaluations.where('lessonId').equals(l.id).delete();
                        await db.lessons.delete(l.id);
                        await logActivity('delete_lesson', 'lesson', l.id, `حذف حصة ${formatArDate(l.date)}`);
                        const updatedLessons = await db.lessons.where('groupId').equals(id).toArray();
                        setLessons(updatedLessons.sort((a, b) => b.date.localeCompare(a.date)));
                        toast.success('تم حذف الحصة');
                        triggerRefresh();
                      }}
                      className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 flex items-center justify-center"
                      title="حذف الحصة"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-20 p-3 glass border-t border-slate-200 dark:border-slate-700 safe-bottom" style={{ maxWidth: '480px', margin: '0 auto' }}>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => navigate('attendance', { groupId: group.id })}
            className="py-2.5 rounded-xl bg-orange-600 text-white text-xs font-bold flex items-center justify-center gap-1"
          >
            <ScanLine className="w-4 h-4" /> تسجيل حضور
          </button>
          <button
            onClick={() => navigate('reports', { type: 'group', id: group.id })}
            className="py-2.5 rounded-xl bg-slate-600 text-white text-xs font-bold flex items-center justify-center gap-1"
          >
            <FileDown className="w-4 h-4" /> تقرير المجموعة
          </button>
        </div>
      </div>
    </div>
  );
}

function StatBox({ icon, color, label, value }: { icon: React.ReactNode; color: string; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-3 flex items-center gap-3">
      <div className={cn('w-10 h-10 rounded-xl text-white flex items-center justify-center', color)}>{icon}</div>
      <div>
        <div className="text-xs text-slate-500">{label}</div>
        <div className="font-bold text-sm text-slate-800 dark:text-slate-100">{value}</div>
      </div>
    </div>
  );
}
