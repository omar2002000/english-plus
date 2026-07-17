// ===== English Plus - Settings Screen =====
'use client';
import { useState, useEffect } from 'react';
import { useApp } from '@/lib/store';
import { getDB, exportBackup, importBackup, clearAllData, logActivity, DEFAULT_SETTINGS } from '@/lib/db';
import type { Settings as SettingsType } from '@/lib/types';
import { formatArDate } from '@/lib/helpers';
import { downloadBlob } from '@/lib/documents';
import { toast } from 'sonner';
import {
  User, Phone, Palette, Shield, Database, Moon, Sun, Lock, Upload, Download,
  Trash2, Bell, BookOpen, Save, ChevronLeft, FileDown, AlertTriangle,
  Mic, Sparkles, MessageCircle, CalendarDays, X, Check, Award, Gift, Trophy, Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { requestNotificationPermission } from '@/lib/advanced';

export function SettingsScreen() {
  const { settings, setSettings, navigate, triggerRefresh } = useApp();
  const [local, setLocal] = useState<SettingsType>(settings);
  const [confirmClear, setConfirmClear] = useState(false);
  const [lastBackup, setLastBackup] = useState<string>('');

  // Sync external settings to local state when settings change
  const settingsKey = JSON.stringify(settings);
  useEffect(() => {
    setLocal(settings);
    const stored = localStorage.getItem('english_plus_last_backup');
    if (stored) setLastBackup(stored);
  }, [settingsKey]);

  function update<K extends keyof SettingsType>(key: K, value: SettingsType[K]) {
    setLocal(prev => ({ ...prev, [key]: value }));
  }

  function save() {
    setSettings(local);
    toast.success('تم حفظ الإعدادات');
  }

  async function handleBackup() {
    try {
      const json = await exportBackup();
      const blob = new Blob([json], { type: 'application/json' });
      downloadBlob(blob, `english-plus-backup-${new Date().toISOString().split('T')[0]}.json`);
      const now = new Date().toISOString();
      localStorage.setItem('english_plus_last_backup', now);
      setLastBackup(now);
      toast.success('تم إنشاء نسخة احتياطية');
    } catch (e) {
      console.error(e);
      toast.error('فشل النسخ الاحتياطي');
    }
  }

  async function handleRestore(file: File) {
    try {
      const text = await file.text();
      await importBackup(text);
      toast.success('تمت الاستعادة بنجاح');
      triggerRefresh();
      // reload settings
      window.location.reload();
    } catch (e) {
      console.error(e);
      toast.error('فشل الاستعادة - ملف غير صالح');
    }
  }

  async function handleClear() {
    await clearAllData();
    await logActivity('clear_data', 'system');
    setConfirmClear(false);
    toast.success('تم مسح كل البيانات');
    setTimeout(() => window.location.reload(), 1000);
  }

  return (
    <div className="p-4 space-y-3 animate-fade-in pb-32">
      {/* Teacher info */}
      <Section title="بيانات المدرس" icon={<User className="w-4 h-4" />}>
        <Field label="اسم المدرس">
          <input value={local.teacherName} onChange={e => update('teacherName', e.target.value)} className="setting-input" />
        </Field>
        <Field label="رقم الهاتف">
          <input value={local.teacherPhone} onChange={e => update('teacherPhone', e.target.value)} className="setting-input" />
        </Field>
        <Field label="اسم التطبيق">
          <input value={local.appName} onChange={e => update('appName', e.target.value)} className="setting-input" />
        </Field>
      </Section>

      {/* Policies */}
      <Section title="سياسات التقييم والغياب" icon={<BookOpen className="w-4 h-4" />}>
        <Field label="سياسة غياب الطالب">
          <select value={local.absentScorePolicy} onChange={e => update('absentScorePolicy', e.target.value as 'zero' | 'unevaluated')} className="setting-input">
            <option value="zero">درجات = صفر</option>
            <option value="unevaluated">غير مُقيّم</option>
          </select>
        </Field>
        <Field label="الفصل الدراسي الافتراضي">
          <select value={local.semesterDefault} onChange={e => update('semesterDefault', e.target.value as 'first' | 'second')} className="setting-input">
            <option value="first">الأول</option>
            <option value="second">الثاني</option>
          </select>
        </Field>
        <Field label="الاشتراك الشهري الافتراضي">
          <input type="number" value={local.defaultMonthlyFee} onChange={e => update('defaultMonthlyFee', Number(e.target.value))} className="setting-input" />
        </Field>
      </Section>

      {/* Appearance */}
      <Section title="المظهر" icon={<Palette className="w-4 h-4" />}>
        <ToggleRow
          label="الوضع الليلي"
          icon={local.darkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          value={local.darkMode}
          onChange={(v) => {
            update('darkMode', v);
            setSettings({ ...local, darkMode: v });
          }}
        />
        <ToggleRow
          label="الأرقام العربية (١٢٣)"
          icon={<span className="text-xs font-bold">١٢٣</span>}
          value={local.arabicNumerals}
          onChange={(v) => update('arabicNumerals', v)}
        />
        <ToggleRow
          label="أصوات الإشعارات"
          icon={<Bell className="w-4 h-4" />}
          value={local.notificationSound}
          onChange={(v) => update('notificationSound', v)}
        />
        <ToggleRow
          label="تقرير تلقائي بعد كل حصة"
          icon={<FileDown className="w-4 h-4" />}
          value={local.autoDailyReport}
          onChange={(v) => update('autoDailyReport', v)}
        />
        <ToggleRow
          label="التوصيات الذكية اليومية"
          icon={<Sparkles className="w-4 h-4" />}
          value={local.smartRecommendationsEnabled}
          onChange={(v) => update('smartRecommendationsEnabled', v)}
        />
      </Section>

      {/* Smart Notifications */}
      <Section title="الإشعارات الذكية" icon={<Bell className="w-4 h-4" />}>
        <ToggleRow
          label="تفعيل الإشعارات الذكية"
          icon={<Bell className="w-4 h-4" />}
          value={local.smartNotificationsEnabled}
          onChange={async (v) => {
            update('smartNotificationsEnabled', v);
            if (v) {
              const granted = await requestNotificationPermission();
              if (!granted) toast.error('يجب السماح بالإشعارات من المتصفح');
            }
          }}
        />
        {local.smartNotificationsEnabled && (
          <>
            <Field label={`تذكير قبل الحصة بـ (${local.notifyBeforeLessonMinutes} دقيقة)`}>
              <input
                type="range" min="5" max="120" step="5"
                value={local.notifyBeforeLessonMinutes}
                onChange={(e) => update('notifyBeforeLessonMinutes', Number(e.target.value))}
                className="w-full"
              />
            </Field>
            <ToggleRow
              label="تذكير أولياء الأمور قبل الحصة"
              icon={<Bell className="w-4 h-4" />}
              value={local.notifyParentBeforeLesson}
              onChange={(v) => update('notifyParentBeforeLesson', v)}
            />
          </>
        )}
      </Section>

      {/* Voice Control */}
      <Section title="التحكم الصوتي" icon={<Mic className="w-4 h-4" />}>
        <ToggleRow
          label="تفعيل التحكم الصوتي"
          icon={<Mic className="w-4 h-4" />}
          value={local.voiceControlEnabled}
          onChange={(v) => {
            update('voiceControlEnabled', v);
            if (v) toast.info('سيظهر زر الميكروفون أعلى الشاشة');
          }}
        />
        {local.voiceControlEnabled && (
          <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-900/50 rounded-lg p-2">
            💡 الأوامر المدعومة: "سجّل حضور أحمد"، "أعطِ أحمد 10"، "احفظ الحصة"، "التالي"، "افتح الماسح"
          </div>
        )}
      </Section>

      {/* AR Cards */}
      <Section title="الواقع المعزز" icon={<Sparkles className="w-4 h-4" />}>
        <ToggleRow
          label="تفعيل AR للبطاقات"
          icon={<Sparkles className="w-4 h-4" />}
          value={local.arCardsEnabled}
          onChange={(v) => {
            update('arCardsEnabled', v);
            if (v) toast.info('عند مسح بطاقة الطالب، ستظهر بياناته فوق البطاقة');
          }}
        />
        {local.arCardsEnabled && (
          <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-900/50 rounded-lg p-2">
            📷 عند تفعيل الماسح الضوئي مع AR، سيتم عرض إحصائيات الطالب فوق البطاقة مباشرة
          </div>
        )}
      </Section>

      {/* WhatsApp Business API */}
      <Section title="WhatsApp Business API" icon={<MessageCircle className="w-4 h-4" />}>
        <ToggleRow
          label="تفعيل الإرسال التلقائي"
          icon={<MessageCircle className="w-4 h-4" />}
          value={local.whatsappApiEnabled}
          onChange={(v) => update('whatsappApiEnabled', v)}
        />
        {local.whatsappApiEnabled && (
          <>
            <Field label="WhatsApp Access Token">
              <input value={local.whatsappApiToken} onChange={e => update('whatsappApiToken', e.target.value)} className="setting-input" placeholder="EAAG..." type="password" />
            </Field>
            <Field label="Phone Number ID">
              <input value={local.whatsappApiPhoneId} onChange={e => update('whatsappApiPhoneId', e.target.value)} className="setting-input" placeholder="123456789" />
            </Field>
            <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-900/50 rounded-lg p-2">
              💡 احصل على هذه البيانات من <a href="https://developers.facebook.com/apps" target="_blank" className="text-blue-600 underline">Meta for Developers</a> — عند التفعيل، يتم الإرسال تلقائياً بدون فتح واتساب
            </div>
            <div className="space-y-1.5 mt-2">
              <div className="text-xs font-bold text-slate-600 dark:text-slate-300">الرسائل التلقائية:</div>
              <ToggleRow label="📅 تذكير قبل الحصة" icon={<CalendarDays className="w-3 h-3" />} value={local.whatsappAutoMessages.beforeLesson} onChange={v => update('whatsappAutoMessages', { ...local.whatsappAutoMessages, beforeLesson: v })} />
              <ToggleRow label="❌ إشعار غياب فوري" icon={<X className="w-3 h-3" />} value={local.whatsappAutoMessages.absenceAlert} onChange={v => update('whatsappAutoMessages', { ...local.whatsappAutoMessages, absenceAlert: v })} />
              <ToggleRow label="💰 تذكير دفع" icon={<Wallet className="w-3 h-3" />} value={local.whatsappAutoMessages.paymentReminder} onChange={v => update('whatsappAutoMessages', { ...local.whatsappAutoMessages, paymentReminder: v })} />
              <ToggleRow label="✅ تأكيد دفع" icon={<Check className="w-3 h-3" />} value={local.whatsappAutoMessages.paymentConfirm} onChange={v => update('whatsappAutoMessages', { ...local.whatsappAutoMessages, paymentConfirm: v })} />
              <ToggleRow label="🎓 شهادة شهرية" icon={<Award className="w-3 h-3" />} value={local.whatsappAutoMessages.monthlyCertificate} onChange={v => update('whatsappAutoMessages', { ...local.whatsappAutoMessages, monthlyCertificate: v })} />
              <ToggleRow label="🎂 تهنئة عيد ميلاد" icon={<Gift className="w-3 h-3" />} value={local.whatsappAutoMessages.birthday} onChange={v => update('whatsappAutoMessages', { ...local.whatsappAutoMessages, birthday: v })} />
              <ToggleRow label="🏆 تهنئة بالتصدّر" icon={<Trophy className="w-3 h-3" />} value={local.whatsappAutoMessages.topStudent} onChange={v => update('whatsappAutoMessages', { ...local.whatsappAutoMessages, topStudent: v })} />
            </div>
          </>
        )}
      </Section>

      {/* Cloud Sync section removed in v3 - replaced with auto weekly backup (manual JSON export/import) */}
      {/* The app is fully offline-first; backups are manual JSON files */}


      {/* Security - v3 with PIN security */}
      <Section title="الأمان والقفل" icon={<Shield className="w-4 h-4" />}>
        <ToggleRow
          label="تفعيل قفل التطبيق"
          icon={<Lock className="w-4 h-4" />}
          value={local.appLockEnabled}
          onChange={(v) => update('appLockEnabled', v)}
        />
        {local.appLockEnabled && (
          <>
            <Field label="الرقم السري (4 أرقام)">
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={local.pin}
                onChange={e => {
                  const newPin = e.target.value.replace(/\D/g, '').slice(0, 4);
                  update('pin', newPin);
                  // Mark as changed if it's not the default
                  if (newPin !== '1234') update('pinChangedFromDefault', true);
                }}
                className="setting-input tracking-widest text-center"
              />
            </Field>
            {local.pin === '1234' && (
              <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">تحذير أمني</div>
                  <div>الرقم السري الافتراضي 1234 غير آمن. سيُطلب منك تغييره عند أول تشغيل بعد تفعيل القفل.</div>
                </div>
              </div>
            )}
            <Field label="قفل تلقائي بعد (دقيقة)">
              <input type="number" value={local.autoLockMinutes} onChange={e => update('autoLockMinutes', Number(e.target.value))} className="setting-input" />
            </Field>
            <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-900/50 rounded-lg p-2">
              🔒 <strong>حماية المحاولات:</strong> بعد 5 محاولات فاشلة، يُقفل التطبيق لمدة 5 دقائق تلقائياً
            </div>
          </>
        )}
      </Section>

      {/* Data management - v3 with auto weekly backup */}
      <Section title="النسخ الاحتياطي والبيانات" icon={<Database className="w-4 h-4" />}>
        {/* v3: Auto weekly backup toggle */}
        <ToggleRow
          label="نسخ احتياطي تلقائي أسبوعياً"
          icon={<CalendarDays className="w-4 h-4" />}
          value={local.autoWeeklyBackup}
          onChange={(v) => update('autoWeeklyBackup', v)}
        />
        {local.autoWeeklyBackup && (
          <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-900/50 rounded-lg p-2">
            📅 سيتم تصدير نسخة احتياطية تلقائياً كل أسبوع إلى مجلد التنزيلات
            {local.lastAutoBackupDate && (
              <div className="mt-1">آخر نسخة تلقائية: {formatArDate(local.lastAutoBackupDate)}</div>
            )}
          </div>
        )}
        {lastBackup && (
          <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-900/50 rounded-lg p-2">
            آخر نسخة يدوية: {formatArDate(lastBackup)}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={handleBackup} className="py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-95">
            <Download className="w-4 h-4" /> نسخة احتياطية يدوية
          </button>
          <label className="py-3 rounded-xl bg-blue-600 text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-95 cursor-pointer">
            <Upload className="w-4 h-4" /> استعادة من ملف
            <input type="file" accept=".json" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleRestore(f); e.currentTarget.value = ''; }} />
          </label>
        </div>

        {/* v3: Add demo data manually (since auto-seed is disabled) */}
        <button
          onClick={async () => {
            if (!confirm('سيتم إضافة بيانات تجريبية (3 مجموعات + 8 طلاب). متابعة؟')) return;
            const { addDemoDataManually } = await import('@/lib/db');
            await addDemoDataManually();
            toast.success('تمت إضافة البيانات التجريبية');
            triggerRefresh();
          }}
          className="w-full py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-2 active:scale-95"
        >
          <Database className="w-3 h-3" /> إضافة بيانات تجريبية (اختياري)
        </button>

        <button onClick={() => setConfirmClear(true)} className="w-full py-3 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-600 text-sm font-bold flex items-center justify-center gap-2 active:scale-95">
          <Trash2 className="w-4 h-4" /> مسح كل البيانات
        </button>
      </Section>

      {/* Quick links */}
      <Section title="روابط سريعة" icon={<ChevronLeft className="w-4 h-4" />}>
        <button onClick={() => navigate('archive')} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 text-right flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">أرشيف الطلاب</span>
          <ChevronLeft className="w-4 h-4 text-slate-400" />
        </button>
        <button onClick={() => navigate('reports')} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 text-right flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">التقارير</span>
          <ChevronLeft className="w-4 h-4 text-slate-400" />
        </button>
        <button onClick={() => navigate('whatsapp')} className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 text-right flex items-center justify-between hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">مركز الواتساب</span>
          <ChevronLeft className="w-4 h-4 text-slate-400" />
        </button>
      </Section>

      {/* Save bar */}
      <div className="fixed bottom-0 left-0 right-0 z-20 p-3 glass border-t border-slate-200 dark:border-slate-700 safe-bottom" style={{ maxWidth: '480px', margin: '0 auto' }}>
        <button onClick={save} className="w-full py-3 rounded-2xl bg-gradient-to-l from-slate-700 to-slate-900 text-white font-bold flex items-center justify-center gap-2 active:scale-95">
          <Save className="w-5 h-5" /> حفظ الإعدادات
        </button>
      </div>

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" /> تأكيد مسح البيانات
            </AlertDialogTitle>
            <AlertDialogDescription>
              سيتم مسح كل الطلاب والمجموعات والحضور والمدفوعات نهائياً. ينصح بأخذ نسخة احتياطية أولاً. لا يمكن التراجع!
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleClear} className="bg-red-600 hover:bg-red-700">مسح نهائي</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <style jsx>{`
        :global(.setting-input) {
          width: 100%;
          background: rgb(248 250 252);
          border: 1px solid rgb(226 232 240);
          border-radius: 0.75rem;
          padding: 0.625rem 0.75rem;
          font-size: 0.875rem;
          outline: none;
        }
        :global(.dark .setting-input) {
          background: rgb(15 23 42);
          border-color: rgb(51 65 85);
        }
      `}</style>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-4 space-y-3">
      <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-bold">
        {icon}
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">{label}</label>
      {children}
    </div>
  );
}

function ToggleRow({ label, icon, value, onChange }: { label: string; icon: React.ReactNode; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-slate-500">{icon}</span>
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</span>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={cn(
          'w-12 h-6 rounded-full transition-colors relative',
          value ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
        )}
      >
        <span className={cn(
          'absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
          value ? 'right-0.5' : 'right-6'
        )} />
      </button>
    </div>
  );
}
