// ===== English Plus - Advanced Features Library =====
'use client';
import { getDB } from './db';
import type { Student, Group, Lesson, Attendance, Payment, DailyEvaluation, Package, PackageType, SmartNotification, ParentToken, Settings } from './types';
import { formatArDate, arMonthName, GRADE_LABELS_AR, computeMonthlyStats, scheduleText, getGroupDays } from './helpers';

// ============================================================
// 1. ARABIC / ENGLISH NUMERALS
// ============================================================
const AR_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
const EN_DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function toArabicDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, d => AR_DIGITS[Number(d)]);
}

export function toEnglishDigits(input: string): string {
  let out = input;
  AR_DIGITS.forEach((d, i) => { out = out.split(d).join(String(i)); });
  return out;
}

export function formatNum(value: string | number, arabic: boolean): string {
  return arabic ? toArabicDigits(value) : String(value);
}

// ============================================================
// 2. PACKAGES & SCHOLARSHIPS
// ============================================================
export const PACKAGE_INFO: Record<PackageType, { title: string; defaultPercent: number; description: string; icon: string }> = {
  siblings:    { title: 'باقة الإخوة',    defaultPercent: 10,  description: 'خصم لأخوين من نفس العائلة', icon: '👨‍👦' },
  commitment:  { title: 'باقة الالتزام',  defaultPercent: 15,  description: 'لمن حضر 90%+ الشهر الماضي', icon: '✅' },
  excellence:  { title: 'باقة التفوق',    defaultPercent: 20,  description: 'لمن حصل على ممتاز', icon: '🏆' },
  yearly:      { title: 'باقة السنة',     defaultPercent: 16,  description: 'شهر مجاني لمن يدفع 6 شهور مقدماً', icon: '📅' },
  scholarship: { title: 'منحة كاملة',     defaultPercent: 100, description: 'خصم كامل بقرار إداري', icon: '🎓' },
  custom:      { title: 'خصم مخصص',       defaultPercent: 0,   description: 'خصم بنسبة مخصصة', icon: '⚙️' },
};

// Check if a student is eligible for a package (auto-detection)
export async function checkPackageEligibility(studentId: string): Promise<Array<{ type: PackageType; eligible: boolean; reason: string }>> {
  const db = getDB();
  const student = await db.students.get(studentId);
  if (!student) return [];

  const results: Array<{ type: PackageType; eligible: boolean; reason: string }> = [];

  // 1. Siblings: another student with same parentPhone
  const allStudents = await db.students.toArray();
  const siblings = allStudents.filter(s => s.parentPhone === student.parentPhone);
  const hasSibling = siblings.filter(s => s.id !== studentId && s.status === 'active').length > 0;
  results.push({
    type: 'siblings',
    eligible: hasSibling,
    reason: hasSibling ? `يوجد ${siblings.length - 1} أخ/أخت في المركز` : 'لا يوجد إخوة في المركز',
  });

  // 2. Commitment: 90%+ attendance last month
  const now = new Date();
  const lastMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const lastYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const lessons = await db.lessons.toArray();
  const lastMonthLessons = lessons.filter(l => {
    const d = new Date(l.date);
    return d.getMonth() + 1 === lastMonth && d.getFullYear() === lastYear;
  });
  const lastMonthLessonIds = new Set(lastMonthLessons.map(l => l.id));
  const studentAtt = await db.attendance.where('studentId').equals(studentId).toArray();
  const lastMonthAtt = studentAtt.filter(a => lastMonthLessonIds.has(a.lessonId));
  const presentCount = lastMonthAtt.filter(a => a.status === 'present').length;
  const attRate = lastMonthAtt.length > 0 ? (presentCount / lastMonthAtt.length) * 100 : 0;
  results.push({
    type: 'commitment',
    eligible: attRate >= 90,
    reason: attRate >= 90 ? `نسبة الحضور الشهر الماضي: ${Math.round(attRate)}%` : `نسبة الحضور الشهر الماضي: ${Math.round(attRate)}% (أقل من 90%)`,
  });

  // 3. Excellence: ممتاز last month
  const evals = await db.evaluations.where('studentId').equals(studentId).toArray();
  const lastMonthEvals = evals.filter(e => lastMonthLessonIds.has(e.lessonId));
  const avgTotal = lastMonthEvals.length > 0
    ? lastMonthEvals.reduce((s, e) => s + e.totalScore, 0) / lastMonthEvals.length
    : 0;
  results.push({
    type: 'excellence',
    eligible: avgTotal >= 27,
    reason: avgTotal >= 27 ? `المتوسط الشهر الماضي: ${avgTotal.toFixed(1)}/30 (ممتاز)` : `المتوسط الشهر الماضي: ${avgTotal.toFixed(1)}/30`,
  });

  // 4. Yearly: paid 6+ months in advance this year
  const yearPayments = await db.payments.where('studentId').equals(studentId).toArray();
  const thisYearPaid = yearPayments.filter(p => p.year === now.getFullYear()).length;
  results.push({
    type: 'yearly',
    eligible: thisYearPaid >= 6,
    reason: thisYearPaid >= 6 ? `مسدد ${thisYearPaid} شهور هذا العام` : `مسدد ${thisYearPaid} شهور فقط`,
  });

  return results;
}

// Apply a package to a student
export async function applyPackage(studentId: string, type: PackageType, discountPercent?: number, reason?: string): Promise<Package> {
  const db = getDB();
  const info = PACKAGE_INFO[type];
  const pkg: Package = {
    id: crypto.randomUUID(),
    type,
    studentId,
    discountPercent: discountPercent ?? info.defaultPercent,
    reason: reason || info.description,
    startDate: new Date().toISOString(),
    active: true,
    createdAt: new Date().toISOString(),
  };
  await db.packages.add(pkg);
  return pkg;
}

export async function getStudentPackages(studentId: string): Promise<Package[]> {
  const db = getDB();
  return (await db.packages.where('studentId').equals(studentId).toArray()).filter(p => p.active);
}

export async function getActiveDiscountPercent(studentId: string): Promise<number> {
  const pkgs = await getStudentPackages(studentId);
  if (pkgs.length === 0) return 0;
  // Take max discount
  return Math.max(...pkgs.map(p => p.discountPercent));
}

export function calculateDiscountedFee(originalFee: number, discountPercent: number): { original: number; discount: number; final: number } {
  const discount = Math.round((originalFee * discountPercent) / 100);
  return { original: originalFee, discount, final: originalFee - discount };
}

// ============================================================
// 3. SMART NOTIFICATIONS
// ============================================================
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export async function showNotification(title: string, body: string, icon?: string): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    const notif = new Notification(title, {
      body,
      icon: icon || '/icon.svg',
      badge: '/icon.svg',
      tag: 'english-plus-' + Date.now(),
    });
    notif.onclick = () => { window.focus(); notif.close(); };
  } catch (e) {
    console.warn('Notification failed', e);
  }
}

// Check upcoming lessons and notify
export async function checkUpcomingLessonsAndNotify(settings: Settings): Promise<void> {
  if (!settings.smartNotificationsEnabled) return;
  const db = getDB();
  const now = new Date();
  const arDay = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][now.getDay()];
  const groups = (await db.groups.toArray()).filter(g => !g.archived && getGroupDays(g).includes(arDay));
  const beforeMinutes = settings.notifyBeforeLessonMinutes;

  for (const g of groups) {
    // Compute lesson time today
    let hour = g.scheduleHour;
    if (g.schedulePeriod === 'pm' && hour < 12) hour += 12;
    if (g.schedulePeriod === 'am' && hour === 12) hour = 0;
    const lessonTime = new Date();
    lessonTime.setHours(hour, g.scheduleMinute, 0, 0);
    const diffMin = (lessonTime.getTime() - now.getTime()) / 60000;

    if (diffMin > 0 && diffMin <= beforeMinutes) {
      // Notify teacher
      const studentCount = (await db.students.where('groupId').equals(g.id).toArray()).filter(s => s.status === 'active').length;
      await showNotification(
        `⏰ حصة قريبة - ${g.name}`,
        `الحصة بعد ${Math.round(diffMin)} دقيقة - ${studentCount} طالب`
      );
      // Save notification
      await db.notifications.add({
        id: crypto.randomUUID(),
        type: 'lesson_reminder',
        title: `حصة ${g.name} قريبة`,
        body: `الحصة بعد ${Math.round(diffMin)} دقيقة - ${studentCount} طالب`,
        targetId: g.id,
        targetType: 'group',
        sent: true,
        read: false,
        createdAt: new Date().toISOString(),
      });

      // Notify parents if enabled (via WhatsApp deep links - we just log them)
      if (settings.notifyParentBeforeLesson) {
        const students = (await db.students.where('groupId').equals(g.id).toArray()).filter(s => s.status === 'active');
        // We just count - actual sending requires user action
        await db.notifications.add({
          id: crypto.randomUUID(),
          type: 'lesson_reminder',
          title: `تذكير أولياء الأمور - ${g.name}`,
          body: `${students.length} رسالة تذكير جاهزة للإرسال لأولياء الأمور`,
          targetId: g.id,
          targetType: 'group',
          sent: false,
          read: false,
          createdAt: new Date().toISOString(),
        });
      }
    }
  }
}

// Generate daily recommendations
export async function generateDailyRecommendations(): Promise<{
  greeting: string;
  todayLessons: Array<{ group: Group; studentCount: number }>;
  absenteesToFollow: Student[];
  topPerformers: Array<{ student: Student; score: number }>;
  unpaidStudents: Student[];
  weakStudents: Array<{ student: Student; avg: number }>;
  weeklyTip: string;
}> {
  const db = getDB();
  const now = new Date();
  const arDay = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][now.getDay()];
  const hour = now.getHours();
  const greeting = hour < 12 ? 'صباح الخير' : hour < 17 ? 'طاب يومك' : 'مساء الخير';

  const groups = (await db.groups.toArray()).filter(g => !g.archived);
  const todayGroups = groups.filter(g => getGroupDays(g).includes(arDay));

  const todayLessons: Array<{ group: Group; studentCount: number }> = [];
  for (const g of todayGroups) {
    const count = (await db.students.where('groupId').equals(g.id).toArray()).filter(s => s.status === 'active').length;
    todayLessons.push({ group: g, studentCount: count });
  }

  // Last lesson absentees
  const lessons = await db.lessons.toArray();
  const sortedLessons = lessons.slice().sort((a, b) => b.date.localeCompare(a.date));
  const lastLesson = sortedLessons[0];
  let absenteesToFollow: Student[] = [];
  if (lastLesson) {
    const atts = await db.attendance.where('lessonId').equals(lastLesson.id).toArray();
    const absentIds = atts.filter(a => a.status === 'absent').map(a => a.studentId);
    absenteesToFollow = (await db.students.bulkGet(absentIds)).filter((s): s is Student => !!s && s.status === 'active');
  }

  // Top performers (last 7 days)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const recentLessons = lessons.filter(l => new Date(l.date) >= weekAgo);
  const recentLessonIds = new Set(recentLessons.map(l => l.id));
  const recentEvals = await db.evaluations.toArray();
  const evalsByStudent = new Map<string, number[]>();
  for (const e of recentEvals) {
    if (recentLessonIds.has(e.lessonId)) {
      if (!evalsByStudent.has(e.studentId)) evalsByStudent.set(e.studentId, []);
      evalsByStudent.get(e.studentId)!.push(e.totalScore);
    }
  }
  const allStudents = await db.students.toArray();
  const topPerformers = Array.from(evalsByStudent.entries())
    .map(([sid, scores]) => ({
      student: allStudents.find(s => s.id === sid)!,
      score: scores.reduce((a, b) => a + b, 0) / scores.length,
    }))
    .filter(x => x.student && x.student.status === 'active')
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  // Unpaid students
  const unpaidStudents = allStudents.filter(s => s.status === 'active' && s.debt > 0).slice(0, 5);

  // Weak students
  const weakStudents = Array.from(evalsByStudent.entries())
    .map(([sid, scores]) => ({
      student: allStudents.find(s => s.id === sid)!,
      avg: scores.reduce((a, b) => a + b, 0) / scores.length,
    }))
    .filter(x => x.student && x.avg < 15)
    .slice(0, 5);

  const tips = [
    'ابدأ الحصة بمراجعة سريعة للدرس السابق (5 دقائق)',
    'استخدم الاختبارات القصيرة في بداية كل حصة لقياس الفهم',
    'حدد أهدافاً واضحة لكل حصة وشاركها مع الطلاب',
    'وزّع الطلاب الضعفاء مع المتفوقين لتشجيع التعاون',
    'احفظ أسماء طلابك ونادِ كل طالب باسمه - هذا يرفع التفاعل 40%',
    'استخدم بطاقات التهنئة للطلاب المتميزين داخل الحصة',
    'خصّص 5 دقائق نهاية الحصة للأسئلة الحرّة',
    'تابع أولياء الأمور أسبوعياً وليس فقط عند المشاكل',
  ];
  const weeklyTip = tips[now.getDate() % tips.length];

  return { greeting, todayLessons, absenteesToFollow, topPerformers, unpaidStudents, weakStudents, weeklyTip };
}

// ============================================================
// 4. PARENT APP - Token generation (with expiration + open count)
// ============================================================
export async function generateParentToken(
  studentId: string,
  options?: { expiresAt?: string; maxOpens?: number }
): Promise<string> {
  const db = getDB();
  // Revoke old tokens
  const existing = await db.parentTokens.where('studentId').equals(studentId).toArray();
  for (const t of existing) {
    await db.parentTokens.update(t.token, { active: false });
  }
  // Generate new token with crypto random
  const randomPart = crypto.getRandomValues(new Uint8Array(24));
  const tokenHex = Array.from(randomPart).map(b => b.toString(16).padStart(2, '0')).join('');
  const token = btoa(`${studentId}:${Date.now()}:${tokenHex}`).replace(/=/g, '');
  const parentToken: ParentToken = {
    token,
    studentId,
    createdAt: new Date().toISOString(),
    expiresAt: options?.expiresAt,
    maxOpens: options?.maxOpens,
    opensCount: 0,
    active: true,
  };
  await db.parentTokens.add(parentToken);
  return token;
}

export async function validateParentToken(token: string): Promise<{ valid: boolean; reason?: string; parentToken?: ParentToken }> {
  const db = getDB();
  const t = await db.parentTokens.get(token);
  if (!t || !t.active) return { valid: false, reason: 'الرابط غير صالح أو تم إلغاؤه' };
  // Check expiration
  if (t.expiresAt && new Date(t.expiresAt) < new Date()) {
    return { valid: false, reason: 'انتهت صلاحية الرابط' };
  }
  // Check open count
  if (t.maxOpens && t.opensCount >= t.maxOpens) {
    return { valid: false, reason: 'تم تجاوز الحد الأقصى لفتح الرابط' };
  }
  // Increment open count
  await db.parentTokens.update(token, { opensCount: t.opensCount + 1 });
  return { valid: true, parentToken: { ...t, opensCount: t.opensCount + 1 } };
}

export async function revokeParentToken(token: string): Promise<void> {
  const db = getDB();
  await db.parentTokens.update(token, { active: false });
}

export async function getStudentTokens(studentId: string): Promise<ParentToken[]> {
  const db = getDB();
  return (await db.parentTokens.where('studentId').equals(studentId).toArray()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ============================================================
// 4b. PIN LOCKOUT SECURITY (v3)
// ============================================================
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MIN = 5; // 5 minutes lockout

export async function recordPinAttempt(success: boolean): Promise<{ locked: boolean; lockedUntil?: Date; failedCount: number; remainingAttempts: number }> {
  const db = getDB();
  const now = new Date();
  // Get latest attempt
  const attempts = await db.pinAttempts.toArray();
  const lastAttempt = attempts.sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];

  let failedCount = 0;
  let lockedUntil: Date | undefined;

  if (lastAttempt) {
    // If we are still in a lockout window
    if (lastAttempt.lockedUntil && new Date(lastAttempt.lockedUntil) > now) {
      lockedUntil = new Date(lastAttempt.lockedUntil);
      failedCount = lastAttempt.failedCount;
      // Record attempt (still locked)
      await db.pinAttempts.add({
        id: crypto.randomUUID(),
        timestamp: now.toISOString(),
        success: false,
        failedCount,
        lockedUntil: lockedUntil.toISOString(),
      });
      return { locked: true, lockedUntil, failedCount, remainingAttempts: 0 };
    }
    // If last attempt was successful, reset
    if (lastAttempt.success) {
      failedCount = 0;
    } else {
      failedCount = lastAttempt.failedCount;
    }
  }

  if (success) {
    failedCount = 0;
    await db.pinAttempts.add({
      id: crypto.randomUUID(),
      timestamp: now.toISOString(),
      success: true,
      failedCount: 0,
    });
    return { locked: false, failedCount: 0, remainingAttempts: MAX_FAILED_ATTEMPTS };
  }

  // Failed attempt
  failedCount++;
  const remainingAttempts = Math.max(0, MAX_FAILED_ATTEMPTS - failedCount);

  if (failedCount >= MAX_FAILED_ATTEMPTS) {
    lockedUntil = new Date(now.getTime() + LOCKOUT_DURATION_MIN * 60000);
    await db.pinAttempts.add({
      id: crypto.randomUUID(),
      timestamp: now.toISOString(),
      success: false,
      failedCount,
      lockedUntil: lockedUntil.toISOString(),
    });
    return { locked: true, lockedUntil, failedCount, remainingAttempts: 0 };
  }

  await db.pinAttempts.add({
    id: crypto.randomUUID(),
    timestamp: now.toISOString(),
    success: false,
    failedCount,
  });
  return { locked: false, failedCount, remainingAttempts };
}

export async function getLockoutStatus(): Promise<{ locked: boolean; lockedUntil?: Date; failedCount: number; remainingAttempts: number }> {
  const db = getDB();
  const now = new Date();
  const attempts = await db.pinAttempts.toArray();
  const lastAttempt = attempts.sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  if (!lastAttempt) return { locked: false, failedCount: 0, remainingAttempts: MAX_FAILED_ATTEMPTS };

  if (lastAttempt.lockedUntil && new Date(lastAttempt.lockedUntil) > now) {
    return {
      locked: true,
      lockedUntil: new Date(lastAttempt.lockedUntil),
      failedCount: lastAttempt.failedCount,
      remainingAttempts: 0,
    };
  }
  // If lockout expired, reset
  if (lastAttempt.lockedUntil && new Date(lastAttempt.lockedUntil) <= now) {
    return { locked: false, failedCount: 0, remainingAttempts: MAX_FAILED_ATTEMPTS };
  }
  if (lastAttempt.success) {
    return { locked: false, failedCount: 0, remainingAttempts: MAX_FAILED_ATTEMPTS };
  }
  return {
    locked: false,
    failedCount: lastAttempt.failedCount,
    remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - lastAttempt.failedCount),
  };
}

// ============================================================
// 4c. AUTO WEEKLY BACKUP (v3)
// ============================================================
export async function checkAndRunAutoBackup(settings: Settings): Promise<{ ran: boolean; filename?: string }> {
  if (!settings.autoWeeklyBackup) return { ran: false };
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Check last backup date
  if (settings.lastAutoBackupDate) {
    const lastDate = new Date(settings.lastAutoBackupDate);
    const daysSinceLast = (today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceLast < 7) return { ran: false };
  }

  // Perform backup
  const { exportBackup } = await import('./db');
  const json = await exportBackup();
  const blob = new Blob([json], { type: 'application/json' });
  const filename = `english-plus-auto-backup-${todayStr}.json`;

  // Trigger download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  // Update settings
  const newSettings = { ...settings, lastAutoBackupDate: today.toISOString() };
  const { saveSettings } = await import('./db');
  saveSettings(newSettings);

  return { ran: true, filename };
}

// ============================================================
// 4d. CERTIFICATE GENERATOR (v3)
// ============================================================
export interface CertificateData {
  studentName: string;
  studentGrade: string;
  groupName: string;
  month: string;
  year: number;
  type: 'excellence' | 'commitment' | 'improvement';
  avgScore: number;
  attendanceRate: number;
  rank?: number; // 1, 2, 3 if top student
  teacherName: string;
  teacherPhone: string;
  appName: string;
  date: string;
}

export async function generateCertificatePDF(data: CertificateData): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = 297;
  const pageHeight = 210;

  // Render certificate on canvas for Arabic support
  const canvas = document.createElement('canvas');
  const scale = 3;
  canvas.width = 1123 * scale; // A4 landscape at ~96dpi
  canvas.height = 794 * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  // Background
  const bgGrad = ctx.createLinearGradient(0, 0, 1123, 794);
  bgGrad.addColorStop(0, '#fefce8');
  bgGrad.addColorStop(0.5, '#fef9c3');
  bgGrad.addColorStop(1, '#fefce8');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 1123, 794);

  // Outer decorative border
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 8;
  ctx.strokeRect(20, 20, 1083, 754);
  // Inner border
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 3;
  ctx.strokeRect(35, 35, 1053, 724);
  // Decorative corners
  ctx.fillStyle = '#d97706';
  [[35, 35], [1088, 35], [35, 759], [1088, 759]].forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fill();
  });

  // Header
  ctx.fillStyle = '#1e3a8a';
  ctx.font = 'bold 56px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(data.appName, 561, 110);

  // Subtitle
  ctx.fillStyle = '#0e7490';
  ctx.font = 'bold 32px sans-serif';
  const typeText = data.type === 'excellence' ? 'شهادة تفوق' : data.type === 'commitment' ? 'شهادة التزام' : 'شهادة تحسّن';
  ctx.fillText(typeText, 561, 160);

  // Decorative line
  ctx.strokeStyle = '#d97706';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(300, 180);
  ctx.lineTo(823, 180);
  ctx.stroke();

  // Trophy emoji
  ctx.font = '72px sans-serif';
  ctx.fillText('🏆', 561, 260);

  // "تُمنح هذه الشهادة إلى"
  ctx.fillStyle = '#475569';
  ctx.font = '28px sans-serif';
  ctx.fillText('تُمنح هذه الشهادة إلى', 561, 320);

  // Student name (large)
  ctx.fillStyle = '#1e3a8a';
  ctx.font = 'bold 56px sans-serif';
  ctx.fillText(data.studentName, 561, 380);

  // Student grade
  ctx.fillStyle = '#64748b';
  ctx.font = '24px sans-serif';
  ctx.fillText(`الصف: ${data.studentGrade} • المجموعة: ${data.groupName}`, 561, 420);

  // Achievement text
  ctx.fillStyle = '#0f172a';
  ctx.font = '26px sans-serif';
  const achievement = data.type === 'excellence'
    ? 'تقديراً لتفوقه المتميز وحصوله على أعلى الدرجات'
    : data.type === 'commitment'
    ? 'تقديراً لالتزامه المنتظم وحضوره المستمر'
    : 'تقديراً لتحسّنه الملحوظ خلال الفترة الماضية';
  ctx.fillText(achievement, 561, 470);

  // Stats
  ctx.fillStyle = '#0e7490';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(`المتوسط: ${data.avgScore}/30  •  نسبة الحضور: ${data.attendanceRate}%`, 561, 510);

  if (data.rank) {
    ctx.fillStyle = '#d97706';
    ctx.font = 'bold 28px sans-serif';
    const rankText = data.rank === 1 ? '🥇 المركز الأول' : data.rank === 2 ? '🥈 المركز الثاني' : '🥉 المركز الثالث';
    ctx.fillText(rankText, 561, 555);
  }

  // Month/Year
  ctx.fillStyle = '#475569';
  ctx.font = '24px sans-serif';
  ctx.fillText(`شهر ${data.month} ${data.year}`, 561, 600);

  // Date
  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`التاريخ: ${data.date}`, 561, 630);

  // Footer - teacher info
  ctx.fillStyle = '#1e3a8a';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText(data.teacherName, 561, 690);
  ctx.fillStyle = '#64748b';
  ctx.font = '18px sans-serif';
  ctx.fillText(`📞 ${data.teacherPhone}`, 561, 720);

  // Signature line
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(400, 730);
  ctx.lineTo(723, 730);
  ctx.stroke();
  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px sans-serif';
  ctx.fillText('التوقيع', 561, 745);

  // Add canvas to PDF
  const imgData = canvas.toDataURL('image/png');
  doc.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight);

  return doc.output('blob');
}

export async function generateCertificateForStudent(studentId: string, type: 'excellence' | 'commitment' | 'improvement', settings: Settings): Promise<Blob | null> {
  const db = getDB();
  const student = await db.students.get(studentId);
  if (!student) return null;
  const group = student.groupId ? await db.groups.get(student.groupId) : null;
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const arMonth = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'][month - 1];

  // Compute this month's stats
  const lessons = await db.lessons.toArray();
  const monthLessons = lessons.filter(l => {
    const d = new Date(l.date);
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  });
  const monthLessonIds = new Set(monthLessons.map(l => l.id));
  const atts = await db.attendance.where('studentId').equals(studentId).toArray();
  const monthAtts = atts.filter(a => monthLessonIds.has(a.lessonId));
  const evals = await db.evaluations.where('studentId').equals(studentId).toArray();
  const monthEvals = evals.filter(e => monthLessonIds.has(e.lessonId));
  const present = monthAtts.filter(a => a.status === 'present').length;
  const attendanceRate = monthAtts.length > 0 ? Math.round((present / monthAtts.length) * 100) : 0;
  const avgScore = monthEvals.length > 0 ? Math.round((monthEvals.reduce((s, e) => s + e.totalScore, 0) / monthEvals.length) * 10) / 10 : 0;

  // Check if student is top 3 (compute rank)
  let rank: number | undefined = undefined;
  const allStudents = await db.students.toArray();
  const studentScores: Array<{ id: string; avg: number }> = [];
  for (const s of allStudents) {
    if (s.status !== 'active') continue;
    const sAtts = await db.attendance.where('studentId').equals(s.id).toArray();
    const sMonthAtts = sAtts.filter(a => monthLessonIds.has(a.lessonId));
    const sEvals = await db.evaluations.where('studentId').equals(s.id).toArray();
    const sMonthEvals = sEvals.filter(e => monthLessonIds.has(e.lessonId));
    if (sMonthEvals.length === 0) continue;
    const sAvg = sMonthEvals.reduce((sum, e) => sum + e.totalScore, 0) / sMonthEvals.length;
    studentScores.push({ id: s.id, avg: sAvg });
  }
  studentScores.sort((a, b) => b.avg - a.avg);
  const studentRank = studentScores.findIndex(s => s.id === studentId);
  if (studentRank >= 0 && studentRank < 3) rank = studentRank + 1;

  const certData: CertificateData = {
    studentName: student.name,
    studentGrade: student.grade,
    groupName: group?.name || '—',
    month: arMonth,
    year,
    type,
    avgScore,
    attendanceRate,
    rank,
    teacherName: settings.teacherName,
    teacherPhone: settings.teacherPhone,
    appName: settings.appName,
    date: now.toLocaleDateString('ar-EG'),
  };
  return generateCertificatePDF(certData);
}

export async function getParentAppData(token: string, settings: Settings): Promise<{
  student: Student;
  group: Group | null;
  todayStats: { present: number; absent: number; avgTotal: number; grade: string };
  monthlyStats: { lessonsCount: number; present: number; absent: number; avgTotal: number; grade: string; strengths: string[]; weaknesses: string[] };
  recentEvals: Array<{ date: string; total: number; grade: string; note?: string }>;
  payments: Array<{ date: string; amount: number; month: number; year: number; remaining: number; invoiceNo: string }>;
  upcomingLessons: Group[];
  messages: Array<{ date: string; template: string; body: string }>;
  teacherName: string;
  teacherPhone: string;
  appName: string;
} | null> {
  const db = getDB();
  const result = await validateParentToken(token);
  if (!result.valid || !result.parentToken) return null;
  const t = result.parentToken;
  const student = await db.students.get(t.studentId);
  if (!student) return null;
  const group = student.groupId ? await db.groups.get(student.groupId) : null;
  const allLessons = await db.lessons.toArray();
  const allAtts = await db.attendance.where('studentId').equals(student.id).toArray();
  const allEvals = await db.evaluations.where('studentId').equals(student.id).toArray();
  const allPayments = await db.payments.where('studentId').equals(student.id).toArray();
  const allMessages = await db.messages.where('studentId').equals(student.id).toArray();

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const monthLessons = allLessons.filter(l => {
    const d = new Date(l.date);
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  });
  const monthLessonIds = new Set(monthLessons.map(l => l.id));
  const monthAtt = allAtts.filter(a => monthLessonIds.has(a.lessonId));
  const monthEvals = allEvals.filter(e => monthLessonIds.has(e.lessonId));
  const stats = computeMonthlyStats(monthAtt, monthEvals);
  const sw = deriveStrengthsWeaknessesSimple(stats);

  const recentEvals = allEvals.slice().reverse().slice(0, 5).map(e => {
    const lesson = allLessons.find(l => l.id === e.lessonId);
    return {
      date: lesson ? formatArDate(lesson.date) : '—',
      total: e.totalScore,
      grade: GRADE_LABELS_AR[e.gradeLabel],
      note: e.note,
    };
  });

  const payments = allPayments.slice().reverse().slice(0, 10).map(p => ({
    date: formatArDate(p.paymentDate),
    amount: p.amountPaid,
    month: p.month,
    year: p.year,
    remaining: p.amountRemaining,
    invoiceNo: p.invoiceNumber,
  }));

  // Upcoming lessons
  const upcomingLessons: Group[] = [];
  const allGroups = (await db.groups.toArray()).filter(g => !g.archived);
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const day = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][d.getDay()];
    const matched = allGroups.filter(g => getGroupDays(g).includes(day));
    for (const g of matched) if (!upcomingLessons.find(u => u.id === g.id)) upcomingLessons.push(g);
  }

  const messages = allMessages.slice().reverse().slice(0, 10).map(m => ({
    date: formatArDate(m.sentAt),
    template: m.templateType,
    body: m.messageBody,
  }));

  return {
    student,
    group,
    todayStats: { present: stats.present, absent: stats.absent, avgTotal: stats.avgTotal, grade: GRADE_LABELS_AR[stats.grade] },
    monthlyStats: { lessonsCount: stats.lessonsCount, present: stats.present, absent: stats.absent, avgTotal: stats.avgTotal, grade: GRADE_LABELS_AR[stats.grade], strengths: sw.strengths, weaknesses: sw.weaknesses },
    recentEvals,
    payments,
    upcomingLessons,
    messages,
    teacherName: settings.teacherName,
    teacherPhone: settings.teacherPhone,
    appName: settings.appName,
  };
}

function deriveStrengthsWeaknessesSimple(stats: ReturnType<typeof computeMonthlyStats>): { strengths: string[]; weaknesses: string[] } {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  if (stats.present / (stats.lessonsCount || 1) >= 0.85) strengths.push('حضور منتظم');
  if (stats.avgHw >= 4) strengths.push('واجب ممتاز');
  if (stats.avgMem >= 8) strengths.push('حفظ قوي');
  if (stats.avgRev >= 8) strengths.push('مراجعة جيدة');
  if (stats.avgTotal >= 24) strengths.push('أداء عام مرتفع');
  if (stats.absent / (stats.lessonsCount || 1) >= 0.25) weaknesses.push('غياب متكرر');
  if (stats.avgRev < 6) weaknesses.push('المراجعة أقل من المطلوب');
  if (stats.avgMem < 6) weaknesses.push('الحفظ يحتاج تقوية');
  if (stats.avgHw < 3) weaknesses.push('الواجب ضعيف');
  if (strengths.length === 0) strengths.push('مستوى مقبول');
  if (weaknesses.length === 0) weaknesses.push('لا يوجد ملاحظات كبيرة');
  return { strengths, weaknesses };
}

// ============================================================
// 5. VOICE CONTROL
// ============================================================
export function isVoiceControlSupported(): boolean {
  return typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
}

export interface VoiceRecognitionResult {
  transcript: string;
  confidence: number;
}

export function createVoiceRecognition(
  onResult: (result: VoiceRecognitionResult) => void,
  onError?: (error: string) => void,
  onEnd?: () => void
): any {
  if (!isVoiceControlSupported()) return null;
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const recognition = new SR();
  recognition.lang = 'ar-EG';
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.onresult = (event: any) => {
    const result = event.results[0][0];
    onResult({ transcript: result.transcript, confidence: result.confidence });
  };
  recognition.onerror = (event: any) => onError?.(event.error);
  recognition.onend = () => onEnd?.();
  return recognition;
}

// Parse voice command and return action
export function parseVoiceCommand(transcript: string): { action: string; params: Record<string, string> } | null {
  const t = transcript.trim().toLowerCase();
  // "سجل حضور أحمد" / "سجّل حضور أحمد محمد"
  const attendanceMatch = t.match(/سجّ?ل\s+حضور\s+(.+)/);
  if (attendanceMatch) return { action: 'mark_present', params: { name: attendanceMatch[1].trim() } };

  // "أعطِ أحمد 10 على 10" / "أعطي أحمد 8"
  const scoreMatch = t.match(/أعطِ?\s+(.+?)\s+(\d+)\s*(?:على?\s*\d+)?/);
  if (scoreMatch) return { action: 'set_score', params: { name: scoreMatch[1].trim(), score: scoreMatch[2] } };

  // "احفظ الحصة" / "حفظ"
  if (t.includes('احفظ') || t.includes('حفظ الحصة') || t.includes('حفظ')) {
    return { action: 'save_lesson', params: {} };
  }

  // "التالي" / "الطالب التالي"
  if (t.includes('التالي') || t.includes('التالى')) {
    return { action: 'next_student', params: {} };
  }

  // "السابق"
  if (t.includes('السابق') || t.includes('اللى قبل')) {
    return { action: 'prev_student', params: {} };
  }

  // "افتح الماسح" / "افتح الكاميرا"
  if (t.includes('افتح') && (t.includes('الماسح') || t.includes('الكاميرا') || t.includes('الباركود'))) {
    return { action: 'open_scanner', params: {} };
  }

  // "ابحث عن أحمد"
  const searchMatch = t.match(/ابحث\s+عن\s+(.+)/);
  if (searchMatch) return { action: 'search', params: { query: searchMatch[1].trim() } };

  return null;
}

// ============================================================
// 6. AR CARDS - Augmented Reality overlay
// ============================================================
export interface ARCardData {
  studentName: string;
  code: string;
  grade: string;
  groupName: string;
  totalScore: number;
  gradeLabel: string;
  debt: number;
  attendanceRate: number;
  photo?: string;
}

export async function getARCardData(studentId: string): Promise<ARCardData | null> {
  const db = getDB();
  const student = await db.students.get(studentId);
  if (!student) return null;
  const group = student.groupId ? await db.groups.get(student.groupId) : null;
  const atts = await db.attendance.where('studentId').equals(studentId).toArray();
  const evals = await db.evaluations.where('studentId').equals(studentId).toArray();
  const presentCount = atts.filter(a => a.status === 'present').length;
  const attendanceRate = atts.length > 0 ? (presentCount / atts.length) * 100 : 0;
  const lastEval = evals[evals.length - 1];

  return {
    studentName: student.name,
    code: student.code,
    grade: student.grade,
    groupName: group?.name || '—',
    totalScore: lastEval?.totalScore || 0,
    gradeLabel: lastEval ? GRADE_LABELS_AR[lastEval.gradeLabel] : 'غير مُقيّم',
    debt: student.debt,
    attendanceRate: Math.round(attendanceRate),
    photo: student.photo,
  };
}

// ============================================================
// 7. WHATSAPP BUSINESS API - Automated sending
// ============================================================
export async function sendWhatsAppAutomated(
  phone: string,
  message: string,
  settings: Settings
): Promise<{ success: boolean; via: 'api' | 'deep_link'; error?: string }> {
  // If WhatsApp Business API is configured, use it
  if (settings.whatsappApiEnabled && settings.whatsappApiToken && settings.whatsappApiPhoneId) {
    try {
      const clean = phone.replace(/[^\d]/g, '');
      let international = clean;
      if (clean.startsWith('0')) international = '2' + clean; // Egypt
      const response = await fetch('https://graph.facebook.com/v18.0/' + settings.whatsappApiPhoneId + '/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.whatsappApiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: international,
          type: 'text',
          text: { body: message },
        }),
      });
      if (response.ok) return { success: true, via: 'api' };
      return { success: false, via: 'api', error: 'API error: ' + response.status };
    } catch (e) {
      return { success: false, via: 'api', error: String(e) };
    }
  }
  // Fallback to deep link (opens WhatsApp with prefilled message)
  const clean = phone.replace(/[^\d]/g, '');
  let international = clean;
  if (clean.startsWith('0')) international = '2' + clean;
  const url = `https://wa.me/${international}?text=${encodeURIComponent(message)}`;
  if (typeof window !== 'undefined') window.open(url, '_blank');
  return { success: true, via: 'deep_link' };
}

// ============================================================
// 8. ENCRYPTED CLOUD SYNC
// ============================================================
// Simple XOR-based encryption for demo (in production, use Web Crypto API with AES-GCM)
export function encryptData(data: string, key: string): string {
  if (!key) return data;
  let result = '';
  for (let i = 0; i < data.length; i++) {
    const charCode = data.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    result += String.fromCharCode(charCode);
  }
  return btoa(unescape(encodeURIComponent(result)));
}

export function decryptData(encrypted: string, key: string): string {
  if (!key) return encrypted;
  try {
    const data = decodeURIComponent(escape(atob(encrypted)));
    let result = '';
    for (let i = 0; i < data.length; i++) {
      const charCode = data.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      result += String.fromCharCode(charCode);
    }
    return result;
  } catch {
    return '';
  }
}

export async function performCloudSync(settings: Settings): Promise<{ success: boolean; syncedAt: string; itemsCount: number; error?: string }> {
  if (!settings.cloudSyncEnabled) return { success: false, syncedAt: new Date().toISOString(), itemsCount: 0, error: 'Cloud sync disabled' };
  try {
    const db = getDB();
    const data = {
      students: await db.students.toArray(),
      groups: await db.groups.toArray(),
      lessons: await db.lessons.toArray(),
      attendance: await db.attendance.toArray(),
      evaluations: await db.evaluations.toArray(),
      payments: await db.payments.toArray(),
      messages: await db.messages.toArray(),
      activities: await db.activities.toArray(),
      packages: await db.packages.toArray(),
      notifications: await db.notifications.toArray(),
      parentTokens: await db.parentTokens.toArray(),
      settings,
    };
    const json = JSON.stringify(data);
    const encrypted = encryptData(json, settings.cloudSyncEncryptionKey);
    // In production: upload to cloud storage (S3, Firebase, etc.)
    // For now: save to localStorage as "cloud backup"
    localStorage.setItem('english_plus_cloud_backup', encrypted);
    localStorage.setItem('english_plus_cloud_last_sync', new Date().toISOString());

    const itemsCount = data.students.length + data.groups.length + data.lessons.length +
      data.attendance.length + data.evaluations.length + data.payments.length;

    return { success: true, syncedAt: new Date().toISOString(), itemsCount };
  } catch (e) {
    return { success: false, syncedAt: new Date().toISOString(), itemsCount: 0, error: String(e) };
  }
}

export async function restoreFromCloud(settings: Settings): Promise<{ success: boolean; error?: string }> {
  if (!settings.cloudSyncEnabled) return { success: false, error: 'Cloud sync disabled' };
  try {
    const encrypted = localStorage.getItem('english_plus_cloud_backup');
    if (!encrypted) return { success: false, error: 'No cloud backup found' };
    const json = decryptData(encrypted, settings.cloudSyncEncryptionKey);
    if (!json) return { success: false, error: 'Decryption failed - wrong key' };
    const data = JSON.parse(json);
    const db = getDB();
    await db.transaction('rw', [db.students, db.groups, db.lessons, db.attendance, db.evaluations, db.payments, db.messages, db.activities, db.packages, db.notifications, db.parentTokens], async () => {
      await db.students.clear();
      await db.groups.clear();
      await db.lessons.clear();
      await db.attendance.clear();
      await db.evaluations.clear();
      await db.payments.clear();
      await db.messages.clear();
      await db.activities.clear();
      await db.packages.clear();
      await db.notifications.clear();
      await db.parentTokens.clear();
      if (data.students) await db.students.bulkAdd(data.students);
      if (data.groups) await db.groups.bulkAdd(data.groups);
      if (data.lessons) await db.lessons.bulkAdd(data.lessons);
      if (data.attendance) await db.attendance.bulkAdd(data.attendance);
      if (data.evaluations) await db.evaluations.bulkAdd(data.evaluations);
      if (data.payments) await db.payments.bulkAdd(data.payments);
      if (data.messages) await db.messages.bulkAdd(data.messages);
      if (data.activities) await db.activities.bulkAdd(data.activities);
      if (data.packages) await db.packages.bulkAdd(data.packages);
      if (data.notifications) await db.notifications.bulkAdd(data.notifications);
      if (data.parentTokens) await db.parentTokens.bulkAdd(data.parentTokens);
    });
    return { success: true };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

// ============================================================
// 9. UNIVERSAL SEARCH
// ============================================================
export interface SearchResult {
  type: 'student' | 'group' | 'payment' | 'lesson' | 'report';
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  action?: { screen: string; params?: Record<string, string> };
}

export async function universalSearch(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  const db = getDB();
  const q = query.trim().toLowerCase();
  const results: SearchResult[] = [];

  // Search intent detection
  // "غائب 3" -> show frequent absentees
  const absentMatch = q.match(/غائب\s*(\d+)?/);
  if (absentMatch) {
    const threshold = parseInt(absentMatch[1] || '3');
    const lessons = await db.lessons.toArray();
    const atts = await db.attendance.toArray();
    const counts = new Map<string, number>();
    for (const a of atts) {
      if (a.status === 'absent') counts.set(a.studentId, (counts.get(a.studentId) || 0) + 1);
    }
    const students = await db.students.toArray();
    for (const [sid, c] of counts) {
      if (c >= threshold) {
        const s = students.find(s => s.id === sid);
        if (s) results.push({
          type: 'student', id: s.id, title: s.name, subtitle: `${c} مرات غياب - ${s.grade}`,
          icon: '⚠️', action: { screen: 'student_profile', params: { id: s.id } }
        });
      }
    }
  }

  // "أول الشهر" / "آخر الشهر" -> show subscriptions
  if (q.includes('أول الشهر') || q.includes('اخر الشهر') || q.includes('آخر الشهر')) {
    const mode = q.includes('أول') ? 'start' : 'end';
    results.push({
      type: 'report', id: 'subs_' + mode, title: `مشتركات ${mode === 'start' ? 'أول الشهر' : 'آخر الشهر'}`,
      subtitle: 'عرض قائمة الطلاب', icon: '💰',
      action: { screen: 'subscriptions' }
    });
  }

  // Search students
  const students = await db.students.toArray();
  for (const s of students) {
    if (s.name.toLowerCase().includes(q) || s.code.includes(q) || s.parentPhone.includes(q) || s.grade.toLowerCase().includes(q)) {
      results.push({
        type: 'student', id: s.id, title: s.name,
        subtitle: `${s.grade} • كود: ${s.code}${s.debt > 0 ? ' • دين: ' + s.debt : ''}`,
        icon: '👨‍🎓', action: { screen: 'student_profile', params: { id: s.id } }
      });
    }
  }

  // Search groups
  const groups = await db.groups.toArray();
  for (const g of groups) {
    if (g.name.toLowerCase().includes(q) || g.code.toLowerCase().includes(q) || g.grade.toLowerCase().includes(q) || g.subject.toLowerCase().includes(q)) {
      results.push({
        type: 'group', id: g.id, title: g.name,
        subtitle: `${g.grade} • ${g.scheduleDay} • ${scheduleText(g)}`,
        icon: '📚', action: { screen: 'group_details', params: { id: g.id } }
      });
    }
  }

  // Search payments (by invoice number)
  const payments = await db.payments.toArray();
  for (const p of payments) {
    if (p.invoiceNumber.toLowerCase().includes(q)) {
      const s = students.find(s => s.id === p.studentId);
      results.push({
        type: 'payment', id: p.id, title: p.invoiceNumber,
        subtitle: `${s?.name || '—'} • ${p.amountPaid} ج.م • ${formatArDate(p.paymentDate)}`,
        icon: '🧾', action: s ? { screen: 'student_profile', params: { id: s.id } } : undefined
      });
    }
  }

  // Quick reports
  if (q.includes('تقرير') || q.includes('report')) {
    results.push({
      type: 'report', id: 'reports', title: 'فتح شاشة التقارير',
      subtitle: '12 نوع تقرير متاح', icon: '📊',
      action: { screen: 'reports' }
    });
  }

  return results.slice(0, 30);
}
