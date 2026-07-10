// ===== English Plus - Shared UI components =====
'use client';
import { cn } from '@/lib/utils';
import { Search, Inbox } from 'lucide-react';
import { ReactNode } from 'react';

// Stat card
export function StatCard({
  title, value, subtitle, icon, color = 'blue', onClick,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  color?: 'blue' | 'violet' | 'green' | 'orange' | 'cyan' | 'amber' | 'red' | 'slate' | 'emerald';
  onClick?: () => void;
}) {
  const colorMap: Record<string, string> = {
    blue: 'from-blue-500 to-blue-700',
    violet: 'from-violet-500 to-purple-700',
    green: 'from-green-500 to-emerald-700',
    orange: 'from-orange-500 to-amber-600',
    cyan: 'from-cyan-500 to-teal-700',
    amber: 'from-amber-500 to-orange-600',
    red: 'from-red-500 to-rose-700',
    slate: 'from-slate-600 to-slate-800',
    emerald: 'from-emerald-500 to-green-700',
  };
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'relative overflow-hidden rounded-2xl p-4 text-white text-right shadow-md transition-all',
        'bg-gradient-to-br', colorMap[color],
        onClick && 'hover:scale-[1.02] active:scale-[0.98] cursor-pointer'
      )}
    >
      <div className="absolute -left-6 -top-6 w-24 h-24 rounded-full bg-white/10" />
      <div className="absolute -right-8 -bottom-8 w-20 h-20 rounded-full bg-white/5" />
      <div className="relative">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-3xl font-extrabold tracking-tight">{value}</div>
            <div className="text-xs font-semibold opacity-90 mt-0.5">{title}</div>
          </div>
          {icon && <div className="opacity-80">{icon}</div>}
        </div>
        {subtitle && <div className="text-[11px] opacity-80 mt-1">{subtitle}</div>}
      </div>
    </button>
  );
}

// Search bar
export function SearchBar({
  value, onChange, placeholder = 'بحث...',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 pr-10 pl-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
      />
    </div>
  );
}

// Empty state
export function EmptyState({
  title, subtitle, icon, action,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-4">
        {icon || <Inbox className="w-10 h-10" />}
      </div>
      <h3 className="font-bold text-slate-700 dark:text-slate-200">{title}</h3>
      {subtitle && <p className="text-sm text-slate-500 mt-1 max-w-xs">{subtitle}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// Section header
export function SectionHeader({ title, icon, action }: { title: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="font-bold text-slate-800 dark:text-slate-100">{title}</h2>
      </div>
      {action}
    </div>
  );
}

// Quick action button (used in dashboard)
export function QuickAction({
  label, icon, color, onClick,
}: {
  label: string;
  icon: ReactNode;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-all active:scale-95"
    >
      <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center text-white', color)}>
        {icon}
      </div>
      <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 text-center leading-tight">{label}</span>
    </button>
  );
}

// Score button (0-10)
export function ScoreButton({
  value, selected, onClick, color,
}: {
  value: number;
  selected: boolean;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-8 h-8 rounded-lg text-xs font-bold transition-all active:scale-90',
        selected
          ? (color || 'bg-blue-600 text-white') + ' scale-110 shadow-md'
          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
      )}
    >
      {value}
    </button>
  );
}

// Status pill
export function StatusPill({ status, label }: { status: 'active' | 'archived' | 'paused' | 'paid' | 'unpaid' | 'partial' | 'late' | 'present' | 'absent' | 'excused'; label: string }) {
  const colors: Record<string, string> = {
    active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    archived: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    paused: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    paid: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    unpaid: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    partial: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    late: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    present: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    absent: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    excused: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  };
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold', colors[status])}>
      {label}
    </span>
  );
}
