// ===== English Plus - Top Bar =====
'use client';
import { useApp, type ScreenKey } from '@/lib/store';
import { ArrowRight, Bell, Settings, ChevronRight, Search, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';

const TITLES: Record<ScreenKey, string> = {
  dashboard: 'لوحة التحكم',
  students: 'الطلاب',
  student_profile: 'ملف الطالب',
  add_student: 'إضافة / تعديل طالب',
  groups: 'المجموعات',
  groups_schedule: 'جدول المجموعات',
  group_details: 'تفاصيل المجموعة',
  add_group: 'إضافة / تعديل مجموعة',
  attendance: 'الحضور والغياب',
  scanner: 'الماسح الضوئي',
  kiosk: 'وضع البوابة',
  today_class: 'حصة اليوم',
  subscriptions: 'الاشتراكات والمدفوعات',
  reports: 'التقارير',
  whatsapp: 'مركز واتساب',
  notifications: 'الإشعارات',
  settings: 'الإعدادات',
  archive: 'الأرشيف',
  app_lock: 'قفل التطبيق',
};

const SECTION_COLORS: Partial<Record<ScreenKey, string>> = {
  dashboard: 'from-blue-800 to-blue-900',
  students: 'from-violet-700 to-violet-900',
  student_profile: 'from-violet-700 to-violet-900',
  add_student: 'from-violet-700 to-violet-900',
  groups: 'from-emerald-700 to-emerald-900',
  groups_schedule: 'from-emerald-700 to-emerald-900',
  group_details: 'from-emerald-700 to-emerald-900',
  add_group: 'from-emerald-700 to-emerald-900',
  attendance: 'from-orange-700 to-orange-900',
  scanner: 'from-orange-700 to-orange-900',
  kiosk: 'from-orange-700 to-orange-900',
  today_class: 'from-cyan-700 to-cyan-900',
  subscriptions: 'from-amber-700 to-amber-900',
  reports: 'from-slate-600 to-slate-800',
  whatsapp: 'from-green-700 to-green-900',
  notifications: 'from-rose-700 to-rose-900',
  settings: 'from-slate-700 to-slate-900',
  archive: 'from-slate-500 to-slate-700',
  app_lock: 'from-red-700 to-red-900',
};

export function TopBar({ onSearch }: { onSearch?: () => void }) {
  const { screen, back, navigate, history, settings } = useApp();
  const color = SECTION_COLORS[screen] || 'from-blue-600 to-cyan-600';
  const canBack = history.length > 0;

  return (
    <header className={cn('sticky top-0 z-30 bg-gradient-to-l text-white shadow-lg safe-top', color)}>
      <div className="flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2 min-w-0">
          {canBack ? (
            <button
              onClick={back}
              className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors active:scale-95 flex-shrink-0"
              aria-label="رجوع"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center font-extrabold text-sm flex-shrink-0">
              E+
            </div>
          )}
          <h1 className="font-bold text-lg truncate">{TITLES[screen]}</h1>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {onSearch && (
            <button
              onClick={onSearch}
              className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors active:scale-95"
              aria-label="بحث"
              title="بحث عالمي"
            >
              <Search className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={() => navigate('notifications')}
            className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors active:scale-95"
            aria-label="الإشعارات"
          >
            <Bell className="w-5 h-5" />
          </button>
          <button
            onClick={() => navigate('settings')}
            className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors active:scale-95"
            aria-label="الإعدادات"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
