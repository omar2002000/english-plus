// ===== English Plus - Add/Edit Student Screen =====
'use client';
import { useEffect, useState } from 'react';
import { useApp } from '@/lib/store';
import { getDB, generateUniqueStudentCode, logActivity } from '@/lib/db';
import type { Student, Group, Semester, StudentStatus } from '@/lib/types';
import { toast } from 'sonner';
import { Save, User, Phone, PhoneCall, GraduationCap, BookOpen, CalendarDays, Wallet, FileText, Camera, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const GRADES = [
  'الأول الابتدائي', 'الثاني الابتدائي', 'الثالث الابتدائي', 'الرابع الابتدائي', 'الخامس الابتدائي', 'السادس الابتدائي',
  'الأول الإعدادي', 'الثاني الإعدادي', 'الثالث الإعدادي',
  'الأول الثانوي', 'الثاني الثانوي', 'الثالث الثانوي',
];

const SUBJECTS = ['اللغة الإنجليزية', 'اللغة العربية', 'الرياضيات', 'العلوم', 'الدراسات', 'الفرنسية', 'الفيزياء', 'الكيمياء', 'الأحياء', 'الجيولوجيا', 'التاريخ', 'الجغرافيا'];

export function AddStudent() {
  const { params, navigate, settings, triggerRefresh, back } = useApp();
  const editId = params.id;
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(!!editId);
  const [photoPreview, setPhotoPreview] = useState<string>('');

  const [form, setForm] = useState({
    name: '',
    phone: '',
    parentPhone: '',
    parentAltPhone: '',
    grade: GRADES[8],
    subject: SUBJECTS[0],
    academicYear: '2025/2026',
    semester: 'first' as Semester,
    groupId: '' as string,
    scheduleNote: '',
    joinDate: new Date().toISOString().split('T')[0],
    monthlyFee: settings.defaultMonthlyFee,
    debt: 0,
    notes: '',
    healthNotes: '',
    behaviorNotes: '',
    address: '',
    school: '',
    status: 'active' as StudentStatus,
    photo: '',
  });

  useEffect(() => {
    (async () => {
      const db = getDB();
      const g = await db.groups.toArray().then(gs => gs.filter(g => !g.archived));
      setGroups(g);
      if (editId) {
        const s = await db.students.get(editId);
        if (s) {
          setForm({
            name: s.name,
            phone: s.phone,
            parentPhone: s.parentPhone,
            parentAltPhone: s.parentAltPhone || '',
            grade: s.grade,
            subject: s.subject,
            academicYear: s.academicYear,
            semester: s.semester,
            groupId: s.groupId || '',
            scheduleNote: s.scheduleNote || '',
            joinDate: s.joinDate.split('T')[0],
            monthlyFee: s.monthlyFee,
            debt: s.debt,
            notes: s.notes || '',
            healthNotes: s.healthNotes || '',
            behaviorNotes: s.behaviorNotes || '',
            address: s.address || '',
            school: s.school || '',
            status: s.status,
            photo: s.photo || '',
          });
          setPhotoPreview(s.photo || '');
        }
        setLoading(false);
      }
    })();
  }, [editId]);

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  function handlePhoto(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // compress
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const max = 256;
        const scale = Math.min(max / img.width, max / img.height, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL('image/jpeg', 0.7);
        setPhotoPreview(compressed);
        set('photo', compressed);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit() {
    if (!form.name.trim()) return toast.error('الاسم مطلوب');
    if (!form.parentPhone.trim()) return toast.error('رقم ولي الأمر مطلوب');

    const db = getDB();
    const now = new Date().toISOString();
    const group = groups.find(g => g.id === form.groupId) || null;

    if (editId) {
      const existing = await db.students.get(editId);
      if (!existing) return;
      const updated: Student = {
        ...existing,
        ...form,
        groupId: form.groupId || null,
        monthlyFee: Number(form.monthlyFee) || 0,
        debt: Number(form.debt) || 0,
        scheduleNote: form.scheduleNote || (group ? undefined : form.scheduleNote),
        updatedAt: now,
      };
      await db.students.put(updated);
      await logActivity('update', 'student', editId, `تعديل الطالب ${form.name}`);
      toast.success('تم تحديث البيانات');
    } else {
      const code = await generateUniqueStudentCode();
      const student: Student = {
        id: crypto.randomUUID(),
        code,
        name: form.name.trim(),
        phone: form.phone.trim(),
        parentPhone: form.parentPhone.trim(),
        parentAltPhone: form.parentAltPhone.trim() || undefined,
        grade: form.grade,
        subject: form.subject,
        academicYear: form.academicYear,
        semester: form.semester,
        groupId: form.groupId || null,
        scheduleNote: form.scheduleNote || undefined,
        joinDate: new Date(form.joinDate).toISOString(),
        monthlyFee: Number(form.monthlyFee) || 0,
        debt: Number(form.debt) || 0,
        notes: form.notes || undefined,
        healthNotes: form.healthNotes || undefined,
        behaviorNotes: form.behaviorNotes || undefined,
        address: form.address || undefined,
        school: form.school || undefined,
        photo: form.photo || undefined,
        status: form.status,
        lastAttendance: undefined,
        createdAt: now,
        updatedAt: now,
      };
      await db.students.add(student);
      await logActivity('create', 'student', student.id, `إضافة الطالب ${form.name}`);
      toast.success(`تم إضافة الطالب - الكود: ${code}`);
    }
    triggerRefresh();
    back();
  }

  if (loading) {
    return <div className="p-4 space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-12 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />)}</div>;
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in pb-32">
      {/* Photo */}
      <div className="flex flex-col items-center">
        <label className="relative cursor-pointer">
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center overflow-hidden">
            {photoPreview ? (
              <img src={photoPreview} alt="صورة الطالب" className="w-full h-full object-cover" />
            ) : (
              <Camera className="w-10 h-10 text-white" />
            )}
          </div>
          <div className="absolute -bottom-1 -left-1 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg">
            <ImageIcon className="w-4 h-4" />
          </div>
          <input type="file" accept="image/*" capture="user" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhoto(f); }} />
        </label>
      </div>

      <FieldGroup title="البيانات الأساسية" icon={<User className="w-4 h-4" />}>
        <Input label="اسم الطالب *" value={form.name} onChange={v => set('name', v)} placeholder="الاسم الكامل" />
        <div className="grid grid-cols-2 gap-2">
          <Input label="هاتف الطالب" value={form.phone} onChange={v => set('phone', v)} placeholder="01xxxxxxxxx" icon={<Phone className="w-4 h-4" />} />
          <Input label="هاتف ولي الأمر *" value={form.parentPhone} onChange={v => set('parentPhone', v)} placeholder="01xxxxxxxxx" icon={<PhoneCall className="w-4 h-4" />} />
        </div>
        <Input label="رقم بديل لولي الأمر" value={form.parentAltPhone} onChange={v => set('parentAltPhone', v)} placeholder="اختياري" />
      </FieldGroup>

      <FieldGroup title="البيانات الدراسية" icon={<GraduationCap className="w-4 h-4" />}>
        <Select label="الصف الدراسي" value={form.grade} onChange={v => set('grade', v)} options={GRADES} />
        <Select label="المادة" value={form.subject} onChange={v => set('subject', v)} options={SUBJECTS} />
        <div className="grid grid-cols-2 gap-2">
          <Input label="العام الدراسي" value={form.academicYear} onChange={v => set('academicYear', v)} />
          <Select label="الفصل الدراسي" value={form.semester} onChange={v => set('semester', v as Semester)} options={[{ value: 'first', label: 'الأول' }, { value: 'second', label: 'الثاني' }]} />
        </div>
        <Select
          label="المجموعة"
          value={form.groupId}
          onChange={v => set('groupId', v)}
          options={[{ value: '', label: 'بدون مجموعة' }, ...groups.map(g => ({ value: g.id, label: `${g.name} (${g.code})` }))]}
        />
        <Input label="ملاحظة مواعيد الحصص" value={form.scheduleNote} onChange={v => set('scheduleNote', v)} placeholder="مثال: السبت والثلاثاء 4 عصراً" />
        <Input label="تاريخ بداية التسجيل" type="date" value={form.joinDate} onChange={v => set('joinDate', v)} icon={<CalendarDays className="w-4 h-4" />} />
      </FieldGroup>

      <FieldGroup title="البيانات المالية" icon={<Wallet className="w-4 h-4" />}>
        <div className="grid grid-cols-2 gap-2">
          <Input label="الاشتراك الشهري (ج.م)" type="number" value={String(form.monthlyFee)} onChange={v => set('monthlyFee', Number(v))} />
          <Input label="المديونية الحالية (ج.م)" type="number" value={String(form.debt)} onChange={v => set('debt', Number(v))} />
        </div>
      </FieldGroup>

      <FieldGroup title="بيانات إضافية" icon={<FileText className="w-4 h-4" />}>
        <Input label="المدرسة" value={form.school} onChange={v => set('school', v)} />
        <Input label="العنوان" value={form.address} onChange={v => set('address', v)} />
        <Input label="ملاحظات صحية" value={form.healthNotes} onChange={v => set('healthNotes', v)} placeholder="مثال: حساسية من..." />
        <Input label="ملاحظات سلوكية" value={form.behaviorNotes} onChange={v => set('behaviorNotes', v)} />
        <Textarea label="ملاحظات عامة" value={form.notes} onChange={v => set('notes', v)} />
        <Select
          label="حالة الطالب"
          value={form.status}
          onChange={v => set('status', v as StudentStatus)}
          options={[
            { value: 'active', label: 'نشط' },
            { value: 'paused', label: 'متوقف' },
            { value: 'archived', label: 'مؤرشف' },
          ]}
        />
      </FieldGroup>

      {/* Save bar */}
      <div className="sticky bottom-4 z-20 mx-4 p-3 rounded-2xl glass border-2 border-slate-300 dark:border-slate-700 shadow-xl" >
        <button
          onClick={handleSubmit}
          className="w-full py-3 rounded-2xl bg-gradient-to-l from-violet-600 to-purple-700 text-white font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg"
        >
          <Save className="w-5 h-5" />
          {editId ? 'حفظ التعديلات' : 'حفظ الطالب'}
        </button>
      </div>
    </div>
  );
}

// === Form helpers ===
function FieldGroup({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-4 space-y-3">
      <div className="flex items-center gap-2 text-violet-600 font-bold">
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

function Input({
  label, value, onChange, placeholder, type = 'text', icon,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; icon?: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{label}</label>
      <div className="relative">
        {icon && <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</div>}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            'w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pr-3 pl-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all',
            icon && 'pr-10'
          )}
        />
      </div>
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
        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all resize-none"
      />
    </div>
  );
}

function Select({
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void; options: Array<string | { value: string; label: string }>;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all"
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
