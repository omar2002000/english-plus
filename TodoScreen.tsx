// ===== English Plus - Daily To-Do Screen =====
'use client';
import { useEffect, useState } from 'react';
import { useApp } from '@/lib/store';
import { getDB } from '@/lib/db';
import type { Student, Group, Lesson, Attendance, Payment } from '@/lib/types';
import { formatArDate, arDayName, getGroupDays, scheduleText, computeStudentFinancialStatus } from '@/lib/helpers';
import { CheckCircle2, Circle, AlertTriangle, Wallet, BookOpen, Phone, CalendarDays, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Task {
  id: string;
  text: string;
  type: 'lesson' | 'payment' | 'attendance' | 'call';
  action?: string;
  entityId?: string;
  done: boolean;
}

export function TodoScreen() {
  const { navigate, refreshKey } = useApp();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const db = getDB();
      const [students, groups, lessons, attendances, payments] = await Promise.all([
        db.students.toArray(), db.groups.toArray(), db.lessons.toArray(),
        db.attendance.toArray(), db.payments.toArray(),
      ]);
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const arDay = arDayName(today);
      const month = today.getMonth() + 1;
      const year = today.getFullYear();

      const generatedTasks: Task[] = [];

      // 1. Lessons today
      const todayGroups = groups.filter(g => !g.archived && getGroupDays(g).includes(arDay));
      for (const g of todayGroups) {
        const todayLessons = lessons.filter(l => l.groupId === g.id && l.date.split('T')[0] === todayStr);
        const isCompleted = todayLessons.some(l => l.closed);
        generatedTasks.push({
          id: `lesson_${g.id}`,
          text: `${isCompleted ? '✅' : '☐'} حصة ${g.name} (${scheduleText(g)})`,
          type: 'lesson',
          action: 'today_class',
          entityId: g.id,
          done: isCompleted,
        });
      }

      // 2. Unpaid students
      const activeStudents = students.filter(s => s.status === 'active');
      let unpaidCount = 0;
      const unpaidStudents: Student[] = [];
      for (const s of activeStudents) {
        const fin = computeStudentFinancialStatus(s, payments, month, year);
        if (fin.remaining > 0) {
          unpaidCount++;
          unpaidStudents.push(s);
        }
      }
      if (unpaidCount > 0) {
        generatedTasks.push({
          id: 'payment_reminder',
          text: `📋 متابعة ${unpaidCount} طالب متأخر في السداد`,
          type: 'payment',
          action: 'subscriptions',
          done: false,
        });
      }

      // 3. Students absent 3+ times
      const monthLessons = lessons.filter(l => {
        const d = new Date(l.date);
        return d.getMonth() + 1 === month && d.getFullYear() === year;
      });
      const monthLessonIds = new Set(monthLessons.map(l => l.id));
      const absentCounts = new Map<string, number>();
      for (const a of attendances) {
        if (a.status === 'absent' && monthLessonIds.has(a.lessonId)) {
          absentCounts.set(a.studentId, (absentCounts.get(a.studentId) || 0) + 1);
        }
      }
      const frequentAbsentees = Array.from(absentCounts.entries()).filter(([_, c]) => c >= 3);
      if (frequentAbsentees.length > 0) {
        generatedTasks.push({
          id: 'frequent_absent',
          text: `📞 الاتصال بـ ${frequentAbsentees.length} طالب (غياب 3+ مرات)`,
          type: 'call',
          action: 'students',
          done: false,
        });
      }

      setTasks(generatedTasks);
      setLoading(false);
    })();
  }, [refreshKey]);

  if (loading) return <div className="p-4"><div className="h-32 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" /></div>;

  const completedCount = tasks.filter(t => t.done).length;
  const totalCount = tasks.length;

  return (
    <div className="p-4 space-y-3 animate-fade-in">
      <div className="rounded-2xl bg-gradient-to-l from-blue-700 to-cyan-700 p-4 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs opacity-80">{formatArDate(new Date())}</div>
            <div className="font-bold text-lg">مهام اليوم</div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-extrabold">{completedCount}/{totalCount}</div>
            <div className="text-xs opacity-80">مكتمل</div>
          </div>
        </div>
        {totalCount > 0 && (
          <div className="mt-3 h-2 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full bg-white transition-all" style={{ width: `${(completedCount / totalCount) * 100}%` }} />
          </div>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="text-center py-12">
          <CheckCircle2 className="w-16 h-16 mx-auto text-emerald-500 mb-3" />
          <div className="font-bold text-slate-700 dark:text-slate-200">لا توجد مهام معلقة اليوم 🎉</div>
          <div className="text-sm text-slate-500 mt-1">كل شيء تحت السيطرة</div>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map(task => {
            const Icon = task.type === 'lesson' ? BookOpen : task.type === 'payment' ? Wallet : task.type === 'call' ? Phone : CalendarDays;
            return (
              <button
                key={task.id}
                onClick={() => task.action && navigate(task.action as any)}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-2xl border text-right transition-all',
                  task.done ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900 opacity-70' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:shadow-md'
                )}
              >
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', task.done ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500')}>
                  {task.done ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                </div>
                <div className="flex-1">
                  <div className={cn('font-bold text-sm', task.done && 'line-through text-slate-400')}>{task.text}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
