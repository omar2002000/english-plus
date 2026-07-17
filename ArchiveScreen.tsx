// ===== English Plus - Archive Screen =====
'use client';
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/lib/store';
import { getDB, logActivity } from '@/lib/db';
import type { Student } from '@/lib/types';
import { SearchBar, EmptyState } from '@/components/ui-shared';
import { Archive, RotateCcw, Trash2, ChevronLeft, Users } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function ArchiveScreen() {
  const { navigate, refreshKey, triggerRefresh } = useApp();
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const db = getDB();
      const s = await db.students.toArray();
      setStudents(s.filter(st => st.status === 'archived'));
    })();
  }, [refreshKey]);

  const filtered = useMemo(() => {
    let list = students.slice();
    if (search.trim()) {
      const q = search.trim();
      list = list.filter(s => s.name.includes(q) || s.code.includes(q) || s.grade.includes(q));
    }
    return list.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [students, search]);

  async function restore(id: string) {
    const db = getDB();
    await db.students.update(id, { status: 'active', updatedAt: new Date().toISOString() });
    await logActivity('restore', 'student', id);
    toast.success('تمت الاستعادة');
    setStudents(prev => prev.filter(s => s.id !== id));
    triggerRefresh();
  }

  async function deletePermanent(id: string) {
    const db = getDB();
    await db.students.delete(id);
    await db.attendance.where('studentId').equals(id).delete();
    await db.evaluations.where('studentId').equals(id).delete();
    await db.payments.where('studentId').equals(id).delete();
    await logActivity('delete_permanent', 'student', id);
    toast.success('تم الحذف النهائي');
    setDeleteId(null);
    setStudents(prev => prev.filter(s => s.id !== id));
    triggerRefresh();
  }

  return (
    <div className="p-4 space-y-3 animate-fade-in">
      <SearchBar value={search} onChange={setSearch} placeholder="بحث في الأرشيف" />

      {filtered.length === 0 ? (
        <EmptyState
          title="الأرشيف فارغ"
          subtitle="الطلاب المؤرشفون سيظهرون هنا"
          icon={<Archive className="w-10 h-10" />}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map(s => (
            <div key={s.id} className="flex items-center gap-2 p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
              <button onClick={() => navigate('student_profile', { id: s.id })} className="flex-1 flex items-center gap-3 text-right">
                <div className="w-10 h-10 rounded-xl bg-slate-400 flex items-center justify-center text-white font-bold">
                  {s.name.charAt(0)}
                </div>
                <div>
                  <div className="font-bold text-sm text-slate-800 dark:text-slate-100">{s.name}</div>
                  <div className="text-xs text-slate-500">{s.grade} • كود: {s.code}</div>
                </div>
              </button>
              <button
                onClick={() => restore(s.id)}
                className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center"
                title="استعادة"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setDeleteId(s.id)}
                className="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 flex items-center justify-center"
                title="حذف نهائي"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف نهائي</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف الطالب وكل سجلاته نهائياً. لا يمكن التراجع.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deletePermanent(deleteId)}
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
