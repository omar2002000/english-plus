// ===== English Plus - Bottom Navigation =====
'use client';
import { useApp, type ScreenKey } from '@/lib/store';
import { LayoutDashboard, Users, ClipboardList, CalendarCheck, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

const ITEMS: Array<{ key: ScreenKey; label: string; icon: typeof LayoutDashboard; color: string }> = [
  { key: 'dashboard', label: 'الرئيسية', icon: LayoutDashboard, color: 'text-blue-600' },
  { key: 'students', label: 'الطلاب', icon: Users, color: 'text-violet-600' },
  { key: 'attendance', label: 'الحضور', icon: ClipboardList, color: 'text-orange-500' },
  { key: 'today_class', label: 'حصة اليوم', icon: CalendarCheck, color: 'text-cyan-600' },
  { key: 'groups', label: 'المجموعات', icon: BookOpen, color: 'text-emerald-600' },
];

export function BottomNav() {
  const { screen, navigate } = useApp();

  return (
    <nav className="absolute bottom-0 left-0 right-0 z-30 glass border-t border-white/10 safe-bottom">
      <div className="flex items-center justify-around px-1 py-1">
        {ITEMS.map((item) => {
          const active = screen === item.key;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => navigate(item.key)}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-2xl transition-all active:scale-95 min-w-[64px]',
                active ? 'bg-slate-900/5 dark:bg-white/10' : 'hover:bg-slate-900/5 dark:hover:bg-white/5'
              )}
            >
              <Icon className={cn('w-6 h-6 transition-colors', active ? item.color : 'text-slate-400 dark:text-slate-500')} />
              <span className={cn(
                'text-[11px] font-semibold transition-colors',
                active ? item.color : 'text-slate-500 dark:text-slate-400'
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
