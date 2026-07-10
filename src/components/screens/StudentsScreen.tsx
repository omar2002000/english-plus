// ===== English Plus - Students List Screen =====
'use client';
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/lib/store';
import { getDB } from '@/lib/db';
import type { Student, Group } from '@/lib/types';
import { SearchBar, EmptyState, StatusPill } from '@/components/ui-shared';
import { formatMoney } from '@/lib/helpers';
import { Users, UserPlus, Archive, ChevronLeft, Filter, Upload, FileDown, MoreVertical, Pencil, Trash2, Archive as ArchiveIcon, FileText, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { parseStudentsExcel } from '@/lib/documents';
import { logActivity, generateUniqueStudentCode } from '@/lib/db';
import { cn } from '@/lib/utils';

export function StudentsScreen() {
  const { navigate, settings, refreshKey, triggerRefresh } = useApp();
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [search, setSearch] = useState('');
  const [filterGrade, setFilterGrade] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'archived' | 'paused'>('active');
  const [sortBy, setSortBy] = useState<'name' | 'grade'>('name');
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  // Risk indicators: count absences this month per student
  const [absenceCounts, setAbsenceCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const db = getDB();
        const [s, g, atts, lessons] = await Promise.all([db.students.toArray(), db.groups.toArray(), db.attendance.toArray(), db.lessons.toArray()]);
        setStudents(s);
        setGroups(g);
        // Compute absence counts this month
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        const monthLessonIds = new Set(lessons.filter(l => {
          const d = new Date(l.date);
          return d.getMonth() + 1 === month && d.getFullYear() === year;
        }).map(l => l.id));
        const counts: Record<string, number> = {};
        for (const a of atts) {
          if (a.status === 'absent' && monthLessonIds.has(a.lessonId)) {
            counts[a.studentId] = (counts[a.studentId] || 0) + 1;
          }
        }
        setAbsenceCounts(counts);
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshKey]);

  const grades = useMemo(() => {
    const set = new Set<string>();
    students.forEach(s => set.add(s.grade));
    return Array.from(set);
  }, [students]);

  const filtered = useMemo(() => {
    let list = students.slice();
    if (filterStatus !== 'all') list = list.filter(s => s.status === filterStatus);
    if (filterGrade) list = list.filter(s => s.grade === filterGrade);
    if (search.trim()) {
      const q = search.trim();
      list = list.filter(s => s.name.includes(q) || s.code.includes(q) || s.parentPhone.includes(q));
    }
    list.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name, 'ar');
      return a.grade.localeCompare(b.grade, 'ar');
    });
    return list;
  }, [students, search, filterGrade, filterStatus, sortBy]);

  async function handleImportExcel(file: File) {
    try {
      const parsed = await parseStudentsExcel(file);
      const db = getDB();
      const now = new Date().toISOString();
      let added = 0;
      for (const p of parsed) {
        if (!p.name) continue;
        const code = await generateUniqueStudentCode();
        const group = p.groupName ? groups.find(g => g.name.includes(p.groupName!) || g.code === p.groupName) : null;
        const student: Student = {
          id: crypto.randomUUID(),
          code,
          name: p.name,
          phone: p.phone,
          parentPhone: p.parentPhone,
          grade: p.grade || 'غير محدد',
          subject: p.subject || 'اللغة الإنجليزية',
          academicYear: '2025/2026',
          semester: settings.semesterDefault,
          groupId: group?.id || null,
          joinDate: p.joinDate || now,
          monthlyFee: p.monthlyFee || settings.defaultMonthlyFee,
          debt: 0,
          notes: p.notes,
          status: 'active',
          createdAt: now,
          updatedAt: now,
        };
        await db.students.add(student);
        added++;
      }
      await logActivity('import_students', 'student', undefined, `تم استيراد ${added} طالب`);
      toast.success(`تم استيراد ${added} طالب بنجاح`);
      triggerRefresh();
    } catch (e) {
      console.error(e);
      toast.error('فشل استيراد الملف');
    }
  }

  async function archiveStudent(id: string) {
    const db = getDB();
    await db.students.update(id, { status: 'archived', updatedAt: new Date().toISOString() });
    await logActivity('archive', 'student', id);
    toast.success('تمت الأرشفة');
    triggerRefresh();
  }

  async function deleteStudent(id: string) {
    const db = getDB();
    await db.students.delete(id);
    await db.attendance.where('studentId').equals(id).delete();
    await db.evaluations.where('studentId').equals(id).delete();
    await db.payments.where('studentId').equals(id).delete();
    await logActivity('delete', 'student', id);
    toast.success('تم الحذف');
    setDeleteId(null);
    triggerRefresh();
  }

  async function exportExcel() {
    if (filtered.length === 0) return toast.error('لا يوجد طلاب');
    const { exportStudentsToExcel } = await import('@/lib/documents');
    exportStudentsToExcel(filtered, groups, `students-${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('تم تصدير ملف Excel');
  }

  if (loading) {
    return <div className="p-4 space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-16 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />)}</div>;
  }

  return (
    <div className="p-4 space-y-3 animate-fade-in">
      {/* Search & filters */}
      <div className="flex gap-2">
        <div className="flex-1">
          <SearchBar value={search} onChange={setSearch} placeholder="بحث بالاسم / الكود / الهاتف" />
        </div>
        <label className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-violet-600 cursor-pointer hover:bg-violet-200 transition-colors">
          <Upload className="w-5 h-5" />
          <input
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImportExcel(f); e.currentTarget.value = ''; }}
          />
        </label>
        <button
          onClick={exportExcel}
          className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 hover:bg-emerald-200 transition-colors"
          title="تصدير Excel"
        >
          <FileDown className="w-5 h-5" />
        </button>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {(['active', 'archived', 'paused', 'all'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors',
              filterStatus === s
                ? 'bg-violet-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            )}
          >
            {s === 'active' ? 'نشط' : s === 'archived' ? 'مؤرشف' : s === 'paused' ? 'متوقف' : 'الكل'}
          </button>
        ))}
        {grades.map(g => (
          <button
            key={g}
            onClick={() => setFilterGrade(filterGrade === g ? '' : g)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors',
              filterGrade === g
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            )}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Sort selector */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>العدد: {filtered.length}</span>
        <div className="flex items-center gap-2">
          <Filter className="w-3 h-3" />
          <button
            onClick={() => setSortBy(s => s === 'name' ? 'grade' : 'name')}
            className="font-bold text-slate-600 dark:text-slate-300"
          >
            ترتيب: {sortBy === 'name' ? 'الاسم' : 'الصف'}
          </button>
        </div>
      </div>

      {/* Students list */}
      {filtered.length === 0 ? (
        <EmptyState
          title="لا يوجد طلاب"
          subtitle="ابدأ بإضافة طالب جديد أو استيراد من Excel"
          icon={<Users className="w-10 h-10" />}
          action={
            <button
              onClick={() => navigate('add_student')}
              className="px-4 py-2 rounded-xl bg-violet-600 text-white font-bold text-sm flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" /> إضافة طالب
            </button>
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map(s => {
            const group = groups.find(g => g.id === s.groupId);
            return (
              <div
                key={s.id}
                className="flex items-center gap-3 p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 hover:shadow-md transition-all"
              >
                <button
                  onClick={() => navigate('student_profile', { id: s.id })}
                  className="flex-1 flex items-center gap-3 text-right"
                >
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white font-bold">
                    {s.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">{s.name}</div>
                      {s.debt > 0 && (
                        <span className="px-1.5 py-0.5 rounded-md bg-red-100 text-red-700 text-[10px] font-bold">دين</span>
                      )}
                      {(absenceCounts[s.id] || 0) >= 3 && (
                        <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[10px] font-bold" title={`${absenceCounts[s.id]} غياب هذا الشهر`}>
                          ⚠️ غياب {absenceCounts[s.id]}
                        </span>
                      )}
                      {s.debt > 0 && (absenceCounts[s.id] || 0) >= 3 && (
                        <span className="px-1.5 py-0.5 rounded-md bg-red-600 text-white text-[10px] font-bold animate-pulse" title="طالب في خطر - متأخر + كثير الغياب">
                          🚨 خطر
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {s.grade} • {group?.name || 'بدون مجموعة'} • كود: {s.code}
                    </div>
                  </div>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center">
                    <MoreVertical className="w-4 h-4 text-slate-500" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-44">
                    <DropdownMenuItem onClick={() => navigate('student_profile', { id: s.id })}>
                      <FileText className="w-4 h-4 ml-2" /> الملف الكامل
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('add_student', { id: s.id })}>
                      <Pencil className="w-4 h-4 ml-2" /> تعديل
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('student_profile', { id: s.id, tab: 'card' })}>
                      <QrCode className="w-4 h-4 ml-2" /> بطاقة الطالب
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => archiveStudent(s.id)} className="text-amber-600">
                      <ArchiveIcon className="w-4 h-4 ml-2" /> أرشفة
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDeleteId(s.id)} className="text-red-600">
                      <Trash2 className="w-4 h-4 ml-2" /> حذف
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => navigate('add_student')}
        className="fixed bottom-24 left-1/2 -translate-x-1/2 md:left-[calc(50%-100px)] w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 to-purple-700 text-white shadow-xl flex items-center justify-center active:scale-90 transition-transform z-20"
        style={{ right: 'calc(50% - 28px)', left: 'auto' }}
      >
        <UserPlus className="w-6 h-6" />
      </button>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف الطالب وكل سجلاته (الحضور، التقييم، المدفوعات) نهائياً. لا يمكن التراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteStudent(deleteId)}
              className="bg-red-600 hover:bg-red-700"
            >
              حذف نهائي
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
