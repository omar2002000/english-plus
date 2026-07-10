// ===== English Plus - Smart Recommendations =====
'use client';
import { useEffect, useState } from 'react';
import { useApp } from '@/lib/store';
import { generateDailyRecommendations } from '@/lib/advanced';
import type { Student, Group } from '@/lib/types';
import { formatArDate, scheduleText, formatMoney, GRADE_LABELS_AR } from '@/lib/helpers';
import { Sparkles, Calendar, AlertTriangle, Trophy, Wallet, TrendingDown, Lightbulb, ChevronLeft, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function SmartRecommendations({ onClose }: { onClose: () => void }) {
  const { navigate, settings, refreshKey } = useApp();
  const [data, setData] = useState<Awaited<ReturnType<typeof generateDailyRecommendations>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const r = await generateDailyRecommendations();
      setData(r);
      setLoading(false);
    })();
  }, [refreshKey]);

  if (loading || !data) {
    return (
      <div className="rounded-2xl bg-gradient-to-l from-violet-500 to-purple-700 p-4 text-white shadow-lg animate-pulse">
        <div className="h-4 w-32 bg-white/20 rounded mb-2" />
        <div className="h-3 w-48 bg-white/10 rounded" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-gradient-to-l from-violet-600 to-purple-800 p-4 text-white shadow-lg overflow-hidden relative">
      <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10" />
      <div className="absolute -left-4 -bottom-4 w-24 h-24 rounded-full bg-white/5" />

      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            <div>
              <div className="font-bold">{data.greeting}، مستر نصر 👋</div>
              <div className="text-xs opacity-80">{formatArDate(new Date())}</div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Today's lessons */}
        {data.todayLessons.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center gap-2 text-xs font-bold opacity-90 mb-1.5">
              <Calendar className="w-3.5 h-3.5" /> حصص اليوم
            </div>
            <div className="space-y-1">
              {data.todayLessons.map(({ group, studentCount }) => (
                <button
                  key={group.id}
                  onClick={() => navigate('group_details', { id: group.id })}
                  className="w-full flex items-center justify-between p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-right"
                >
                  <div className="text-sm font-bold">{group.name}</div>
                  <div className="text-xs opacity-80">{scheduleText(group)} • {studentCount} طالب</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            onClick={() => navigate('today_class')}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-right"
          >
            <div className="text-xs opacity-80">⚡ ابدأ حصة اليوم</div>
          </button>
          <button
            onClick={() => navigate('scanner')}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-right"
          >
            <div className="text-xs opacity-80">📷 سجّل الحضور</div>
          </button>
        </div>

        {/* Alerts */}
        <div className="space-y-2">
          {data.absenteesToFollow.length > 0 && (
            <AlertCard
              icon={<AlertTriangle className="w-4 h-4 text-amber-300" />}
              title={`${data.absenteesToFollow.length} طلاب غابوا آخر حصة`}
              subtitle="اضغط للمتابعة"
              onClick={() => navigate('attendance')}
              color="bg-amber-500/20"
            />
          )}
          {data.unpaidStudents.length > 0 && (
            <AlertCard
              icon={<Wallet className="w-4 h-4 text-red-300" />}
              title={`${data.unpaidStudents.length} طلاب متأخرو السداد`}
              subtitle={formatMoney(data.unpaidStudents.reduce((s, st) => s + st.debt, 0))}
              onClick={() => navigate('subscriptions')}
              color="bg-red-500/20"
            />
          )}
          {data.weakStudents.length > 0 && (
            <AlertCard
              icon={<TrendingDown className="w-4 h-4 text-orange-300" />}
              title={`${data.weakStudents.length} طلاب يحتاجون متابعة`}
              subtitle="أقل من 20/30 الأسبوع الماضي"
              onClick={() => navigate('reports')}
              color="bg-orange-500/20"
            />
          )}
          {data.topPerformers.length > 0 && (
            <AlertCard
              icon={<Trophy className="w-4 h-4 text-yellow-300" />}
              title="🏆 المتفوقون هذا الأسبوع"
              subtitle={data.topPerformers.map(p => `${p.student.name} (${p.score.toFixed(1)})`).join(' • ')}
              onClick={() => navigate('students')}
              color="bg-yellow-500/20"
            />
          )}
        </div>

        {/* Weekly tip */}
        <div className="mt-3 p-2.5 rounded-lg bg-white/10 flex items-start gap-2">
          <Lightbulb className="w-4 h-4 text-yellow-300 flex-shrink-0 mt-0.5" />
          <div className="text-xs">
            <div className="font-bold mb-0.5">💡 نصيحة اليوم</div>
            <div className="opacity-90">{data.weeklyTip}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AlertCard({
  icon, title, subtitle, onClick, color,
}: {
  icon: React.ReactNode; title: string; subtitle: string; onClick: () => void; color: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn('w-full flex items-center gap-2 p-2 rounded-lg text-right hover:scale-[1.02] transition-transform', color)}
    >
      {icon}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold truncate">{title}</div>
        <div className="text-[10px] opacity-80 truncate">{subtitle}</div>
      </div>
      <ChevronLeft className="w-3 h-3 opacity-60" />
    </button>
  );
}
