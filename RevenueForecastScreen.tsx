// ===== English Plus - Revenue Forecast Screen =====
'use client';
import { useEffect, useState } from 'react';
import { useApp } from '@/lib/store';
import { getDB } from '@/lib/db';
import type { Student, Payment } from '@/lib/types';
import { formatMoney, arMonthName, computeFinancialSummary } from '@/lib/helpers';
import { TrendingUp, Wallet, Users, AlertTriangle, BarChart3 } from 'lucide-react';

export function RevenueForecastScreen() {
  const { settings, refreshKey } = useApp();
  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const db = getDB();
      const [s, p] = await Promise.all([db.students.toArray(), db.payments.toArray()]);
      setStudents(s);
      setPayments(p);
      setLoading(false);
    })();
  }, [refreshKey]);

  if (loading) return <div className="p-4"><div className="h-32 rounded-2xl bg-slate-200 dark:bg-slate-800 animate-pulse" /></div>;

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const activeStudents = students.filter(s => s.status === 'active');

  // Current month
  const currentFin = computeFinancialSummary(students, payments, month, year);

  // Last month
  const lastMonth = month === 1 ? 12 : month - 1;
  const lastYear = month === 1 ? year - 1 : year;
  const lastFin = computeFinancialSummary(students, payments, lastMonth, lastYear);

  // Forecast next month
  const expectedRevenue = activeStudents.reduce((s, st) => s + st.monthlyFee, 0);
  const historicalCollectionRate = lastFin.expectedTotal > 0 ? lastFin.collectionRate / 100 : 0.8;
  const realisticForecast = Math.round(expectedRevenue * historicalCollectionRate);
  const expectedShortfall = expectedRevenue - realisticForecast;

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      <div className="rounded-2xl bg-gradient-to-l from-emerald-600 to-green-800 p-4 text-white shadow-lg">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-5 h-5" />
          <div className="font-bold">حاسبة الدخل المتوقع</div>
        </div>
      </div>

      {/* Next Month Forecast */}
      <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Wallet className="w-4 h-4 text-emerald-600" />
          <div className="font-bold text-sm">التوقع للشهر القادم ({arMonthName(month === 12 ? 1 : month + 1)})</div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
            <span className="text-xs text-slate-600">الدخل المتوقع (طلاب × اشتراك)</span>
            <span className="font-bold text-emerald-600">{formatMoney(expectedRevenue)}</span>
          </div>
          <div className="flex justify-between p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
            <span className="text-xs text-slate-600">معدل التحصيل التاريخي ({lastFin.collectionRate}%)</span>
            <span className="font-bold text-blue-600">{lastFin.collectionRate}%</span>
          </div>
          <div className="flex justify-between p-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 border-2 border-emerald-300">
            <span className="text-sm font-bold text-slate-700">الدخل المتوقع الفعلي</span>
            <span className="font-extrabold text-emerald-700 text-lg">{formatMoney(realisticForecast)}</span>
          </div>
          <div className="flex justify-between p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
            <span className="text-xs text-slate-600">المتأخرات المتوقعة</span>
            <span className="font-bold text-red-600">{formatMoney(expectedShortfall)}</span>
          </div>
        </div>
      </div>

      {/* Current Month */}
      <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-4">
        <div className="font-bold text-sm mb-3">الشهر الحالي ({arMonthName(month)} {year})</div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50 flex justify-between"><span className="text-slate-500">المتوقع</span><span className="font-bold">{formatMoney(currentFin.expectedTotal)}</span></div>
          <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex justify-between"><span className="text-slate-500">المحصّل</span><span className="font-bold text-emerald-600">{formatMoney(currentFin.collectedTotal)}</span></div>
          <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20 flex justify-between"><span className="text-slate-500">المتأخرات</span><span className="font-bold text-red-600">{formatMoney(currentFin.outstandingTotal)}</span></div>
          <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex justify-between"><span className="text-slate-500">نسبة التحصيل</span><span className="font-bold text-blue-600">{currentFin.collectionRate}%</span></div>
        </div>
      </div>

      {/* Last Month Comparison */}
      <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-4">
        <div className="font-bold text-sm mb-3">الشهر الماضي ({arMonthName(lastMonth)} {lastYear})</div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50 flex justify-between"><span className="text-slate-500">المتوقع</span><span className="font-bold">{formatMoney(lastFin.expectedTotal)}</span></div>
          <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex justify-between"><span className="text-slate-500">المحصّل</span><span className="font-bold text-emerald-600">{formatMoney(lastFin.collectedTotal)}</span></div>
        </div>
      </div>
    </div>
  );
}
