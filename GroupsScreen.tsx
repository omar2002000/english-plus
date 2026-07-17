// ===== English Plus - Groups Screen =====
'use client';
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/lib/store';
import { getDB } from '@/lib/db';
import type { Group, Student } from '@/lib/types';
import { SearchBar, EmptyState, StatusPill } from '@/components/ui-shared';
import { formatMoney, scheduleText } from '@/lib/helpers';
import { BookOpen, FolderPlus, ChevronLeft, MoreVertical, Pencil, Trash2, Archive as ArchiveIcon, Users } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { logActivity } from '@/lib/db';
import { cn } from '@/lib/utils';

export function GroupsScreen() {
  const { navigate, refreshKey, triggerRefresh } = useApp();
  const [groups, setGroups] = useState<Group[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

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

  const filtered = useMemo(() => {
    let list = groups.filter(g => g.archived === showArchived);
    if (search.trim()) {
      const q = search.trim();
      list = list.filter(g => g.name.includes(q) || g.code.includes(q) || g.grade.includes(q));
    }
    return list.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [groups, search, showArchived]);

  function countStudents(gid: string) {
    return students.filter(s => s.groupId === gid && s.status === 'active').length;
  }

  function totalIncome(g: Group) {
    return countStudents(g.id) * g.monthlyFee;
  }

  async function archiveGroup(id: string) {
    const db = getDB();
    await db.groups.update(id, { archived: true, updatedAt: new Date().toISOString() });
    await logActivity('archive', 'group', id);
    toast.success('تمت الأرشفة');
    triggerRefresh();
  }

  async function deleteGroup(id: string) {
    const db = getDB();
    const hasStudents = students.some(s => s.groupId === id);
    if (hasStudents) {
      toast.error('لا يمكن حذف مجموعة تحتوي على طلاب. أرشفها أو انقل الطلاب أولاً.');
      setDeleteId(null);
      return;
    }
    await db.groups.delete(id);
    await db.lessons.where('groupId').equals(id).delete();
    await logActivity('delete', 'group', id);
    toast.success('تم الحذف');
    setDeleteId(null);
    triggerRefresh();
  }

  if (loading) {
    return <div className="p-4 space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />)}</div>;
  }

  return (
    <div className="p-4 space-y-3 animate-fade-in">
      <div className="flex gap-2">
        <div className="flex-1">
          <SearchBar value={search} onChange={setSearch} placeholder="بحث عن مجموعة" />
        </div>
        <button
          onClick={() => navigate('groups_schedule')}
          className="px-3 rounded-xl text-xs font-bold whitespace-nowrap bg-emerald-600 text-white"
          title="جدول المجموعات"
        >
          📅 الجدول
        </button>
        <button
          onClick={() => setShowArchived(!showArchived)}
          className={cn(
            'px-3 rounded-xl text-xs font-bold whitespace-nowrap transition-colors',
            showArchived ? 'bg-slate-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
          )}
        >
          {showArchived ? 'المؤرشفة' : 'النشطة'}
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="لا توجد مجموعات"
          subtitle="أنشئ أول مجموعة تعليمية"
          icon={<BookOpen className="w-10 h-10" />}
          action={
            <button onClick={() => navigate('add_group')} className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-sm flex items-center gap-2">
              <FolderPlus className="w-4 h-4" /> إضافة مجموعة
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(g => {
            const count = countStudents(g.id);
            const income = totalIncome(g);
            const isFull = g.maxStudents && count >= g.maxStudents;
            const isLow = g.maxStudents && count <= Math.ceil(g.maxStudents * 0.3) && count > 0;
            const isCrowded = g.maxStudents && count >= Math.ceil(g.maxStudents * 0.8) && count < g.maxStudents;
            return (
              <div
                key={g.id}
                className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm hover:shadow-md transition-all"
              >
                <button
                  onClick={() => navigate('group_details', { id: g.id })}
                  className="w-full text-right p-3 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-700 flex items-center justify-center text-white">
                      <BookOpen className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">{g.name}</div>
                        {isFull && <span className="px-1.5 py-0.5 rounded-md bg-red-100 text-red-700 text-[10px] font-bold">مكتملة</span>}
                        {isLow && <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[10px] font-bold" title="عدد الطلاب منخفض">منخفضة</span>}
                        {isCrowded && <span className="px-1.5 py-0.5 rounded-md bg-orange-100 text-orange-700 text-[10px] font-bold" title="قاربت على الامتلاء">مزدحمة</span>}
                      </div>
                      <div className="text-xs text-slate-500">{g.grade} • {g.subject} • {scheduleText(g)}</div>
                      <div className="flex items-center gap-3 mt-1 text-[10px]">
                        <span className="text-emerald-600 font-bold">{count}/{g.maxStudents || '∞'} طالب</span>
                        <span className="text-amber-600 font-bold">{formatMoney(income)}</span>
                        <span className="text-slate-500">{g.paymentMode === 'start' ? 'أول الشهر' : 'آخر الشهر'}</span>
                      </div>
                    </div>
                  </div>
                </button>
                <div className="flex border-t border-slate-100 dark:border-slate-700">
                  <button onClick={() => navigate('group_details', { id: g.id })} className="flex-1 py-2 text-xs font-bold text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20">
                    <Users className="w-3.5 h-3.5 inline ml-1" /> الطلاب
                  </button>
                  <button onClick={() => navigate('add_group', { id: g.id })} className="flex-1 py-2 text-xs font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-r border-l border-slate-100 dark:border-slate-700">
                    <Pencil className="w-3.5 h-3.5 inline ml-1" /> تعديل
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="flex-1 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700">
                      <MoreVertical className="w-3.5 h-3.5 inline" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-40">
                      <DropdownMenuItem onClick={() => archiveGroup(g.id)} className="text-amber-600">
                        <ArchiveIcon className="w-4 h-4 ml-2" /> أرشفة
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setDeleteId(g.id)} className="text-red-600">
                        <Trash2 className="w-4 h-4 ml-2" /> حذف
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={() => navigate('add_group')}
        className="fixed bottom-24 w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-green-700 text-white shadow-xl flex items-center justify-center active:scale-90 transition-transform z-20"
        style={{ right: 'calc(50% - 28px)' }}
      >
        <FolderPlus className="w-6 h-6" />
      </button>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد حذف المجموعة</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف المجموعة نهائياً. يجب إخلاء المجموعة من الطلاب أولاً.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteGroup(deleteId)}
              className="bg-red-600 hover:bg-red-700"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
