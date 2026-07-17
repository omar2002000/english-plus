// ===== English Plus - Groups Schedule (v4 - professional table view) =====
'use client';
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/lib/store';
import { getDB } from '@/lib/db';
import type { Group, Student } from '@/lib/types';
import { scheduleText, formatMoney, getGroupDays } from '@/lib/helpers';
import { SearchBar, EmptyState } from '@/components/ui-shared';
import { BookOpen, FileDown, Printer, Share2, Grid3x3, List, Users, Calendar, ChevronLeft, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const DAYS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

export function GroupsScheduleScreen() {
  const { navigate, refreshKey } = useApp();
  const [groups, setGroups] = useState<Group[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [filterDay, setFilterDay] = useState<string>('');
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'am' | 'pm'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'archived'>('active');
  const [sortBy, setSortBy] = useState<'name' | 'time' | 'students' | 'grade'>('name');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const db = getDB();
      const [g, s] = await Promise.all([db.groups.toArray(), db.students.toArray()]);
      setGroups(g);
      setStudents(s);
      setLoading(false);
    })();
  }, [refreshKey]);

  const countStudents = (gid: string) => students.filter(s => s.groupId === gid && s.status === 'active').length;

  const filtered = useMemo(() => {
    let list = groups.slice();
    if (filterStatus === 'active') list = list.filter(g => !g.archived);
    else if (filterStatus === 'archived') list = list.filter(g => g.archived);
    if (filterDay) list = list.filter(g => getGroupDays(g).includes(filterDay));
    if (filterPeriod !== 'all') list = list.filter(g => g.schedulePeriod === filterPeriod);
    if (search.trim()) {
      const q = search.trim();
      list = list.filter(g =>
        g.name.includes(q) || g.grade.includes(q) || g.subject.includes(q) ||
        g.teacherName.includes(q) || g.code.includes(q)
      );
    }
    const cnt = (gid: string) => students.filter(s => s.groupId === gid && s.status === 'active').length;
    list.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name, 'ar');
      if (sortBy === 'students') return cnt(b.id) - cnt(a.id);
      if (sortBy === 'grade') return a.grade.localeCompare(b.grade, 'ar');
      if (sortBy === 'time') return (a.scheduleHour * 60 + a.scheduleMinute) - (b.scheduleHour * 60 + b.scheduleMinute);
      return 0;
    });
    return list;
    // eslint-disable-next-line react-hooks/preserve-manual-memoization
  }, [groups, students, search, filterDay, filterPeriod, filterStatus, sortBy]);

  function exportPDF() {
    toast.success('سيتم تصدير جدول المجموعات PDF');
    window.print();
  }

  function shareSchedule() {
    const text = filtered.map(g => ` ${g.name} - ${scheduleText(g)} - ${countStudents(g.id)} طالب`).join('\n');
    if (navigator.share) {
      navigator.share({ title: 'جدول المجموعات', text });
    } else {
      navigator.clipboard.writeText(text);
      toast.success('تم نسخ الجدول');
    }
  }

  if (loading) {
    return <div className="p-4 space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />)}</div>;
  }

  return (
    <div className="p-4 space-y-3 animate-fade-in pb-32">
      {/* Header stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-emerald-700 p-3 text-white text-center">
          <div className="text-2xl font-bold">{groups.filter(g => !g.archived).length}</div>
          <div className="text-[10px] opacity-80">مجموعة نشطة</div>
        </div>
        <div className="rounded-xl bg-blue-700 p-3 text-white text-center">
          <div className="text-2xl font-bold">{students.filter(s => s.status === 'active').length}</div>
          <div className="text-[10px] opacity-80">طالب</div>
        </div>
        <div className="rounded-xl bg-amber-700 p-3 text-white text-center">
          <div className="text-2xl font-bold">{DAYS.filter(d => groups.some(g => getGroupDays(g).includes(d))).length}</div>
          <div className="text-[10px] opacity-80">أيام دراسية</div>
        </div>
      </div>

      {/* Search + view toggle */}
      <div className="flex gap-2">
        <div className="flex-1"><SearchBar value={search} onChange={setSearch} placeholder="بحث: اسم، صف، معلم، مادة" /></div>
        <button
          onClick={() => setViewMode(viewMode === 'table' ? 'cards' : 'table')}
          className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600"
          title={viewMode === 'table' ? 'عرض بطاقات' : 'عرض جدول'}
        >
          {viewMode === 'table' ? <Grid3x3 className="w-5 h-5" /> : <List className="w-5 h-5" />}
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        <button onClick={() => setFilterDay('')} className={cn('px-3 py-1 rounded-full text-xs font-bold', !filterDay ? 'bg-emerald-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600')}>كل الأيام</button>
        {DAYS.map(d => (
          <button key={d} onClick={() => setFilterDay(filterDay === d ? '' : d)} className={cn('px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap', filterDay === d ? 'bg-emerald-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600')}>{d}</button>
        ))}
      </div>

      {/* Period filter */}
      <div className="flex gap-2">
        <button onClick={() => setFilterPeriod('all')} className={cn('px-3 py-1 rounded-full text-xs font-bold', filterPeriod === 'all' ? 'bg-blue-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600')}>كل الفترات</button>
        <button onClick={() => setFilterPeriod('am')} className={cn('px-3 py-1 rounded-full text-xs font-bold', filterPeriod === 'am' ? 'bg-amber-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600')}>صباحاً</button>
        <button onClick={() => setFilterPeriod('pm')} className={cn('px-3 py-1 rounded-full text-xs font-bold', filterPeriod === 'pm' ? 'bg-indigo-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600')}>مساءً</button>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(['active', 'archived', 'all'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} className={cn('px-3 py-1 rounded-full text-xs font-bold', filterStatus === s ? 'bg-slate-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600')}>
              {s === 'active' ? 'نشطة' : s === 'archived' ? 'مؤرشفة' : 'الكل'}
            </button>
          ))}
        </div>
        <button onClick={() => setSortBy(s => s === 'name' ? 'time' : s === 'time' ? 'students' : s === 'students' ? 'grade' : 'name')} className="text-xs font-bold text-slate-500 flex items-center gap-1">
          <Filter className="w-3 h-3" /> ترتيب: {sortBy === 'name' ? 'الاسم' : sortBy === 'time' ? 'الموعد' : sortBy === 'students' ? 'الطلاب' : 'الصف'}
        </button>
      </div>

      {/* Export/Share buttons */}
      <div className="grid grid-cols-3 gap-2">
        <button onClick={exportPDF} className="py-2 rounded-xl bg-red-600 text-white text-xs font-bold flex items-center justify-center gap-1"><FileDown className="w-3 h-3" /> PDF</button>
        <button onClick={() => window.print()} className="py-2 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center justify-center gap-1"><Printer className="w-3 h-3" /> طباعة</button>
        <button onClick={shareSchedule} className="py-2 rounded-xl bg-green-600 text-white text-xs font-bold flex items-center justify-center gap-1"><Share2 className="w-3 h-3" /> مشاركة</button>
      </div>

      {/* Groups display */}
      {filtered.length === 0 ? (
        <EmptyState title="لا توجد مجموعات" subtitle="أنشئ مجموعة أولاً" icon={<BookOpen className="w-10 h-10" />} />
      ) : viewMode === 'table' ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-emerald-700 text-white">
                <th className="p-2 text-right">المجموعة</th>
                <th className="p-2 text-right">الصف</th>
                <th className="p-2 text-right">الموعد</th>
                <th className="p-2 text-center">الطلاب</th>
                <th className="p-2 text-center">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(g => {
                const count = countStudents(g.id);
                const isFull = g.maxStudents && count >= g.maxStudents;
                return (
                  <tr key={g.id} onClick={() => navigate('group_details', { id: g.id })} className="border-t border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-2">
                      <div className="font-bold text-slate-800 dark:text-slate-100">{g.name}</div>
                      <div className="text-[10px] text-slate-500">{g.subject} • {g.teacherName}</div>
                    </td>
                    <td className="p-2 text-slate-600 dark:text-slate-300">{g.grade}</td>
                    <td className="p-2 text-slate-600 dark:text-slate-300">{scheduleText(g)}</td>
                    <td className="p-2 text-center">
                      <span className={cn('font-bold', isFull ? 'text-red-600' : 'text-emerald-600')}>{count}{g.maxStudents ? `/${g.maxStudents}` : ''}</span>
                    </td>
                    <td className="p-2 text-center">
                      <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold', g.archived ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-700')}>{g.archived ? 'مؤرشفة' : 'نشطة'}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(g => {
            const count = countStudents(g.id);
            return (
              <button key={g.id} onClick={() => navigate('group_details', { id: g.id })} className="w-full p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-right hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-bold text-sm text-slate-800 dark:text-slate-100">{g.name}</div>
                  <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-bold', g.archived ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-700')}>{g.archived ? 'مؤرشفة' : 'نشطة'}</span>
                </div>
                <div className="text-xs text-slate-500 mb-1">{g.grade} • {g.subject} • {g.teacherName}</div>
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="text-blue-600 font-bold flex items-center gap-1"><Calendar className="w-3 h-3" /> {scheduleText(g)}</span>
                  <span className="text-emerald-600 font-bold flex items-center gap-1"><Users className="w-3 h-3" /> {count} طالب</span>
                  <span className="text-amber-600 font-bold">{formatMoney(count * g.monthlyFee)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
