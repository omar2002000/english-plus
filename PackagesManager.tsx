// ===== English Plus - Packages Manager =====
'use client';
import { useEffect, useState } from 'react';
import { useApp } from '@/lib/store';
import { getDB } from '@/lib/db';
import { PACKAGE_INFO, checkPackageEligibility, applyPackage, getStudentPackages, calculateDiscountedFee } from '@/lib/advanced';
import type { PackageType, Package, Student } from '@/lib/types';
import { Gift, Check, X, Plus, Award, Percent, TrendingUp, Calendar, Users, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { formatMoney, formatArDateShort } from '@/lib/helpers';

export function PackagesManager({ student, onRefresh }: { student: Student; onRefresh?: () => void }) {
  const { triggerRefresh } = useApp();
  const [packages, setPackages] = useState<Package[]>([]);
  const [eligibility, setEligibility] = useState<Array<{ type: PackageType; eligible: boolean; reason: string }>>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedType, setSelectedType] = useState<PackageType | null>(null);
  const [customPercent, setCustomPercent] = useState(0);
  const [reason, setReason] = useState('');

  useEffect(() => {
    (async () => {
      const [pkgs, elig] = await Promise.all([
        getStudentPackages(student.id),
        checkPackageEligibility(student.id),
      ]);
      setPackages(pkgs);
      setEligibility(elig);
    })();
  }, [student.id]);

  async function handleApply() {
    if (!selectedType) return;
    const info = PACKAGE_INFO[selectedType];
    const percent = selectedType === 'custom' ? customPercent : info.defaultPercent;
    await applyPackage(student.id, selectedType, percent, reason || info.description);
    toast.success(`تم تطبيق ${info.title} (${percent}%)`);
    setShowAdd(false);
    setSelectedType(null);
    setCustomPercent(0);
    setReason('');
    const pkgs = await getStudentPackages(student.id);
    setPackages(pkgs);
    onRefresh?.();
    triggerRefresh();
  }

  async function removePackage(pkgId: string) {
    const db = getDB();
    await db.packages.update(pkgId, { active: false });
    toast.success('تم إلغاء الباقة');
    const pkgs = await getStudentPackages(student.id);
    setPackages(pkgs);
    onRefresh?.();
    triggerRefresh();
  }

  const totalDiscount = packages.length > 0 ? Math.max(...packages.map(p => p.discountPercent)) : 0;
  const discountedFee = calculateDiscountedFee(student.monthlyFee, totalDiscount);

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200">
          <Gift className="w-4 h-4 text-amber-500" />
          الباقات والخصومات
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="text-xs px-2 py-1 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-bold flex items-center gap-1"
        >
          <Plus className="w-3 h-3" /> إضافة باقة
        </button>
      </div>

      {/* Current discount summary */}
      {packages.length > 0 ? (
        <div className="mb-3 p-3 rounded-xl bg-gradient-to-l from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border border-amber-200 dark:border-amber-900">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500">الاشتراك الأصلي</div>
              <div className="font-bold text-slate-700 dark:text-slate-200 line-through opacity-60">{formatMoney(student.monthlyFee)}</div>
            </div>
            <div className="text-amber-600 font-bold text-lg">-{totalDiscount}%</div>
            <div className="text-left">
              <div className="text-xs text-slate-500">بعد الخصم</div>
              <div className="font-bold text-emerald-600">{formatMoney(discountedFee.final)}</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-3 text-center py-3 text-slate-400 text-xs">
          لا توجد باقات مفعّلة - الاشتراك الكامل: {formatMoney(student.monthlyFee)}
        </div>
      )}

      {/* Active packages */}
      {packages.length > 0 && (
        <div className="space-y-2 mb-3">
          {packages.map(p => {
            const info = PACKAGE_INFO[p.type];
            return (
              <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                <div className="text-xl">{info.icon}</div>
                <div className="flex-1">
                  <div className="text-sm font-bold text-slate-700 dark:text-slate-200">{info.title}</div>
                  <div className="text-[10px] text-slate-500">{p.reason}</div>
                </div>
                <div className="text-amber-600 font-bold text-sm">-{p.discountPercent}%</div>
                <button
                  onClick={() => removePackage(p.id)}
                  className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 flex items-center justify-center"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Eligibility check */}
      <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">فحص الأهلية التلقائي:</div>
      <div className="space-y-1.5">
        {eligibility.map(e => {
          const info = PACKAGE_INFO[e.type];
          return (
            <button
              key={e.type}
              onClick={() => e.eligible && (setSelectedType(e.type), setShowAdd(true))}
              disabled={!e.eligible}
              className={cn(
                'w-full flex items-center gap-2 p-2 rounded-lg text-right transition-colors',
                e.eligible
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 cursor-pointer'
                  : 'bg-slate-50 dark:bg-slate-900/30 opacity-60'
              )}
            >
              <div className="text-lg">{info.icon}</div>
              <div className="flex-1">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-200">{info.title}</div>
                <div className="text-[10px] text-slate-500">{e.reason}</div>
              </div>
              {e.eligible ? (
                <span className="px-1.5 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-bold">مؤهل</span>
              ) : (
                <span className="px-1.5 py-0.5 rounded-md bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold">غير مؤهل</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Add dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تطبيق باقة على {student.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(PACKAGE_INFO) as PackageType[]).map(t => {
                const info = PACKAGE_INFO[t];
                return (
                  <button
                    key={t}
                    onClick={() => setSelectedType(t)}
                    className={cn(
                      'p-3 rounded-xl border text-right transition-all',
                      selectedType === t
                        ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-500'
                        : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700'
                    )}
                  >
                    <div className="text-2xl mb-1">{info.icon}</div>
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-200">{info.title}</div>
                    <div className="text-[10px] text-slate-500">{info.description}</div>
                    {t !== 'custom' && t !== 'scholarship' && (
                      <div className="text-amber-600 font-bold text-xs mt-1">{info.defaultPercent}%</div>
                    )}
                  </button>
                );
              })}
            </div>
            {selectedType === 'custom' && (
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300">نسبة الخصم (%)</label>
                <input
                  type="number"
                  min="0" max="100"
                  value={customPercent || ''}
                  onChange={e => setCustomPercent(Number(e.target.value))}
                  className="w-full mt-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-sm font-bold"
                />
              </div>
            )}
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300">السبب / الملاحظة</label>
              <input
                type="text"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder={selectedType ? PACKAGE_INFO[selectedType].description : ''}
                className="w-full mt-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-sm"
              />
            </div>
            {selectedType && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-center">
                <div className="text-xs text-slate-500">النتيجة</div>
                <div className="font-bold text-slate-700 dark:text-slate-200">
                  {formatMoney(student.monthlyFee)} → {formatMoney(calculateDiscountedFee(student.monthlyFee, selectedType === 'custom' ? customPercent : PACKAGE_INFO[selectedType].defaultPercent).final)}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600">إلغاء</button>
            <button
              onClick={handleApply}
              disabled={!selectedType || (selectedType === 'custom' && customPercent <= 0)}
              className="px-4 py-2 rounded-xl bg-amber-600 text-white text-sm font-bold disabled:opacity-50"
            >
              تطبيق الباقة
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
