// ===== English Plus - Contact Log Screen =====
'use client';
import { useEffect, useState } from 'react';
import { useApp } from '@/lib/store';
import { getDB, logActivity } from '@/lib/db';
import type { Student, MessageLog } from '@/lib/types';
import { SearchBar, EmptyState } from '@/components/ui-shared';
import { formatArDate, formatArDateShort, arMonthName } from '@/lib/helpers';
import { Phone, MessageCircle, Trash2, Plus, History, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface ContactEntry {
  id: string;
  studentId: string;
  studentName: string;
  type: 'whatsapp' | 'call' | 'email' | 'meeting';
  reason: string;
  note: string;
  date: string;
}

const TYPE_LABELS: Record<string, string> = { whatsapp: 'واتساب', call: 'مكالمة', email: 'إيميل', meeting: 'اجتماع' };
const TYPE_COLORS: Record<string, string> = { whatsapp: 'bg-green-100 text-green-700', call: 'bg-blue-100 text-blue-700', email: 'bg-amber-100 text-amber-700', meeting: 'bg-violet-100 text-violet-700' };
const TYPE_ICONS: Record<string, any> = { whatsapp: MessageCircle, call: Phone, email: MessageCircle, meeting: Phone };

export function ContactLogScreen() {
  const { navigate, refreshKey } = useApp();
  const [contacts, setContacts] = useState<ContactEntry[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newContact, setNewContact] = useState({ studentId: '', type: 'call' as ContactEntry['type'], reason: '', note: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const db = getDB();
      const [msgs, sts] = await Promise.all([db.messages.toArray(), db.students.toArray()]);
      setStudents(sts);
      // Convert messages to contact entries
      const entries: ContactEntry[] = msgs.map(m => {
        const s = sts.find(s => s.id === m.studentId);
        return {
          id: m.id,
          studentId: m.studentId,
          studentName: s?.name || '—',
          type: 'whatsapp' as const,
          reason: m.templateType,
          note: m.messageBody.slice(0, 100),
          date: m.sentAt,
        };
      });
      entries.sort((a, b) => b.date.localeCompare(a.date));
      setContacts(entries);
      setLoading(false);
    })();
  }, [refreshKey]);

  async function addContact() {
    if (!newContact.studentId) return toast.error('اختر طالباً');
    const db = getDB();
    const student = students.find(s => s.id === newContact.studentId);
    const entry: ContactEntry = {
      id: crypto.randomUUID(),
      studentId: newContact.studentId,
      studentName: student?.name || '—',
      type: newContact.type,
      reason: newContact.reason || '—',
      note: newContact.note,
      date: new Date().toISOString(),
    };
    // Store as a message with custom type
    await db.messages.add({
      id: entry.id,
      studentId: entry.studentId,
      parentPhone: student?.parentPhone || '',
      templateType: `contact_${entry.type}`,
      messageBody: `${entry.reason}: ${entry.note}`,
      sentAt: entry.date,
      status: 'sent',
    });
    await logActivity('add_contact', 'student', entry.studentId, `${TYPE_LABELS[entry.type]}: ${entry.reason}`);
    setContacts(prev => [entry, ...prev]);
    toast.success('تم تسجيل التواصل');
    setShowAdd(false);
    setNewContact({ studentId: '', type: 'call', reason: '', note: '' });
  }

  async function deleteContact(id: string) {
    const db = getDB();
    await db.messages.delete(id);
    setContacts(prev => prev.filter(c => c.id !== id));
    toast.success('تم الحذف');
  }

  const filtered = contacts.filter(c =>
    !search.trim() || c.studentName.includes(search) || c.reason.includes(search)
  );

  return (
    <div className="p-4 space-y-3 animate-fade-in pb-32">
      <button onClick={() => setShowAdd(true)} className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center gap-2">
        <Plus className="w-5 h-5" /> تسجيل تواصل جديد
      </button>
      <SearchBar value={search} onChange={setSearch} placeholder="بحث في السجل..." />
      {filtered.length === 0 ? (
        <EmptyState title="لا يوجد سجل تواصل" subtitle="سجّل أول تواصل مع ولي أمر" icon={<History className="w-10 h-10" />} />
      ) : (
        <div className="space-y-2">
          {filtered.map(c => {
            const Icon = TYPE_ICONS[c.type] || Phone;
            return (
              <div key={c.id} className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', TYPE_COLORS[c.type])}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-sm">{c.studentName}</div>
                      <div className="text-[10px] text-slate-500">{formatArDateShort(c.date)} • {TYPE_LABELS[c.type]}</div>
                    </div>
                  </div>
                  <button onClick={() => deleteContact(c.id)} className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 flex items-center justify-center">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-bold">السبب:</span> {c.reason}
                </div>
                {c.note && <div className="text-xs text-slate-500 mt-1 line-clamp-2">{c.note}</div>}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader><DialogTitle>تسجيل تواصل جديد</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <select value={newContact.studentId} onChange={e => setNewContact({ ...newContact, studentId: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-3 text-sm">
              <option value="">اختر الطالب</option>
              {students.filter(s => s.status === 'active').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select value={newContact.type} onChange={e => setNewContact({ ...newContact, type: e.target.value as any })} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-3 text-sm">
              <option value="call">مكالمة هاتفية</option>
              <option value="whatsapp">واتساب</option>
              <option value="meeting">اجتماع</option>
              <option value="email">إيميل</option>
            </select>
            <input type="text" placeholder="السبب (غياب/تأخر دفع/تميز...)" value={newContact.reason} onChange={e => setNewContact({ ...newContact, reason: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-3 text-sm" />
            <textarea placeholder="ملاحظات" value={newContact.note} onChange={e => setNewContact({ ...newContact, note: e.target.value })} rows={3} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm resize-none" />
          </div>
          <DialogFooter>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600">إلغاء</button>
            <button onClick={addContact} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold">تسجيل</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
