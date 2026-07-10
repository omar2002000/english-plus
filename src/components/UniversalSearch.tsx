// ===== English Plus - Universal Search =====
'use client';
import { useEffect, useState, useRef } from 'react';
import { useApp } from '@/lib/store';
import { universalSearch, type SearchResult } from '@/lib/advanced';
import { Search, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ScreenKey } from '@/lib/store';

export function UniversalSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { navigate } = useApp();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery('');
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      const r = await universalSearch(query);
      if (!cancelled) {
        setResults(r);
        setLoading(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);

  function handleResultClick(r: SearchResult) {
    if (r.action) {
      navigate(r.action.screen as ScreenKey, r.action.params);
    }
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 pt-16 animate-fade-in" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '440px' }}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 p-3 border-b border-slate-100 dark:border-slate-800">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث عن طالب، مجموعة، فاتورة، أو اكتب: غائب 3، أول الشهر..."
            className="flex-1 bg-transparent text-sm outline-none text-slate-800 dark:text-slate-100"
          />
          {loading && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {query.trim() === '' ? (
            <div className="p-6 text-center text-slate-400 text-sm">
              <Search className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <div className="font-bold mb-1">البحث العالمي</div>
              <div className="text-xs">ابحث في كل التطبيق: الطلاب، المجموعات، الفواتير...</div>
              <div className="mt-3 text-xs space-y-1 text-right">
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2">
                  💡 جرّب: <span className="font-bold">"أحمد"</span> أو <span className="font-bold">"غائب 3"</span> أو <span className="font-bold">"أول الشهر"</span>
                </div>
              </div>
            </div>
          ) : results.length === 0 && !loading ? (
            <div className="p-6 text-center text-slate-400 text-sm">
              <div className="font-bold mb-1">لا توجد نتائج</div>
              <div className="text-xs">جرّب كلمة أخرى</div>
            </div>
          ) : (
            <div className="py-1">
              {results.map((r) => (
                <button
                  key={`${r.type}-${r.id}`}
                  onClick={() => handleResultClick(r)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-right transition-colors"
                >
                  <div className="text-2xl">{r.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm text-slate-800 dark:text-slate-100 truncate">{r.title}</div>
                    <div className="text-xs text-slate-500 truncate">{r.subtitle}</div>
                  </div>
                  <div className={cn('text-[10px] px-2 py-0.5 rounded-full font-bold',
                    r.type === 'student' ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' :
                    r.type === 'group' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
                    r.type === 'payment' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                    'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  )}>
                    {r.type === 'student' ? 'طالب' : r.type === 'group' ? 'مجموعة' : r.type === 'payment' ? 'دفعة' : 'تقرير'}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
