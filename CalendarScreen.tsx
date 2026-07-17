// ===== English Plus - Visual Calendar Screen =====
'use client';
import { useEffect, useState } from 'react';
import { useApp } from '@/lib/store';
import { getDB } from '@/lib/db';
import type { Group, Lesson } from '@/lib/types';
import { formatArDate, arDayName, getGroupDays, scheduleText } from '@/lib/helpers';
import { ChevronLeft, ChevronRight, CalendarDays, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

export function CalendarScreen() {
  const { navigate, refreshKey } = useApp();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const db = getDB();
      const [les, grps] = await Promise.all([db.lessons.toArray(), db.groups.toArray()]);
      setLessons(les);
      setGroups(grps.filter(g => !g.archived));
      setLoading(false);
    })();
  }, [refreshKey]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay(); // 0=Sunday

  const monthLessons = lessons.filter(l => {
    const d = new Date(l.date);
    return d.getFullYear() === year && d.getMonth() === month;
  });

  function getDayLessons(day: number): Lesson[] {
    const dateStr = new Date(year, month, day).toISOString().split('T')[0];
    return monthLessons.filter(l => l.date.split('T')[0] === dateStr);
  }

  function hasGroupOnDay(day: number): boolean {
    const dayName = arDayName(new Date(year, month, day));
    return groups.some(g => getGroupDays(g).includes(dayName));
  }

  const weekDays = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
  const today = new Date();
  const isToday = (day: number) => today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

  return (
    <div className="p-4 space-y-3 animate-fade-in">
      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <ChevronRight className="w-5 h-5" />
        </button>
        <div className="font-bold text-lg">{currentDate.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}</div>
        <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Legend */}
      <div className="flex gap-3 text-xs">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500"></span> مكتملة</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-400"></span> مفتوحة</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-300"></span> لا توجد</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-200 border border-blue-500"></span> اليوم</span>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map(d => <div key={d} className="text-center text-[10px] font-bold text-slate-500 py-1">{d}</div>)}
        {Array.from({ length: startDayOfWeek }, (_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const dayLessons = getDayLessons(day);
          const hasGroup = hasGroupOnDay(day);
          const completed = dayLessons.some(l => l.closed);
          const open = dayLessons.some(l => !l.closed);
          return (
            <button
              key={day}
              onClick={() => navigate('today_class')}
              className={cn(
                'aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-all',
                isToday(day) ? 'border-2 border-blue-500' : '',
                completed ? 'bg-emerald-500 text-white' :
                open ? 'bg-amber-400 text-white' :
                hasGroup ? 'bg-slate-100 dark:bg-slate-800 text-slate-600' :
                'bg-slate-50 dark:bg-slate-900/30 text-slate-400'
              )}
            >
              <span className="font-bold">{day}</span>
              {(completed || open) && <span className="text-[8px]">{dayLessons.length} حصة</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
