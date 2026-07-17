// ===== English Plus - Notifications Center Screen =====
'use client';
import { useEffect, useState } from 'react';
import { useApp } from '@/lib/store';
import { getDB } from '@/lib/db';
import type { SmartNotification } from '@/lib/types';
import { formatArDate, formatArDateShort } from '@/lib/helpers';
import { Bell, Calendar, AlertTriangle, Wallet, Trophy, Check, X, BellOff, CheckCheck } from 'lucide-react';
import { EmptyState } from '@/components/ui-shared';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function NotificationsScreen() {
  const { settings, refreshKey } = useApp();
  const [notifications, setNotifications] = useState<SmartNotification[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

  useEffect(() => {
    (async () => {
      const db = getDB();
      const notifs = await db.notifications.toArray();
      setNotifications(notifs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    })();
  }, [refreshKey]);

  async function markAsRead(id: string) {
    const db = getDB();
    await db.notifications.update(id, { read: true });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }

  async function markAllRead() {
    const db = getDB();
    for (const n of notifications.filter(n => !n.read)) {
      await db.notifications.update(n.id, { read: true });
    }
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    toast.success('تم تعليم الكل كمقروء');
  }

  async function clearAll() {
    if (!confirm('حذف كل الإشعارات؟')) return;
    const db = getDB();
    await db.notifications.clear();
    setNotifications([]);
    toast.success('تم مسح كل الإشعارات');
  }

  async function requestPermission() {
    if (!('Notification' in window)) {
      toast.error('المتصفح لا يدعم الإشعارات');
      return;
    }
    if (Notification.permission === 'granted') {
      toast.success('الإشعارات مفعّلة');
      return;
    }
    if (Notification.permission === 'denied') {
      toast.error('الإشعارات محظورة من إعدادات المتصفح - يجب تفعيلها يدوياً');
      return;
    }
    const result = await Notification.requestPermission();
    if (result === 'granted') {
      toast.success('تم تفعيل الإشعارات');
      new Notification('English Plus', { body: 'تم تفعيل الإشعارات بنجاح ✓' });
    } else {
      toast.error('تم رفض الإذن');
    }
  }

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    if (filter === 'read') return n.read;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  function getIcon(type: string) {
    switch (type) {
      case 'lesson_reminder': return <Calendar className="w-5 h-5 text-blue-600" />;
      case 'absence_alert': return <AlertTriangle className="w-5 h-5 text-amber-600" />;
      case 'payment_reminder': return <Wallet className="w-5 h-5 text-red-600" />;
      case 'payment_confirm': return <Check className="w-5 h-5 text-emerald-600" />;
      case 'top_student': return <Trophy className="w-5 h-5 text-yellow-500" />;
      case 'recommendation': return <Bell className="w-5 h-5 text-violet-600" />;
      default: return <Bell className="w-5 h-5 text-slate-500" />;
    }
  }

  return (
    <div className="p-4 space-y-3 animate-fade-in">
      {/* Header card */}
      <div className="rounded-2xl bg-gradient-to-l from-red-500 to-rose-600 p-4 text-white shadow-lg">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            <div>
              <div className="font-bold">مركز الإشعارات</div>
              <div className="text-xs opacity-80">{unreadCount} غير مقروء</div>
            </div>
          </div>
          <div className="text-3xl font-extrabold">{unreadCount}</div>
        </div>
        <button
          onClick={requestPermission}
          className="w-full py-2 rounded-xl bg-white/20 hover:bg-white/30 text-xs font-bold flex items-center justify-center gap-1"
        >
          <Bell className="w-3 h-3" /> تفعيل إشعارات المتصفح
        </button>
      </div>

      {/* Filter + actions */}
      <div className="flex gap-2 items-center">
        <div className="flex gap-1 flex-1">
          {(['all', 'unread', 'read'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-bold',
                filter === f ? 'bg-red-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'
              )}
            >
              {f === 'all' ? 'الكل' : f === 'unread' ? 'غير مقروء' : 'مقروء'}
            </button>
          ))}
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="px-2 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-1">
            <CheckCheck className="w-3 h-3" /> تعليم الكل
          </button>
        )}
        {notifications.length > 0 && (
          <button onClick={clearAll} className="px-2 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-bold">
            مسح الكل
          </button>
        )}
      </div>

      {/* Notifications list */}
      {filtered.length === 0 ? (
        <EmptyState
          title="لا توجد إشعارات"
          subtitle="الإشعارات الذكية ستظهر هنا"
          icon={<BellOff className="w-10 h-10" />}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map(n => (
            <div
              key={n.id}
              className={cn(
                'p-3 rounded-2xl border transition-all',
                n.read
                  ? 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 opacity-70'
                  : 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900'
              )}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center flex-shrink-0">
                  {getIcon(n.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-sm text-slate-800 dark:text-slate-100">{n.title}</div>
                    {!n.read && <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">{n.body}</div>
                  <div className="text-[10px] text-slate-400 mt-1">{formatArDateShort(n.createdAt)}</div>
                </div>
                {!n.read && (
                  <button
                    onClick={() => markAsRead(n.id)}
                    className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center flex-shrink-0"
                    title="تعليم كمقروء"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Status info */}
      <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-3 text-xs text-slate-500 text-center">
        {settings.smartNotificationsEnabled ? (
          <>✓ الإشعارات الذكية مفعّلة — تصل تنبيهات قبل الحصص بـ {settings.notifyBeforeLessonMinutes} دقيقة</>
        ) : (
          <>⚠️ الإشعارات الذكية معطّلة — يمكنك تفعيلها من الإعدادات</>
        )}
      </div>
    </div>
  );
}
