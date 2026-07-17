// ===== English Plus - Floating Back Button (mobile-friendly) =====
'use client';
import { useApp } from '@/lib/store';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function FloatingBackButton() {
  const { screen, back, history } = useApp();
  // Don't show on dashboard (it's the home)
  if (screen === 'dashboard' || history.length === 0) return null;

  return (
    <button
      onClick={back}
      className="fixed bottom-6 right-4 z-30 w-12 h-12 rounded-full bg-slate-800 dark:bg-slate-700 text-white shadow-xl flex items-center justify-center active:scale-90 transition-transform hover:bg-slate-900"
      style={{ right: 'auto', left: '1rem' }}
      aria-label="رجوع"
      title="رجوع"
    >
      <ArrowRight className="w-5 h-5" />
    </button>
  );
}
