// ===== English Plus - Subscriptions & Payments (v2 - complete overhaul) =====
'use client';
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/lib/store';
import { getDB, logActivity, generateInvoiceNumber } from '@/lib/db';
import type { Student, Group, Payment, PaymentMode } from '@/lib/types';
import { SearchBar, EmptyState, StatusPill } from '@/components/ui-shared';
import { formatMoney, formatArDate, formatArDateShort, arMonthName, whatsappLink, fillTemplate, WHATSAPP_TEMPLATES, paymentStatusFor, computeStudentFinancialStatus } from '@/lib/helpers';
import { getActiveDiscountPercent, calculateDiscountedFee, sendWhatsAppAutomated } from '@/lib/advanced';
import { buildStudentVariables, fillTemplateV2, WHATSAPP_TEMPLATES_V2 } from '@/lib/whatsapp-templates';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, Wallet, Search, ChevronLeft, FileDown, Send, Receipt, AlertTriangle, Check, X, Trash2, Users, CheckSquare, Square } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { generateInvoicePDF, downloadBlob } from '@/lib/documents';

export function SubscriptionsScreen() {
  const { params, navigate, settings, refreshKey, triggerRefresh } = useApp();
  const [tab, setTab] = useState<'end' | 'start' | 'bulk' | 'history'>('end');
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [paymentDialog, setPaymentDialog] = useState<{ student: Student; mode: 'full' | 'partial' | 'custom' } | null>(null);
  const [amount, setAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  // bulk selection (for bulk payment & bulk delete)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // bulk payment dialog
  const [bulkPayDialog, setBulkPayDialog] = useState(false);
  const [bulkAmount, setBulkAmount] = useState(0);
  const [bulkGroupFilter, setBulkGroupFilter] = useState<string>('');

  useEffect(() => {
    (async () => {
      const db = getDB();
      const [s, g, p] = await Promise.all([db.students.toArray(), db.groups.toArray(), db.payments.toArray()]);
      setStudents(s);
      setGroups(g);
      setPayments(p);
      setLoading(false);
    })();
  }, [refreshKey]);

  // If navigated with studentId, open payment dialog
  useEffect(() => {
    if (params.studentId) {
      const s = students.find(x => x.id === params.studentId);
      if (s) {
        setPaymentDialog({ student: s, mode: 'full' });
        setAmount(s.monthlyFee);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.studentId, students.length]);

  const filteredStudents = useMemo(() => {
    let list = students.filter(s => s.status === 'active');
    list = list.filter(s => {
      const g = groups.find(g => g.id === s.groupId);
      if (!g) return tab === 'end';
      return g.paymentMode === tab;
    });
    if (search.trim()) {
      const q = search.trim();
      list = list.filter(s => s.name.includes(q) || s.code.includes(q) || s.parentPhone.includes(q));
    }
    return list.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [students, groups, search, tab]);

  function getStudentPayments(studentId: string): Payment[] {
    return payments.filter(p => p.studentId === studentId && p.month === month && p.year === year);
  }

  function getStudentStatus(studentId: string, monthlyFee: number): 'paid' | 'partial' | 'unpaid' | 'late' {
    // v6: Use unified financial status for consistency
    const student = students.find(s => s.id === studentId);
    if (!student) return 'unpaid';
    const finStatus = computeStudentFinancialStatus(student, payments, month, year);
    if (finStatus.status === 'paid') return 'paid';
    if (finStatus.status === 'partial') return 'partial';
    return student.debt > 0 ? 'late' : 'unpaid';
  }

  const stats = useMemo(() => {
    const collected = filteredStudents.reduce((sum, s) => {
      return sum + payments.filter(p => p.studentId === s.id && p.month === month && p.year === year).reduce((a, p) => a + p.amountPaid, 0);
    }, 0);
    const expected = filteredStudents.reduce((s, st) => s + st.monthlyFee, 0);
    const outstanding = Math.max(0, expected - collected); // v5: correct outstanding
    const paidCount = filteredStudents.filter(s => {
      const sp = payments.filter(p => p.studentId === s.id && p.month === month && p.year === year);
      return sp.reduce((sum, p) => sum + p.amountPaid, 0) >= s.monthlyFee;
    }).length;
    const lateCount = filteredStudents.length - paidCount;
    const collectionRate = expected > 0 ? Math.round((collected / expected) * 100) : 0;
    const outstandingRate = expected > 0 ? Math.round((outstanding / expected) * 100) : 0;
    const studentsWithDebt = filteredStudents.filter(s => {
      const sp = payments.filter(p => p.studentId === s.id && p.month === month && p.year === year);
      const paid = sp.reduce((sum, p) => sum + p.amountPaid, 0);
      return (s.monthlyFee - paid) > 0 || s.debt > 0;
    }).length;
    return { collected, expected, outstanding, paidCount, lateCount, total: filteredStudents.length, collectionRate, outstandingRate, studentsWithDebt };
  }, [filteredStudents, payments, month, year]);

  // ===== SINGLE PAYMENT (with new logic) =====
  async function processPayment() {
    if (!paymentDialog) return;
    const { student, mode } = paymentDialog;
    if (amount <= 0) return toast.error('أدخل مبلغاً صحيحاً');

    const db = getDB();
    const existing = getStudentPayments(student.id);
    const alreadyPaid = existing.reduce((s, p) => s + p.amountPaid, 0);

    // ===== NEW LOGIC: prevent overpayment =====
    // Allow any amount but cap at remaining (with warning)
    const remaining = Math.max(0, student.monthlyFee - alreadyPaid);
    if (amount > remaining) {
      // Auto-adjust to remaining and notify
      toast.warning(`المبلغ يتجاوز المتبقي (${formatMoney(remaining)}). تم تعديله تلقائياً إلى ${formatMoney(remaining)}`);
      setAmount(remaining);
      // Continue with adjusted amount
    }

    const finalAmount = Math.min(amount, remaining);
    if (finalAmount <= 0) {
      toast.error('الطالب مسدد بالكامل لهذا الشهر');
      return;
    }

    const newRemaining = Math.max(0, student.monthlyFee - (alreadyPaid + finalAmount));
    const invoiceNo = await generateInvoiceNumber();
    const payment: Payment = {
      id: crypto.randomUUID(),
      studentId: student.id,
      amountPaid: finalAmount,
      amountRemaining: newRemaining,
      paymentDate: new Date().toISOString(),
      month, year,
      paymentMode: tab === 'end' ? 'end' : 'start',
      invoiceNumber: invoiceNo,
      notes: '',
      createdAt: new Date().toISOString(),
    };
    await db.payments.add(payment);
    // Update student debt (reduce)
    const newDebt = Math.max(0, student.debt - finalAmount);
    await db.students.update(student.id, { debt: newDebt, updatedAt: new Date().toISOString() });
    await logActivity('payment', 'payment', payment.id, `دفعة ${finalAmount} ج.م - ${student.name}`);
    // refresh
    const updated = await db.payments.toArray();
    setPayments(updated);
    const updatedStudents = await db.students.toArray();
    setStudents(updatedStudents);
    toast.success(`تم تسجيل دفعة ${formatMoney(finalAmount)}`);
    // Generate and download invoice
    const group = groups.find(g => g.id === student.groupId) || null;
    const blob = await generateInvoicePDF(student, group, payment, settings);
    downloadBlob(blob, `${invoiceNo}.pdf`);
    // Also offer whatsapp confirmation via template WT011 or WT012
    const templateId = newRemaining === 0 ? 'WT011' : 'WT012';
    const tpl = WHATSAPP_TEMPLATES_V2.find(t => t.id === templateId);
    if (tpl) {
      const vars = await buildStudentVariables(student.id, settings);
      // override with payment values
      vars['[المبلغ المدفوع]'] = String(finalAmount);
      vars['[المبلغ المتبقي]'] = String(newRemaining);
      vars['[اسم الشهر]'] = arMonthName(month);
      const { filled } = fillTemplateV2(tpl.message, vars);
      await sendWhatsAppAutomated(student.parentPhone, filled, settings);
      // log
      await db.messages.add({
        id: crypto.randomUUID(),
        studentId: student.id,
        parentPhone: student.parentPhone,
        templateType: tpl.status_key,
        messageBody: filled,
        sentAt: new Date().toISOString(),
        status: 'sent',
      });
    }
    setPaymentDialog(null);
    setAmount(0);
    triggerRefresh();
  }

  // ===== BULK PAYMENT =====
  async function processBulkPayment() {
    if (selectedIds.size === 0) return toast.error('اختر طلاباً أولاً');
    if (bulkAmount <= 0) return toast.error('أدخل مبلغاً صحيحاً');
    const db = getDB();
    let count = 0;
    let totalCollected = 0;
    for (const sid of Array.from(selectedIds)) {
      const student = students.find(s => s.id === sid);
      if (!student) continue;
      const existing = getStudentPayments(sid);
      const alreadyPaid = existing.reduce((s, p) => s + p.amountPaid, 0);
      const remaining = Math.max(0, student.monthlyFee - alreadyPaid);
      if (remaining <= 0) continue; // already paid
      const finalAmount = Math.min(bulkAmount, remaining);
      const newRemaining = Math.max(0, student.monthlyFee - (alreadyPaid + finalAmount));
      const invoiceNo = await generateInvoiceNumber();
      const payment: Payment = {
        id: crypto.randomUUID(),
        studentId: sid,
        amountPaid: finalAmount,
        amountRemaining: newRemaining,
        paymentDate: new Date().toISOString(),
        month, year,
        paymentMode: tab === 'end' ? 'end' : 'start',
        invoiceNumber: invoiceNo,
        notes: 'دفعة جماعية',
        createdAt: new Date().toISOString(),
      };
      await db.payments.add(payment);
      const newDebt = Math.max(0, student.debt - finalAmount);
      await db.students.update(sid, { debt: newDebt, updatedAt: new Date().toISOString() });
      count++;
      totalCollected += finalAmount;
    }
    await logActivity('bulk_payment', 'payment', undefined, `دفعة جماعية لـ ${count} طالب - ${totalCollected} ج.م`);
    const updated = await db.payments.toArray();
    setPayments(updated);
    const updatedStudents = await db.students.toArray();
    setStudents(updatedStudents);
    toast.success(`تم تسجيل دفعات لـ ${count} طالب - إجمالي ${formatMoney(totalCollected)}`);
    setSelectedIds(new Set());
    setBulkPayDialog(false);
    setBulkAmount(0);
    triggerRefresh();
  }

  // ===== BULK DELETE =====
  async function bulkDeletePayments() {
    if (selectedIds.size === 0) return toast.error('اختر طلاباً أولاً');
    if (!confirm(`سيتم حذف كل دفعات الشهر المحدد لـ ${selectedIds.size} طالب. متابعة؟`)) return;
    const db = getDB();
    let count = 0;
    for (const sid of Array.from(selectedIds)) {
      const studentPayments = payments.filter(p => p.studentId === sid && p.month === month && p.year === year);
      for (const p of studentPayments) {
        // Restore debt
        const student = students.find(s => s.id === sid);
        if (student) {
          await db.students.update(sid, { debt: student.debt + p.amountPaid, updatedAt: new Date().toISOString() });
        }
        await db.payments.delete(p.id);
        count++;
      }
    }
    await logActivity('bulk_delete_payments', 'payment', undefined, `حذف ${count} دفعة`);
    const updated = await db.payments.toArray();
    setPayments(updated);
    const updatedStudents = await db.students.toArray();
    setStudents(updatedStudents);
    toast.success(`تم حذف ${count} دفعة`);
    setSelectedIds(new Set());
    triggerRefresh();
  }

  function sendReminder(student: Student) {
    const t = WHATSAPP_TEMPLATES.find(t => t.key === 'payment_reminder');
    if (!t) return;
    const body = fillTemplate(t.body, {
      student_name: student.name,
      debt: student.debt,
      month: arMonthName(month),
      teacher_name: settings.teacherName,
    });
    sendWhatsAppAutomated(student.parentPhone, body, settings);
    toast.success('تم فتح واتساب');
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAllFiltered() {
    setSelectedIds(new Set(filteredStudents.map(s => s.id)));
  }

  if (loading) {
    return <div className="p-4 space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-12 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />)}</div>;
  }

  return (
    <div className="p-4 space-y-3 animate-fade-in pb-32">
      {/* v5: Financial Summary Dashboard */}
      <div className="rounded-2xl bg-gradient-to-l from-amber-600 to-orange-700 p-4 text-white shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xs opacity-80">{arMonthName(month)} {year}</div>
            <div className="font-bold">الملخص المالي</div>
          </div>
          <div className="text-left">
            <div className="text-xs opacity-80">نسبة التحصيل</div>
            <div className="font-bold text-lg">{stats.collectionRate}%</div>
          </div>
        </div>
        {/* Row 1: Expected / Collected / Outstanding */}
        <div className="grid grid-cols-3 gap-2 mb-2">
          <div className="bg-white/10 rounded-lg py-2 px-1 text-center">
            <div className="text-[10px] opacity-80">المتوقع</div>
            <div className="text-sm font-bold">{formatMoney(stats.expected)}</div>
          </div>
          <div className="bg-emerald-500/30 rounded-lg py-2 px-1 text-center">
            <div className="text-[10px] opacity-80">المحصّل</div>
            <div className="text-sm font-bold">{formatMoney(stats.collected)}</div>
          </div>
          <div className="bg-red-500/30 rounded-lg py-2 px-1 text-center">
            <div className="text-[10px] opacity-80">المتأخرات</div>
            <div className="text-sm font-bold">{formatMoney(stats.outstanding)}</div>
          </div>
        </div>
        {/* Row 2: Paid / Unpaid / With Debt */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white/10 rounded-lg py-1.5 text-center">
            <div className="text-base font-bold">{stats.paidCount}</div>
            <div className="text-[10px] opacity-80">مسدد</div>
          </div>
          <div className="bg-white/10 rounded-lg py-1.5 text-center">
            <div className="text-base font-bold">{stats.lateCount}</div>
            <div className="text-[10px] opacity-80">غير مسدد</div>
          </div>
          <div className="bg-white/10 rounded-lg py-1.5 text-center">
            <div className="text-base font-bold">{stats.studentsWithDebt}</div>
            <div className="text-[10px] opacity-80">لديهم متأخرات</div>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-2 h-2 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-400 transition-all" style={{ width: `${stats.collectionRate}%` }} />
        </div>
        <div className="flex justify-between mt-1 text-[10px] opacity-80">
          <span>تحصيل: {stats.collectionRate}%</span>
          <span>متأخرات: {stats.outstandingRate}%</span>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v as any); setSelectedIds(new Set()); }}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="end">آخر الشهر</TabsTrigger>
          <TabsTrigger value="start">أول الشهر</TabsTrigger>
          <TabsTrigger value="bulk">دفع جماعي</TabsTrigger>
          <TabsTrigger value="history">السجل</TabsTrigger>
        </TabsList>

        <TabsContent value="end" className="space-y-3 mt-3">
          <PaymentListContent
            students={filteredStudents}
            groups={groups}
            payments={payments}
            month={month} year={year}
            search={search} setSearch={setSearch}
            selectedIds={selectedIds} toggleSelect={toggleSelect} selectAll={selectAllFiltered}
            getStudentPayments={getStudentPayments}
            getStudentStatus={getStudentStatus}
            onPay={(s) => { setPaymentDialog({ student: s, mode: 'full' }); setAmount(s.monthlyFee); }}
            onRemind={sendReminder}
            onNavigate={navigate}
          />
          <BulkActionsBar
            selectedCount={selectedIds.size}
            onBulkPay={() => setBulkPayDialog(true)}
            onBulkDelete={bulkDeletePayments}
            onClear={() => setSelectedIds(new Set())}
          />
        </TabsContent>

        <TabsContent value="start" className="space-y-3 mt-3">
          <PaymentListContent
            students={filteredStudents}
            groups={groups}
            payments={payments}
            month={month} year={year}
            search={search} setSearch={setSearch}
            selectedIds={selectedIds} toggleSelect={toggleSelect} selectAll={selectAllFiltered}
            getStudentPayments={getStudentPayments}
            getStudentStatus={getStudentStatus}
            onPay={(s) => { setPaymentDialog({ student: s, mode: 'full' }); setAmount(s.monthlyFee); }}
            onRemind={sendReminder}
            onNavigate={navigate}
          />
          <BulkActionsBar
            selectedCount={selectedIds.size}
            onBulkPay={() => setBulkPayDialog(true)}
            onBulkDelete={bulkDeletePayments}
            onClear={() => setSelectedIds(new Set())}
          />
        </TabsContent>

        <TabsContent value="bulk" className="space-y-3 mt-3">
          {/* Bulk payment mode: select group → select students → enter amount */}
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-4 space-y-3">
            <div className="font-bold text-sm text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-600" /> دفع جماعي لطلاب مجموعة
            </div>
            <select
              value={bulkGroupFilter}
              onChange={(e) => setBulkGroupFilter(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-sm"
            >
              <option value="">كل المجموعات</option>
              {groups.filter(g => !g.archived).map(g => (
                <option key={g.id} value={g.id}>{g.name} - {g.grade}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const list = students.filter(s => s.status === 'active' && (!bulkGroupFilter || s.groupId === bulkGroupFilter));
                  setSelectedIds(new Set(list.map(s => s.id)));
                  toast.success(`تم تحديد ${list.length} طالب`);
                }}
                className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold"
              >
                تحديد الكل
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="flex-1 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold"
              >
                إلغاء التحديد
              </button>
            </div>
            <div className="text-xs text-slate-500">المحدد: {selectedIds.size} طالب</div>
          </div>

          {/* List of students with checkboxes */}
          <PaymentListContent
            students={students.filter(s => s.status === 'active' && (!bulkGroupFilter || s.groupId === bulkGroupFilter))}
            groups={groups}
            payments={payments}
            month={month} year={year}
            search={search} setSearch={setSearch}
            selectedIds={selectedIds} toggleSelect={toggleSelect} selectAll={selectAllFiltered}
            getStudentPayments={getStudentPayments}
            getStudentStatus={getStudentStatus}
            onPay={(s) => { setPaymentDialog({ student: s, mode: 'full' }); setAmount(s.monthlyFee); }}
            onRemind={sendReminder}
            onNavigate={navigate}
          />
          <BulkActionsBar
            selectedCount={selectedIds.size}
            onBulkPay={() => setBulkPayDialog(true)}
            onBulkDelete={bulkDeletePayments}
            onClear={() => setSelectedIds(new Set())}
          />
        </TabsContent>

        <TabsContent value="history" className="space-y-3 mt-3">
          <PaymentsHistory payments={payments} students={students} groups={groups} month={month} year={year} />
        </TabsContent>
      </Tabs>

      {/* Month/Year selectors */}
      <div className="grid grid-cols-2 gap-2">
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-sm font-bold">
          {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{arMonthName(i + 1)}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-sm font-bold">
          {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Payment Dialog - improved */}
      <Dialog open={!!paymentDialog} onOpenChange={(o) => !o && setPaymentDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تسجيل دفعة - {paymentDialog?.student.name}</DialogTitle>
          </DialogHeader>
          {paymentDialog && (
            <PaymentDialogBody
              student={paymentDialog.student}
              group={groups.find(g => g.id === paymentDialog.student.groupId) || null}
              alreadyPaid={getStudentPayments(paymentDialog.student.id).reduce((s, p) => s + p.amountPaid, 0)}
              amount={amount}
              setAmount={setAmount}
              mode={paymentDialog.mode}
              setMode={(m) => setPaymentDialog({ ...paymentDialog, mode: m })}
            />
          )}
          <DialogFooter>
            <button onClick={() => setPaymentDialog(null)} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600">إلغاء</button>
            <button onClick={processPayment} className="px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-bold flex items-center gap-1">
              <Receipt className="w-4 h-4" /> تسجيل وإصدار فاتورة
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Payment Dialog */}
      <Dialog open={bulkPayDialog} onOpenChange={setBulkPayDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>دفع جماعي لـ {selectedIds.size} طالب</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-500">سيتم تطبيق المبلغ على كل طالب. إذا تجاوز المبلغ المتبقي للطالب، سيُخصّم فقط بقدر المتبقي تلقائياً.</p>
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">المبلغ لكل طالب (ج.م)</label>
              <input
                type="number"
                value={bulkAmount || ''}
                onChange={(e) => setBulkAmount(Number(e.target.value))}
                className="w-full mt-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-3 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="مثال: 100"
                autoFocus
              />
              <div className="grid grid-cols-3 gap-2 mt-2">
                {[50, 100, 300].map(v => (
                  <button key={v} onClick={() => setBulkAmount(v)} className="py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-xs font-bold">{v} ج</button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setBulkPayDialog(false)} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600">إلغاء</button>
            <button onClick={processBulkPayment} className="px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-bold flex items-center gap-1">
              <Users className="w-4 h-4" /> تسجيل لـ {selectedIds.size} طالب
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== Payment List Content Component =====
function PaymentListContent({
  students, groups, payments, month, year, search, setSearch,
  selectedIds, toggleSelect, selectAll, getStudentPayments, getStudentStatus,
  onPay, onRemind, onNavigate,
}: any) {
  const filtered = useMemo(() => {
    let list = students;
    if (search.trim()) {
      const q = search.trim();
      list = list.filter((s: Student) => s.name.includes(q) || s.code.includes(q) || s.parentPhone.includes(q));
    }
    return list.sort((a: Student, b: Student) => a.name.localeCompare(b.name, 'ar'));
  }, [students, search]);

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="flex-1"><SearchBar value={search} onChange={setSearch} placeholder="بحث بالاسم / الكود / الهاتف" /></div>
        <button onClick={selectAll} className="px-3 py-2 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold whitespace-nowrap">
          تحديد الكل
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="لا يوجد طلاب" subtitle="في هذا النظام للشهر المحدد" icon={<Wallet className="w-10 h-10" />} />
      ) : (
        <div className="space-y-2">
          {filtered.map((s: Student) => {
            const status = getStudentStatus(s.id, s.monthlyFee);
            const sp = getStudentPayments(s.id);
            const paid = sp.reduce((sum: number, p: Payment) => sum + p.amountPaid, 0);
            const isSelected = selectedIds.has(s.id);
            return (
              <div
                key={s.id}
                className={cn(
                  'rounded-2xl border p-3 transition-all',
                  isSelected ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700' :
                  status === 'paid' ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900' :
                  status === 'partial' ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900' :
                  status === 'late' ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900' :
                  'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'
                )}
              >
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleSelect(s.id)}
                    className="w-6 h-6 flex-shrink-0 flex items-center justify-center"
                  >
                    {isSelected ? <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5 text-slate-400" />}
                  </button>
                  <button onClick={() => onNavigate('student_profile', { id: s.id })} className="flex-1 flex items-center gap-2 text-right">
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold',
                      status === 'paid' ? 'bg-emerald-500' :
                      status === 'partial' ? 'bg-amber-500' :
                      status === 'late' ? 'bg-red-500' :
                      'bg-slate-400'
                    )}>
                      {s.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">{s.name}</div>
                      <div className="text-xs text-slate-500 truncate">{s.grade} • كود: {s.code}</div>
                    </div>
                  </button>
                  <div className="text-left flex-shrink-0">
                    <div className="text-xs text-slate-500">الاشتراك</div>
                    <div className="font-bold text-sm">{formatMoney(s.monthlyFee)}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    {status === 'paid' && <StatusPill status="paid" label="مسدد" />}
                    {status === 'partial' && <StatusPill status="partial" label={`مدفوع: ${formatMoney(paid)}`} />}
                    {status === 'late' && <StatusPill status="late" label={`متأخر: ${formatMoney(s.debt)}`} />}
                    {status === 'unpaid' && <StatusPill status="unpaid" label="غير مسدد" />}
                  </div>
                  <div className="flex gap-1">
                    {status !== 'paid' && (
                      <button onClick={() => onRemind(s)} className="w-8 h-8 rounded-lg bg-green-600 text-white flex items-center justify-center" title="تذكير واتساب">
                        <Send className="w-4 h-4" />
                      </button>
                    )}
                    <button onClick={() => onPay(s)} className="px-3 h-8 rounded-lg bg-amber-600 text-white text-xs font-bold flex items-center gap-1">
                      <CreditCard className="w-3 h-3" /> دفع
                    </button>
                  </div>
                </div>
                {sp.length > 0 && (
                  <div className="mt-2 text-xs text-slate-500">
                    آخر دفعة: {formatArDateShort(sp[0].paymentDate)} - {formatMoney(sp[0].amountPaid)} ({sp[0].invoiceNumber})
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ===== Payment Dialog Body =====
function PaymentDialogBody({ student, group, alreadyPaid, amount, setAmount, mode, setMode }: {
  student: Student; group: Group | null; alreadyPaid: number; amount: number; setAmount: (n: number) => void; mode: 'full' | 'partial' | 'custom'; setMode: (m: 'full' | 'partial' | 'custom') => void;
}) {
  const remaining = Math.max(0, student.monthlyFee - alreadyPaid);
  const overpayment = amount > remaining;
  const finalAmount = Math.min(amount, remaining);

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-3 text-sm space-y-1">
        <div className="flex justify-between"><span>الاشتراك الشهري:</span><span className="font-bold">{formatMoney(student.monthlyFee)}</span></div>
        <div className="flex justify-between"><span>المدفوع هذا الشهر:</span><span className="font-bold text-emerald-600">{formatMoney(alreadyPaid)}</span></div>
        <div className="flex justify-between"><span>المتبقي:</span><span className="font-bold text-red-600">{formatMoney(remaining)}</span></div>
        <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-1"><span>المديونية الكلية:</span><span className="font-bold text-red-600">{formatMoney(student.debt)}</span></div>
        {group && <div className="flex justify-between text-xs text-slate-500"><span>المجموعة:</span><span>{group.name}</span></div>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => { setAmount(remaining); setMode('full'); }} className={cn('py-2 rounded-xl text-xs font-bold', mode === 'full' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600')}>دفع كامل ({remaining})</button>
        <button onClick={() => { setAmount(0); setMode('partial'); }} className={cn('py-2 rounded-xl text-xs font-bold', mode === 'partial' ? 'bg-amber-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600')}>دفع جزئي</button>
        <button onClick={() => { setAmount(0); setMode('custom'); }} className={cn('py-2 rounded-xl text-xs font-bold', mode === 'custom' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600')}>مبلغ مخصص</button>
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">المبلغ (ج.م)</label>
        <input
          type="number"
          value={amount || ''}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="w-full mt-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-3 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
          placeholder="0"
          autoFocus
        />
      </div>
      {/* Live calculation */}
      {amount > 0 && (
        <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-3 text-sm">
          {overpayment ? (
            <div className="text-amber-700 dark:text-amber-300 font-bold">
              ⚠️ المبلغ يتجاوز المتبقي! سيتم تعديله تلقائياً إلى {formatMoney(remaining)}
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex justify-between"><span>سيتم دفع:</span><span className="font-bold">{formatMoney(finalAmount)}</span></div>
              <div className="flex justify-between"><span>المتبقي بعد الدفع:</span><span className="font-bold text-emerald-600">{formatMoney(remaining - finalAmount)}</span></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ===== Bulk Actions Bar =====
function BulkActionsBar({ selectedCount, onBulkPay, onBulkDelete, onClear }: { selectedCount: number; onBulkPay: () => void; onBulkDelete: () => void; onClear: () => void }) {
  if (selectedCount === 0) return null;
  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-30 glass rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-2 flex items-center gap-2" style={{ maxWidth: '440px', width: '90%' }}>
      <span className="text-xs font-bold text-slate-700 dark:text-slate-200 px-2">{selectedCount} محدد</span>
      <button onClick={onBulkPay} className="flex-1 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold flex items-center justify-center gap-1">
        <Users className="w-3 h-3" /> دفع جماعي
      </button>
      <button onClick={onBulkDelete} className="px-3 py-2 rounded-xl bg-red-600 text-white text-xs font-bold flex items-center gap-1">
        <Trash2 className="w-3 h-3" /> حذف
      </button>
      <button onClick={onClear} className="px-2 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold">
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

// ===== Payments History =====
function PaymentsHistory({ payments, students, groups, month, year }: { payments: Payment[]; students: Student[]; groups: Group[]; month: number; year: number }) {
  const monthPayments = payments.filter(p => p.month === month && p.year === year).sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
  if (monthPayments.length === 0) return <EmptyState title="لا يوجد مدفوعات" subtitle={`في ${arMonthName(month)} ${year}`} icon={<Wallet className="w-10 h-10" />} />;
  return (
    <div className="space-y-2">
      {monthPayments.map(p => {
        const s = students.find(s => s.id === p.studentId);
        const g = s ? groups.find(g => g.id === s.groupId) : null;
        return (
          <div key={p.id} className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-sm text-slate-800 dark:text-slate-100">{s?.name || '—'}</div>
                <div className="text-xs text-slate-500">{formatArDateShort(p.paymentDate)} • {p.invoiceNumber}</div>
                <div className="text-[10px] text-slate-400">{g?.name || '—'}</div>
              </div>
              <div className="text-left">
                <div className="font-bold text-emerald-600">{formatMoney(p.amountPaid)}</div>
                {p.amountRemaining > 0 && <div className="text-[10px] text-red-500">متبقي: {formatMoney(p.amountRemaining)}</div>}
                {p.amountRemaining === 0 && <div className="text-[10px] text-emerald-600">مسدد كامل</div>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
