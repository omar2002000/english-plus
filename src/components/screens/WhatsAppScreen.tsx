// ===== English Plus - WhatsApp Center (v2 - 35 templates with real data) =====
'use client';
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/lib/store';
import { getDB, logActivity } from '@/lib/db';
import type { Student, Group, MessageLog } from '@/lib/types';
import { WHATSAPP_TEMPLATES_V2, WHATSAPP_CATEGORIES, buildStudentVariables, fillTemplateV2, type WhatsappTemplateV2 } from '@/lib/whatsapp-templates';
import { whatsappLink, formatArDateShort } from '@/lib/helpers';
import { sendWhatsAppAutomated } from '@/lib/advanced';
import { SearchBar, EmptyState } from '@/components/ui-shared';
import { Search, Send, MessageCircle, History, Users, ChevronLeft, Eye, AlertCircle, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function WhatsAppScreen() {
  const { settings, refreshKey, triggerRefresh, navigate } = useApp();
  const [tab, setTab] = useState<'templates' | 'bulk' | 'history'>('templates');
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [messages, setMessages] = useState<MessageLog[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('الكل');
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('WT001');
  const [customMessage, setCustomMessage] = useState('');
  const [bulkGroupFilter, setBulkGroupFilter] = useState<string>('');
  const [previewMessage, setPreviewMessage] = useState('');
  const [missingVars, setMissingVars] = useState<string[]>([]);
  const [studentVars, setStudentVars] = useState<Record<string, string>>({});
  const [bulkSelection, setBulkSelection] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const db = getDB();
      const [s, g, m] = await Promise.all([db.students.toArray(), db.groups.toArray(), db.messages.toArray()]);
      setStudents(s.filter(st => st.status === 'active'));
      setGroups(g);
      setMessages(m.sort((a, b) => b.sentAt.localeCompare(a.sentAt)));
    })();
  }, [refreshKey]);

  const filteredStudents = useMemo(() => {
    if (!search.trim()) return students;
    const q = search.trim();
    return students.filter(s => s.name.includes(q) || s.code.includes(q) || s.parentPhone.includes(q));
  }, [students, search]);

  const filteredTemplates = useMemo(() => {
    let list = WHATSAPP_TEMPLATES_V2.filter(t => t.active);
    if (categoryFilter !== 'الكل') list = list.filter(t => t.category === categoryFilter);
    if (search.trim()) {
      const q = search.trim();
      list = list.filter(t => t.name.includes(q) || t.message.includes(q) || t.category.includes(q));
    }
    return list;
  }, [categoryFilter, search]);

  // Build preview whenever student or template changes
  useEffect(() => {
    (async () => {
      const tpl = WHATSAPP_TEMPLATES_V2.find(t => t.id === selectedTemplate);
      if (!tpl) return;
      if (selectedStudent) {
        const vars = await buildStudentVariables(selectedStudent, settings);
        setStudentVars(vars);
        const { filled, missing } = fillTemplateV2(tpl.message, vars);
        setPreviewMessage(filled);
        setMissingVars(missing);
      } else {
        setPreviewMessage(tpl.message);
        setMissingVars([]);
        setStudentVars({});
      }
    })();
  }, [selectedStudent, selectedTemplate, settings]);

  async function sendSingle(studentId: string, templateId: string) {
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    const tpl = WHATSAPP_TEMPLATES_V2.find(t => t.id === templateId);
    if (!tpl) return;
    // Check missing vars
    if (missingVars.length > 0) {
      const proceed = confirm(`بعض البيانات ناقصة: ${missingVars.join('، ')}\nسيتم إرسال الرسالة كما هي. هل تريد المتابعة؟`);
      if (!proceed) return;
    }
    const vars = await buildStudentVariables(studentId, settings);
    const { filled } = fillTemplateV2(tpl.message, vars);
    // Send via API or deep link
    const result = await sendWhatsAppAutomated(student.parentPhone, filled, settings);
    // Log
    const db = getDB();
    const log: MessageLog = {
      id: crypto.randomUUID(),
      studentId: student.id,
      parentPhone: student.parentPhone,
      templateType: tpl.status_key,
      messageBody: filled,
      sentAt: new Date().toISOString(),
      status: result.success ? 'sent' : 'failed',
    };
    await db.messages.add(log);
    await logActivity('send_message', 'student', student.id, `قالب: ${tpl.name}`);
    setMessages(prev => [log, ...prev]);
    toast.success(result.via === 'api' ? `تم الإرسال تلقائياً لـ ${student.name}` : `تم فتح واتساب لـ ${student.name}`);
  }

  async function sendBulk() {
    if (bulkSelection.size === 0) return toast.error('اختر طلاباً أولاً');
    const tpl = WHATSAPP_TEMPLATES_V2.find(t => t.id === selectedTemplate);
    let sentCount = 0;
    let failedCount = 0;
    const total = bulkSelection.size;
    toast.info(`جاري إرسال ${total} رسالة متتالية...`);

    for (const sid of Array.from(bulkSelection)) {
      const student = students.find(s => s.id === sid);
      if (!student) continue;

      // Build message with real student data
      let body: string;
      if (tpl) {
        const vars = await buildStudentVariables(sid, settings);
        const { filled } = fillTemplateV2(tpl.message, vars);
        body = filled;
      } else {
        // Custom message
        body = customMessage || '';
        const vars = await buildStudentVariables(sid, settings);
        body = fillTemplateV2(body, vars).filled;
      }

      // Send via wa.me link (opens sequentially)
      const result = await sendWhatsAppAutomated(student.parentPhone, body, settings);

      // Log message
      const db = getDB();
      await db.messages.add({
        id: crypto.randomUUID(),
        studentId: sid,
        parentPhone: student.parentPhone,
        templateType: tpl?.status_key || 'custom',
        messageBody: body,
        sentAt: new Date().toISOString(),
        status: result.success ? 'sent' : 'failed',
      });

      if (result.success) sentCount++;
      else failedCount++;

      // Sequential delay between sends
      await new Promise(r => setTimeout(r, 1500));
    }

    toast.success(`تم إرسال ${sentCount} رسالة بنجاح${failedCount > 0 ? ` (${failedCount} فشل)` : ''}`);
    setBulkSelection(new Set());
    // refresh messages
    const db = getDB();
    const m = await db.messages.toArray();
    setMessages(m.sort((a, b) => b.sentAt.localeCompare(a.sentAt)));
    triggerRefresh();
  }

  const template = WHATSAPP_TEMPLATES_V2.find(t => t.id === selectedTemplate);

  return (
    <div className="p-4 space-y-3 animate-fade-in pb-32">
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'templates' | 'bulk' | 'history')}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="templates">قالب فردي</TabsTrigger>
          <TabsTrigger value="bulk">إرسال جماعي</TabsTrigger>
          <TabsTrigger value="history">السجل ({messages.length})</TabsTrigger>
        </TabsList>

      <TabsContent value="templates" className="space-y-3 mt-3">
        {/* Search */}
        <SearchBar value={search} onChange={setSearch} placeholder="بحث في القوالب..." />

        {/* Category filter */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
          <button
            onClick={() => setCategoryFilter('الكل')}
            className={cn('px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap', categoryFilter === 'الكل' ? 'bg-green-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600')}
          >
            الكل ({WHATSAPP_TEMPLATES_V2.length})
          </button>
          {WHATSAPP_CATEGORIES.map(cat => {
            const count = WHATSAPP_TEMPLATES_V2.filter(t => t.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={cn('px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap', categoryFilter === cat ? 'bg-green-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600')}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>

        {/* Template grid */}
        <div className="grid grid-cols-1 gap-2">
          {filteredTemplates.map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedTemplate(t.id)}
              className={cn(
                'p-3 rounded-2xl border text-right transition-all',
                selectedTemplate === t.id
                  ? 'bg-green-50 dark:bg-green-950/30 border-green-500 shadow-md'
                  : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-green-300'
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="font-bold text-sm text-slate-800 dark:text-slate-100">{t.name}</div>
                <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-bold',
                  t.tone === 'إيجابي' ? 'bg-emerald-100 text-emerald-700' :
                  t.tone === 'تنبيهي' ? 'bg-amber-100 text-amber-700' :
                  t.tone === 'سريع' ? 'bg-blue-100 text-blue-700' :
                  'bg-slate-100 text-slate-600'
                )}>{t.tone}</span>
              </div>
              <div className="text-[10px] text-slate-500">{t.id} • {t.category}</div>
              <div className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">{t.short_message}</div>
              {/* Variables */}
              <div className="flex flex-wrap gap-1 mt-2">
                {t.variables.slice(0, 4).map(v => (
                  <span key={v} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500">{v}</span>
                ))}
                {t.variables.length > 4 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500">+{t.variables.length - 4}</span>}
              </div>
            </button>
          ))}
        </div>

        {/* Student selection */}
        <div>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-1 block">اختر الطالب (لربط البيانات)</label>
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث عن طالب..."
              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pr-10 pl-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto">
            {filteredStudents.slice(0, 20).map(s => (
              <button
                key={s.id}
                onClick={() => { setSelectedStudent(s.id); setSearch(''); }}
                className={cn(
                  'w-full flex items-center gap-2 p-2 rounded-lg text-right transition-all',
                  selectedStudent === s.id ? 'bg-green-100 dark:bg-green-900/30 border border-green-500' : 'bg-slate-50 dark:bg-slate-900/50'
                )}
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-600 to-emerald-700 flex items-center justify-center text-white text-xs font-bold">
                  {s.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{s.name}</div>
                  <div className="text-[10px] text-slate-500">{s.grade} • {s.parentPhone}</div>
                </div>
                {selectedStudent === s.id && <div className="w-2 h-2 rounded-full bg-green-500" />}
              </button>
            ))}
          </div>
        </div>

        {/* Preview with real data */}
        {template && (
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="w-4 h-4 text-green-600" />
              <div className="text-xs font-bold text-slate-600 dark:text-slate-300">معاينة الرسالة</div>
              {selectedStudent ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 mr-auto">مرتبطة ببيانات الطالب ✓</span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 mr-auto">قالب عام - اختر طالباً</span>
              )}
            </div>
            <pre className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap font-sans bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 leading-relaxed max-h-60 overflow-y-auto">{previewMessage}</pre>
            {missingVars.length > 0 && selectedStudent && (
              <div className="mt-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-700 dark:text-amber-300">
                  <div className="font-bold">بيانات ناقصة:</div>
                  <div>{missingVars.join('، ')}</div>
                  <div className="mt-1 text-[10px]">سيظهر النص كما هو عند الإرسال أو يمكنك اختيار قالب آخر</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Send button */}
        <button
          onClick={() => selectedStudent && sendSingle(selectedStudent, selectedTemplate)}
          disabled={!selectedStudent}
          className="w-full py-3 rounded-2xl bg-gradient-to-l from-green-700 to-emerald-800 text-white font-bold flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
        >
          <Send className="w-5 h-5" /> إرسال {selectedStudent ? `لـ ${students.find(s => s.id === selectedStudent)?.name}` : '(اختر طالباً)'}
        </button>
      </TabsContent>

      <TabsContent value="bulk" className="space-y-3 mt-3">
        {/* Group filter */}
        <select
          value={bulkGroupFilter}
          onChange={(e) => setBulkGroupFilter(e.target.value)}
          className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-sm font-bold"
        >
          <option value="">كل المجموعات</option>
          {groups.filter(g => !g.archived).map(g => (
            <option key={g.id} value={g.id}>{g.name} - {g.grade}</option>
          ))}
        </select>

        {/* Template or custom message toggle */}
        <div className="flex gap-2">
          <button onClick={() => { setSelectedTemplate('WT001'); setCustomMessage(''); }} className={cn('flex-1 py-2 rounded-xl text-xs font-bold', !customMessage ? 'bg-green-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600')}>قالب جاهز</button>
          <button onClick={() => { setCustomMessage('السيد ولي أمر / [اسم الطالب]\n'); setSelectedTemplate(''); }} className={cn('flex-1 py-2 rounded-xl text-xs font-bold', customMessage ? 'bg-green-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600')}>رسالة مخصصة</button>
        </div>

        {/* Template selection or custom message editor */}
        {!customMessage ? (
          <select
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-sm font-bold"
          >
            {WHATSAPP_CATEGORIES.map(cat => (
              <optgroup key={cat} label={cat}>
                {WHATSAPP_TEMPLATES_V2.filter(t => t.category === cat).map(t => (
                  <option key={t.id} value={t.id}>{t.id} - {t.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        ) : (
          <textarea
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            rows={4}
            placeholder="اكتب رسالتك هنا... (يمكن استخدام [اسم الطالب] [المبلغ] [اسم الشهر] وغيرها)"
            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
          />
        )}

        <div className="flex items-center justify-between">
          <SearchBar value={search} onChange={setSearch} placeholder="بحث" />
          <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mr-2">{bulkSelection.size} مُحدد</div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              const list = students.filter(s => s.status === 'active' && (!bulkGroupFilter || s.groupId === bulkGroupFilter));
              setBulkSelection(new Set(list.map(s => s.id)));
              toast.success(`تم تحديد ${list.length} طالب`);
            }}
            className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold"
          >
            تحديد الكل
          </button>
          <button
            onClick={() => setBulkSelection(new Set())}
            className="flex-1 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold"
          >
            إلغاء التحديد
          </button>
        </div>

        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {filteredStudents.filter(s => !bulkGroupFilter || s.groupId === bulkGroupFilter).map(s => (
            <label key={s.id} className={cn('flex items-center gap-2 p-2 rounded-lg cursor-pointer', bulkSelection.has(s.id) ? 'bg-green-50 dark:bg-green-950/30' : 'bg-slate-50 dark:bg-slate-900/50')}>
              <input type="checkbox" checked={bulkSelection.has(s.id)} onChange={(e) => {
                setBulkSelection(prev => { const next = new Set(prev); if (e.target.checked) next.add(s.id); else next.delete(s.id); return next; });
              }} className="w-4 h-4" />
              <div className="flex-1 text-sm">
                <div className="font-bold text-slate-800 dark:text-slate-100">{s.name}</div>
                <div className="text-[10px] text-slate-500">{s.grade} • {s.parentPhone}{s.debt > 0 && ` • دين: ${s.debt}`}</div>
              </div>
            </label>
          ))}
        </div>

        <button onClick={sendBulk} className="w-full py-3 rounded-2xl bg-gradient-to-l from-green-700 to-emerald-800 text-white font-bold flex items-center justify-center gap-2 active:scale-95">
          <Send className="w-5 h-5" /> إرسال لـ {bulkSelection.size} طالب
        </button>
      </TabsContent>

      <TabsContent value="history" className="space-y-3 mt-3">
        {messages.length === 0 ? (
          <EmptyState title="لا يوجد سجل رسائل" subtitle="الرسائل المُرسلة ستظهر هنا" icon={<History className="w-10 h-10" />} />
        ) : (
          <div className="space-y-2">
            {messages.map(m => {
              const s = students.find(s => s.id === m.studentId);
              const t = WHATSAPP_TEMPLATES_V2.find(t => t.status_key === m.templateType);
              return (
                <button
                  key={m.id}
                  onClick={() => s && navigate('student_profile', { id: s.id })}
                  className="w-full p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-right"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-700 dark:text-green-300">
                        <MessageCircle className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-800 dark:text-slate-100">{s?.name || '—'}</div>
                        <div className="text-[10px] text-slate-500">{t?.name || m.templateType}</div>
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="text-[10px] text-slate-400">{formatArDateShort(m.sentAt)}</div>
                      <div className={cn('text-[10px] font-bold', m.status === 'sent' ? 'text-emerald-600' : 'text-red-600')}>{m.status === 'sent' ? '✓ مُرسل' : '✗ فشل'}</div>
                    </div>
                  </div>
                  <div className="mt-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50 text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{m.messageBody}</div>
                </button>
              );
            })}
          </div>
        )}
      </TabsContent>
      </Tabs>
    </div>
  );
}
