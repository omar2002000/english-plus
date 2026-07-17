// ===== English Plus - Add/Edit Group (with multiple schedules) =====
'use client';
import { useEffect, useState } from 'react';
import { useApp } from '@/lib/store';
import { getDB, logActivity } from '@/lib/db';
import type { Group, PaymentMode, GroupSchedule } from '@/lib/types';
import { toast } from 'sonner';
import { Save, BookOpen, CalendarDays, Wallet, Users, Plus, Trash2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

const GRADES = [
  'الأول الابتدائي', 'الثاني الابتدائي', 'الثالث الابتدائي', 'الرابع الابتدائي', 'الخامس الابتدائي', 'السادس الابتدائي',
  'الأول الإعدادي', 'الثاني الإعدادي', 'الثالث الإعدادي',
  'الأول الثانوي', 'الثاني الثانوي', 'الثالث الثانوي',
];
const SUBJECTS = ['اللغة الإنجليزية', 'اللغة العربية', 'الرياضيات', 'العلوم', 'الدراسات', 'الفرنسية', 'الفيزياء', 'الكيمياء', 'الأحياء', 'الجيولوجيا', 'التاريخ', 'الجغرافيا'];
const DAYS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

export function AddGroup() {
  const { params, settings, navigate, back, triggerRefresh } = useApp();
  const editId = params.id;
  const [loading, setLoading] = useState(!!editId);
  const [form, setForm] = useState({
    name: '',
    grade: GRADES[8],
    subject: SUBJECTS[0],
    academicYear: '2025/2026',
    teacherName: settings.teacherName,
    paymentMode: 'end' as PaymentMode,
    startDate: new Date().toISOString().split('T')[0],
    lessonsPerMonth: 8,
    monthlyFee: settings.defaultMonthlyFee,
    maxStudents: 20,
    notes: '',
  });
  // ===== NEW: multiple schedules =====
  const [schedules, setSchedules] = useState<GroupSchedule[]>([
    { id: crypto.randomUUID(), day: DAYS[0], hour: 4, minute: 0, period: 'pm' as const },
  ]);
  // new schedule being added
  const [newSchedule, setNewSchedule] = useState({ day: DAYS[1], hour: 4, minute: 0, period: 'pm' as 'am' | 'pm' });

  useEffect(() => {
    (async () => {
      if (editId) {
        const db = getDB();
        const g = await db.groups.get(editId);
        if (g) {
          setForm({
            name: g.name,
            grade: g.grade,
            subject: g.subject,
            academicYear: g.academicYear,
            teacherName: g.teacherName,
            paymentMode: g.paymentMode,
            startDate: g.startDate.split('T')[0],
            lessonsPerMonth: g.lessonsPerMonth,
            monthlyFee: g.monthlyFee,
            maxStudents: g.maxStudents || 20,
            notes: g.notes || '',
          });
          // Load schedules (or create from legacy single schedule)
          if (g.schedules && g.schedules.length > 0) {
            setSchedules(g.schedules);
          } else {
            setSchedules([{ id: crypto.randomUUID(), day: g.scheduleDay, hour: g.scheduleHour, minute: g.scheduleMinute, period: g.schedulePeriod }]);
          }
        }
        setLoading(false);
      }
    })();
  }, [editId]);

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function addSchedule() {
    const newSched: GroupSchedule = {
      id: crypto.randomUUID(),
      day: newSchedule.day,
      hour: newSchedule.hour,
      minute: newSchedule.minute,
      period: newSchedule.period,
    };
    // Prevent duplicates
    if (schedules.some(s => s.day === newSched.day && s.hour === newSched.hour && s.minute === newSched.minute && s.period === newSched.period)) {
      toast.error('هذا الموعد مضاف بالفعل');
      return;
    }
    setSchedules(prev => [...prev, newSched]);
    toast.success('تمت إضافة الموعد');
  }

  function removeSchedule(id: string) {
    if (schedules.length === 1) {
      toast.error('يجب وجود موعد واحد على الأقل');
      return;
    }
    setSchedules(prev => prev.filter(s => s.id !== id));
  }

  function formatSchedule(s: GroupSchedule): string {
    const period = s.period === 'am' ? 'صباحاً' : 'مساءً';
    const h = s.hour % 12 || 12;
    return `${s.day} - ${h}:${String(s.minute).padStart(2, '0')} ${period}`;
  }

  async function handleSubmit() {
    if (!form.name.trim()) return toast.error('اسم المجموعة مطلوب');
    if (schedules.length === 0) return toast.error('يجب إضافة موعد واحد على الأقل');
    const db = getDB();
    const now = new Date().toISOString();
    const primarySchedule = schedules[0];
    if (editId) {
      const existing = await db.groups.get(editId);
      if (!existing) return;
      const updated: Group = {
        ...existing,
        ...form,
        scheduleDay: primarySchedule.day,
        scheduleHour: primarySchedule.hour,
        scheduleMinute: primarySchedule.minute,
        schedulePeriod: primarySchedule.period,
        schedules,
        lessonsPerMonth: Number(form.lessonsPerMonth),
        monthlyFee: Number(form.monthlyFee),
        maxStudents: Number(form.maxStudents),
        startDate: new Date(form.startDate).toISOString(),
        updatedAt: now,
      };
      await db.groups.put(updated);
      await logActivity('update', 'group', editId, `تعديل المجموعة ${form.name}`);
      toast.success('تم تحديث المجموعة');
    } else {
      const code = `G${String(await db.groups.count() + 1).padStart(3, '0')}`;
      const group: Group = {
        id: crypto.randomUUID(),
        code,
        name: form.name.trim(),
        grade: form.grade,
        subject: form.subject,
        academicYear: form.academicYear,
        teacherName: form.teacherName,
        scheduleDay: primarySchedule.day,
        scheduleHour: primarySchedule.hour,
        scheduleMinute: primarySchedule.minute,
        schedulePeriod: primarySchedule.period,
        schedules,
        paymentMode: form.paymentMode,
        startDate: new Date(form.startDate).toISOString(),
        lessonsPerMonth: Number(form.lessonsPerMonth),
        monthlyFee: Number(form.monthlyFee),
        maxStudents: Number(form.maxStudents),
        notes: form.notes || undefined,
        archived: false,
        createdAt: now,
        updatedAt: now,
      };
      await db.groups.add(group);
      await logActivity('create', 'group', group.id, `إضافة المجموعة ${form.name}`);
      toast.success(`تم إنشاء المجموعة - ${code}`);
    }
    triggerRefresh();
    back();
  }

  if (loading) {
    return <div className="p-4 space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-12 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />)}</div>;
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in pb-32">
      <FieldGroup title="بيانات المجموعة" icon={<BookOpen className="w-4 h-4" />}>
        <Input label="اسم المجموعة *" value={form.name} onChange={v => set('name', v)} placeholder="مثال: مجموعة الصف الأول الثانوي" />
        <div className="grid grid-cols-2 gap-2">
          <Select label="الصف الدراسي" value={form.grade} onChange={v => set('grade', v)} options={GRADES} />
          <Select label="المادة" value={form.subject} onChange={v => set('subject', v)} options={SUBJECTS} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input label="العام الدراسي" value={form.academicYear} onChange={v => set('academicYear', v)} />
          <Input label="اسم المدرس" value={form.teacherName} onChange={v => set('teacherName', v)} />
        </div>
      </FieldGroup>

      {/* ===== NEW: Multiple Schedules ===== */}
      <FieldGroup title="مواعيد المجموعة (متعدد)" icon={<CalendarDays className="w-4 h-4" />}>
        {/* Current schedules list */}
        <div className="space-y-2">
          {schedules.map((s, idx) => (
            <div key={s.id} className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700">
              <Clock className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <div className="flex-1 text-sm font-bold text-slate-700 dark:text-slate-200">
                {idx === 0 && <span className="text-[10px] text-emerald-600 ml-1">(رئيسي)</span>}
                {formatSchedule(s)}
              </div>
              <button
                onClick={() => removeSchedule(s.id)}
                className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 flex items-center justify-center"
                title="حذف الموعد"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        {/* Add new schedule form */}
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900/30 space-y-2">
          <div className="text-xs font-bold text-emerald-700 dark:text-emerald-300">إضافة موعد جديد</div>
          <Select label="اليوم" value={newSchedule.day} onChange={v => setNewSchedule({ ...newSchedule, day: v })} options={DAYS} />
          <div className="grid grid-cols-3 gap-2">
            <Select label="الساعة" value={String(newSchedule.hour)} onChange={v => setNewSchedule({ ...newSchedule, hour: Number(v) })} options={Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))} />
            <Select label="الدقيقة" value={String(newSchedule.minute)} onChange={v => setNewSchedule({ ...newSchedule, minute: Number(v) })} options={[{ value: '0', label: '00' }, { value: '15', label: '15' }, { value: '30', label: '30' }, { value: '45', label: '45' }]} />
            <Select label="الفترة" value={newSchedule.period} onChange={v => setNewSchedule({ ...newSchedule, period: v as 'am' | 'pm' })} options={[{ value: 'am', label: 'صباحاً' }, { value: 'pm', label: 'مساءً' }]} />
          </div>
          <button
            onClick={addSchedule}
            className="w-full py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold flex items-center justify-center gap-1 active:scale-95"
          >
            <Plus className="w-4 h-4" /> إضافة الموعد
          </button>
        </div>

        <Input label="تاريخ بداية المجموعة" type="date" value={form.startDate} onChange={v => set('startDate', v)} />
      </FieldGroup>

      <FieldGroup title="البيانات المالية والإدارية" icon={<Wallet className="w-4 h-4" />}>
        <div className="grid grid-cols-2 gap-2">
          <Input label="عدد الحصص شهرياً" type="number" value={String(form.lessonsPerMonth)} onChange={v => set('lessonsPerMonth', Number(v))} />
          <Input label="الحد الأقصى للطلاب" type="number" value={String(form.maxStudents)} onChange={v => set('maxStudents', Number(v))} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input label="الاشتراك الشهري (ج.م)" type="number" value={String(form.monthlyFee)} onChange={v => set('monthlyFee', Number(v))} />
          <Select label="نظام الدفع" value={form.paymentMode} onChange={v => set('paymentMode', v as PaymentMode)} options={[{ value: 'start', label: 'أول الشهر' }, { value: 'end', label: 'آخر الشهر' }]} />
        </div>
        <Textarea label="ملاحظات" value={form.notes} onChange={v => set('notes', v)} />
      </FieldGroup>

      <div className="rounded-2xl bg-blue-50 dark:bg-blue-900/20 p-3 text-xs text-blue-700 dark:text-blue-300">
        <strong>ملاحظة:</strong> عند ربط الطلاب بالمجموعة، يتم احتساب إجمالي الدخل المتوقع = عدد الطلاب × الاشتراك الشهري.
      </div>

      <div className="sticky bottom-4 z-20 mx-4 p-3 rounded-2xl glass border-2 border-slate-300 dark:border-slate-700 shadow-xl" >
        <button
          onClick={handleSubmit}
          className="w-full py-3 rounded-2xl bg-gradient-to-l from-emerald-500 to-green-700 text-white font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg"
        >
          <Save className="w-5 h-5" />
          {editId ? 'حفظ التعديلات' : 'إنشاء المجموعة'}
        </button>
      </div>
    </div>
  );
}

function FieldGroup({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-4 space-y-3">
      <div className="flex items-center gap-2 text-emerald-600 font-bold">
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

function Input({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
      />
    </div>
  );
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all resize-none"
      />
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Array<string | { value: string; label: string }> }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
      >
        {options.map((o, i) => {
          const v = typeof o === 'string' ? o : o.value;
          const l = typeof o === 'string' ? o : o.label;
          return <option key={i} value={v}>{l}</option>;
        })}
      </select>
    </div>
  );
}
