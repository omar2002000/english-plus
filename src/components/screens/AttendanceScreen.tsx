// ===== English Plus - Attendance Screen (v4 - with date selection first) =====
'use client';
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/lib/store';
import { getDB, logActivity } from '@/lib/db';
import type { Group, Student, Lesson, Attendance, AttendanceStatus } from '@/lib/types';
import { SearchBar, EmptyState } from '@/components/ui-shared';
import { formatArDate, arDayName, formatTime, getGroupDays, scheduleText } from '@/lib/helpers';
import { ScanLine, Monitor, Pin, ClipboardList, Check, X, Clock, ChevronLeft, CalendarDays, Users, CheckSquare, Square } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';

export function AttendanceScreen() {
  const { params, navigate, refreshKey, triggerRefresh } = useApp();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>(params.groupId || '');
  const [students, setStudents] = useState<Student[]>([]);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [search, setSearch] = useState('');
  const [pinDialog, setPinDialog] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [selectAll, setSelectAll] = useState(true);

  useEffect(() => {
    (async () => {
      const db = getDB();
      const g = await db.groups.toArray().then(gs => gs.filter(g => !g.archived));
      setGroups(g);
    })();
  }, [refreshKey]);

  // when group + date selected, load lesson + students + attendances
  useEffect(() => {
    if (!selectedGroupId) return;
    (async () => {
      const db = getDB();
      // find or create lesson for selected date
      let les = await db.lessons.where('groupId').equals(selectedGroupId).toArray();
      let dateLesson = les.find(l => l.date.split('T')[0] === selectedDate);
      if (!dateLesson) {
        const group = await db.groups.get(selectedGroupId);
        dateLesson = {
          id: crypto.randomUUID(),
          groupId: selectedGroupId,
          date: new Date(selectedDate).toISOString(),
          teacherName: group?.teacherName || '',
          closed: false,
          status: 'open' as const,
          createdAt: new Date().toISOString(),
        };
        await db.lessons.add(dateLesson);
      }
      setLesson(dateLesson);
      const [sts, atts] = await Promise.all([
        db.students.where('groupId').equals(selectedGroupId).toArray(),
        db.attendance.where('lessonId').equals(dateLesson.id).toArray(),
      ]);
      setStudents(sts.filter(s => s.status === 'active').sort((a, b) => a.name.localeCompare(b.name, 'ar')));
      setAttendances(atts);
    })();
  }, [selectedGroupId, selectedDate, refreshKey]);

  const presentCount = attendances.filter(a => a.status === 'present').length;
  const absentCount = attendances.filter(a => a.status === 'absent').length;
  const excusedCount = attendances.filter(a => a.status === 'excused').length;
  const totalExpected = students.length;

  const filteredStudents = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.trim();
    return students.filter(s => s.name.includes(q) || s.code.includes(q));
  }, [students, search]);

  async function markAttendance(studentId: string, status: AttendanceStatus) {
    if (!lesson) return;
    const db = getDB();
    const existing = attendances.find(a => a.studentId === studentId);
    if (existing) {
      await db.attendance.update(existing.id, { status, scannedAt: new Date().toISOString() });
      setAttendances(prev => prev.map(a => a.id === existing.id ? { ...a, status } : a));
    } else {
      const att: Attendance = {
        id: crypto.randomUUID(), studentId, lessonId: lesson.id, groupId: lesson.groupId,
        status, scannedAt: new Date().toISOString(),
      };
      await db.attendance.add(att);
      setAttendances(prev => [...prev, att]);
      await db.students.update(studentId, { lastAttendance: new Date().toISOString() });
    }
    await logActivity('mark_attendance', 'attendance', studentId, `${status}`);
  }

  async function handlePinSubmit() {
    if (!lesson) return;
    const student = students.find(s => s.code === pinInput);
    if (!student) { toast.error('الكود غير صحيح'); return; }
    await markAttendance(student.id, 'present');
    toast.success(`حضر: ${student.name}`);
    setPinInput(''); setPinDialog(false);
  }

  async function markAllPresent() {
    for (const s of students) {
      if (!attendances.find(a => a.studentId === s.id && a.status === 'present')) {
        await markAttendance(s.id, 'present');
      }
    }
    toast.success('تم تحديد الكل حاضر');
  }

  async function clearAll() {
    if (!lesson) return;
    const db = getDB();
    for (const a of attendances) {
      await db.attendance.delete(a.id);
    }
    setAttendances([]);
    toast.success('تم إلغاء الكل');
  }

  if (groups.length === 0) {
    return <EmptyState title="لا توجد مجموعات" subtitle="أنشئ مجموعة أولاً" icon={<ClipboardList className="w-10 h-10" />} />;
  }

  // ===== STEP 1: Date + Group Selection =====
  if (!selectedGroupId) {
    const arDay = arDayName(new Date(selectedDate));
    const dayGroups = groups.filter(g => getGroupDays(g).includes(arDay));
    return (
      <div className="p-4 space-y-4 animate-fade-in">
        <div className="rounded-2xl bg-gradient-to-l from-orange-700 to-orange-900 p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="w-5 h-5" />
            <div className="font-bold">الخطوة 1: اختر اليوم والتاريخ</div>
          </div>
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full bg-white/20 rounded-xl py-2.5 px-3 text-white font-bold focus:outline-none" />
          <div className="text-sm mt-2 opacity-90">{arDay} - {formatArDate(selectedDate)}</div>
        </div>
        <div>
          <div className="font-bold text-sm text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-2">
            <Users className="w-4 h-4 text-orange-600" />
            الخطوة 2: اختر المجموعة ({dayGroups.length} مجموعة اليوم)
          </div>
          {dayGroups.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-sm">لا توجد مجموعات في هذا اليوم</div>
          ) : (
            <div className="space-y-2">
              {dayGroups.map(g => (
                <button key={g.id} onClick={() => setSelectedGroupId(g.id)}
                  className="w-full p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 hover:shadow-md transition-all flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600">
                      <Users className="w-5 h-5" />
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-sm text-slate-800 dark:text-slate-100">{g.name}</div>
                      <div className="text-xs text-slate-500">{g.scheduleDay} • {g.grade}</div>
                    </div>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-slate-400" />
                </button>
              ))}
            </div>
          )}
          <details className="mt-3">
            <summary className="text-xs font-bold text-slate-500 cursor-pointer">كل المجموعات ({groups.length})</summary>
            <div className="mt-2 space-y-1.5">
              {groups.map(g => (
                <button key={g.id} onClick={() => setSelectedGroupId(g.id)}
                  className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50 text-right text-sm hover:bg-slate-100">
                  {g.name} - {getGroupDays(g).join('، ')}
                </button>
              ))}
            </div>
          </details>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3 animate-fade-in pb-32">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-l from-orange-700 to-orange-900 p-4 text-white shadow-lg">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-xs opacity-80">{formatArDate(selectedDate)}</div>
            <div className="font-bold">{groups.find(g => g.id === selectedGroupId)?.name}</div>
          </div>
          <button onClick={() => setSelectedGroupId('')} className="text-xs bg-white/20 px-2 py-1 rounded-lg">تغيير</button>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="bg-white/10 rounded-lg py-1.5"><div className="text-lg font-bold">{totalExpected}</div><div className="text-[10px] opacity-80">الإجمالي</div></div>
          <div className="bg-white/10 rounded-lg py-1.5"><div className="text-lg font-bold">{presentCount}</div><div className="text-[10px] opacity-80">حاضر</div></div>
          <div className="bg-white/10 rounded-lg py-1.5"><div className="text-lg font-bold">{absentCount}</div><div className="text-[10px] opacity-80">غائب</div></div>
          <div className="bg-white/10 rounded-lg py-1.5"><div className="text-lg font-bold">{excusedCount}</div><div className="text-[10px] opacity-80">بعذر</div></div>
        </div>
        <div className="mt-3 h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-white transition-all" style={{ width: `${totalExpected > 0 ? (presentCount / totalExpected) * 100 : 0}%` }} />
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => navigate('scanner', { groupId: selectedGroupId, lessonId: lesson?.id || '' })}
          className="py-3 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 text-white text-xs font-bold flex flex-col items-center gap-1 active:scale-95 transition-transform shadow-md">
          <ScanLine className="w-5 h-5" /> مسح الباركود
        </button>
        <button onClick={() => setPinDialog(true)}
          className="py-3 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-700 text-white text-xs font-bold flex flex-col items-center gap-1 active:scale-95 transition-transform shadow-md">
          <Pin className="w-5 h-5" /> كود PIN
        </button>
        <button onClick={() => navigate('kiosk', { groupId: selectedGroupId, lessonId: lesson?.id || '' })}
          className="py-3 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 text-white text-xs font-bold flex flex-col items-center gap-1 active:scale-95 transition-transform shadow-md">
          <Monitor className="w-5 h-5" /> بوابة ذاتية
        </button>
      </div>

      {/* Bulk actions */}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={markAllPresent} className="py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center justify-center gap-1">
          <CheckSquare className="w-4 h-4" /> تحديد الكل حاضر
        </button>
        <button onClick={clearAll} className="py-2 rounded-xl bg-red-600 text-white text-xs font-bold flex items-center justify-center gap-1">
          <Square className="w-4 h-4" /> إلغاء الكل
        </button>
      </div>

      {/* Search */}
      <SearchBar value={search} onChange={setSearch} placeholder="بحث عن طالب" />

      {/* Students list */}
      <div className="space-y-2">
        {filteredStudents.map(s => {
          const att = attendances.find(a => a.studentId === s.id);
          const status = att?.status;
          return (
            <div key={s.id} className={cn(
              'p-3 rounded-2xl border transition-all',
              status === 'present' ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900' :
              status === 'absent' ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900' :
              status === 'excused' ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900' :
              'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'
            )}>
              <div className="flex items-center gap-3">
                <button onClick={() => navigate('student_profile', { id: s.id })} className="flex-1 flex items-center gap-3 text-right">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white',
                    status === 'present' ? 'bg-emerald-500' : status === 'absent' ? 'bg-red-500' : status === 'excused' ? 'bg-blue-500' : 'bg-slate-400')}>
                    {s.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-800 dark:text-slate-100">{s.name}</div>
                    <div className="text-xs text-slate-500">كود: {s.code}</div>
                  </div>
                </button>
                <div className="flex gap-1">
                  <button onClick={() => markAttendance(s.id, 'present')} className={cn('w-9 h-9 rounded-lg flex items-center justify-center transition-all active:scale-90', status === 'present' ? 'bg-emerald-600 text-white scale-110 shadow-md' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600')} title="حاضر">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => markAttendance(s.id, 'absent')} className={cn('w-9 h-9 rounded-lg flex items-center justify-center transition-all active:scale-90', status === 'absent' ? 'bg-red-600 text-white scale-110 shadow-md' : 'bg-red-100 dark:bg-red-900/30 text-red-600')} title="غائب">
                    <X className="w-4 h-4" />
                  </button>
                  <button onClick={() => markAttendance(s.id, 'excused')} className={cn('w-9 h-9 rounded-lg flex items-center justify-center transition-all active:scale-90', status === 'excused' ? 'bg-blue-600 text-white scale-110 shadow-md' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600')} title="بعذر">
                    <Clock className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredStudents.length === 0 && <EmptyState title="لا يوجد طلاب" subtitle="أضف طلاباً لهذه المجموعة" icon={<Users className="w-10 h-10" />} />}

      {/* PIN Dialog */}
      <Dialog open={pinDialog} onOpenChange={setPinDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>إدخال كود الطالب (PIN)</DialogTitle></DialogHeader>
          <input type="text" inputMode="numeric" maxLength={4} value={pinInput}
            onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="••••"
            className="w-full text-center text-3xl font-bold tracking-widest py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500" autoFocus />
          <DialogFooter>
            <button onClick={() => setPinDialog(false)} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600">إلغاء</button>
            <button onClick={handlePinSubmit} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold">تسجيل حضور</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
