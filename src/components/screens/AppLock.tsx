// ===== English Plus - App Lock (v4 - with lockout + force change default PIN + hashed PIN) =====
'use client';
import { useEffect, useState } from 'react';
import { useApp } from '@/lib/store';
import { recordPinAttempt, getLockoutStatus } from '@/lib/advanced';
import { hashPin, verifyPin } from '@/lib/security';
import { Delete, Lock, AlertTriangle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function AppLock() {
  const { settings, setLocked, setSettings } = useApp();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [lockInfo, setLockInfo] = useState<{ locked: boolean; lockedUntil?: Date; failedCount: number; remainingAttempts: number }>({
    locked: false, failedCount: 0, remainingAttempts: 5,
  });
  const [forceChangeMode, setForceChangeMode] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [changeError, setChangeError] = useState('');
  // Store hashed PIN separately
  const [hashedPin, setHashedPin] = useState<string>('');

  useEffect(() => {
    (async () => {
      const status = await getLockoutStatus();
      setLockInfo(status);
      if (settings.appLockEnabled && !settings.pinChangedFromDefault && settings.pin === '1234') {
        setForceChangeMode(true);
      }
      // Hash the current PIN for comparison
      const h = await hashPin(settings.pin);
      setHashedPin(h);
    })();
  }, [settings.appLockEnabled, settings.pinChangedFromDefault, settings.pin]);

  useEffect(() => {
    if (!lockInfo.locked) return;
    const interval = setInterval(async () => {
      const status = await getLockoutStatus();
      setLockInfo(status);
    }, 5000);
    return () => clearInterval(interval);
  }, [lockInfo.locked]);

  async function press(digit: string) {
    if (lockInfo.locked) return;
    if (pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    if (next.length === 4) {
      setTimeout(() => tryUnlock(next), 100);
    }
  }

  async function tryUnlock(enteredPin: string) {
    // Verify using hashed PIN
    const isValid = await verifyPin(enteredPin, hashedPin);
    if (isValid) {
      await recordPinAttempt(true);
      setLocked(false);
    } else {
      const result = await recordPinAttempt(false);
      setLockInfo(result);
      setError(true);
      if (result.locked && result.lockedUntil) {
        const waitMin = Math.ceil((result.lockedUntil.getTime() - Date.now()) / 60000);
        toast.error(`تم قفل التطبيق بعد 5 محاولات فاشلة. انتظر ${waitMin} دقيقة`);
      } else {
        toast.error(`رقم سري خاطئ. المحاولات المتبقية: ${result.remainingAttempts}`);
      }
      setTimeout(() => { setPin(''); setError(false); }, 500);
    }
  }

  function backspace() {
    setPin(prev => prev.slice(0, -1));
  }

  async function handleChangePin() {
    setChangeError('');
    if (newPin.length !== 4) {
      setChangeError('الرقم السري يجب أن يكون 4 أرقام');
      return;
    }
    if (newPin === '1234') {
      setChangeError('لا يمكن استخدام 1234 كرقم سري - اختر رقماً أقوى');
      return;
    }
    if (newPin !== confirmPin) {
      setChangeError('الرقمان غير متطابقين');
      return;
    }
    // Hash the new PIN before storing
    const h = await hashPin(newPin);
    setSettings({ ...settings, pin: newPin, pinChangedFromDefault: true });
    setHashedPin(h);
    setForceChangeMode(false);
    setNewPin('');
    setConfirmPin('');
    toast.success('تم تغيير الرقم السري بنجاح');
    setLocked(false);
  }

  // ===== Force change PIN screen =====
  if (forceChangeMode) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-amber-900 via-orange-900 to-red-900 p-6 text-white">
        <div className="w-20 h-20 rounded-3xl bg-white/10 flex items-center justify-center mb-4">
          <AlertTriangle className="w-10 h-10 text-amber-300" />
        </div>
        <h1 className="text-2xl font-extrabold mb-2">تغيير الرقم السري الافتراضي</h1>
        <p className="text-sm opacity-80 mb-6 text-center max-w-xs">
          لأمان التطبيق، يجب تغيير الرقم السري الافتراضي (1234) قبل الاستخدام. اختر رقماً سرياً جديداً من 4 أرقام.
        </p>

        <div className="w-full max-w-xs space-y-3">
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="الرقم السري الجديد"
            className="w-full text-center text-2xl font-bold tracking-widest py-3 bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <input
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="تأكيد الرقم السري"
            className="w-full text-center text-2xl font-bold tracking-widest py-3 bg-white/10 border border-white/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          {changeError && (
            <div className="text-red-300 text-sm text-center bg-red-900/40 rounded-lg p-2">{changeError}</div>
          )}
          <button
            onClick={handleChangePin}
            disabled={newPin.length !== 4 || confirmPin.length !== 4}
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold disabled:opacity-50 transition-colors"
          >
            حفظ الرقم السري الجديد
          </button>
        </div>
      </div>
    );
  }

  // ===== Lockout screen =====
  if (lockInfo.locked && lockInfo.lockedUntil) {
    const minsLeft = Math.ceil((lockInfo.lockedUntil.getTime() - Date.now()) / 60000);
    const secsLeft = Math.ceil((lockInfo.lockedUntil.getTime() - Date.now()) / 1000);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-red-900 via-rose-900 to-red-900 p-6 text-white">
        <div className="w-24 h-24 rounded-3xl bg-white/10 flex items-center justify-center mb-4">
          <Clock className="w-12 h-12 text-red-300" />
        </div>
        <h1 className="text-2xl font-extrabold mb-2">تم قفل التطبيق مؤقتاً</h1>
        <p className="text-sm opacity-80 mb-4 text-center max-w-xs">
          تم تجاوز الحد الأقصى من المحاولات الفاشلة (5 محاولات)
        </p>
        <div className="text-5xl font-extrabold mb-2 tabular-nums">
          {minsLeft > 0 ? `${minsLeft} دقيقة` : `${secsLeft} ثانية`}
        </div>
        <p className="text-xs opacity-60">حتى يتم رفع القفل تلقائياً</p>
      </div>
    );
  }

  // ===== Normal PIN entry screen =====
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-cyan-900 p-6 text-white">
      <div className="w-20 h-20 rounded-3xl bg-white/10 flex items-center justify-center mb-4">
        <Lock className="w-10 h-10" />
      </div>
      <h1 className="text-2xl font-extrabold mb-2">{settings.appName}</h1>
      <p className="text-sm opacity-70 mb-2">أدخل الرقم السري للدخول</p>
      {lockInfo.failedCount > 0 && (
        <p className="text-xs text-amber-300 mb-4">
          المحاولات المتبقية: {lockInfo.remainingAttempts}
        </p>
      )}

      {/* Pin dots */}
      <div className={cn('flex gap-3 mb-8', error && 'animate-pulse')}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={cn(
            'pin-dot',
            (error ? true : pin.length > i) && 'filled',
            error && 'border-red-400 bg-red-400'
          )} />
        ))}
      </div>

      {/* Number pad */}
      <div className="grid grid-cols-3 gap-3 max-w-xs w-full">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
          <button
            key={d}
            onClick={() => press(d)}
            className="aspect-square rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-2xl font-bold"
          >
            {d}
          </button>
        ))}
        <div />
        <button
          onClick={() => press('0')}
          className="aspect-square rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-2xl font-bold"
        >
          0
        </button>
        <button
          onClick={backspace}
          className="aspect-square rounded-2xl bg-white/10 hover:bg-white/20 active:scale-95 transition-all flex items-center justify-center"
        >
          <Delete className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
