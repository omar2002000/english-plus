// ===== English Plus - Utilities =====
import type { GradeLabel, Settings, Student, Group, DailyEvaluation, Attendance, Payment, WhatsappTemplate } from './types';

// ===== Grade helpers (v4: total = 30) =====
// الحضور=5، الحفظ=10، المراجعة=10، الواجب=5 → المجموع=30
export const MAX_ATTENDANCE_SCORE = 5;
export const MAX_MEMORIZATION_SCORE = 10;
export const MAX_REVIEW_SCORE = 10;
export const MAX_HOMEWORK_SCORE = 5;
export const MAX_TOTAL_SCORE = 30;
export const WEAK_THRESHOLD = 15; // أقل من 15/30 = ضعيف يحتاج متابعة

export function computeTotal(a: number, b: number, c: number, d: number): number {
  return (a || 0) + (b || 0) + (c || 0) + (d || 0);
}

export function gradeFromTotal(total: number): GradeLabel {
  // v4: التقديرات من 30
  if (total >= 27) return 'excellent';      // 27-30 = ممتاز (90%+)
  if (total >= 22) return 'very_good';      // 22-26 = جيد جداً (73-89%)
  if (total >= 15) return 'good';           // 15-21 = جيد (50-72%)
  if (total >= 10) return 'acceptable';     // 10-14 = مقبول (33-49%)
  if (total === 0) return 'unevaluated';
  return 'weak';                            // < 10 = ضعيف
}

export const GRADE_LABELS_AR: Record<GradeLabel, string> = {
  excellent: 'ممتاز',
  very_good: 'جيد جداً',
  good: 'جيد',
  acceptable: 'مقبول',
  weak: 'ضعيف',
  unevaluated: 'غير مُقيّم',
};

export const GRADE_COLORS: Record<GradeLabel, { bg: string; text: string; ring: string }> = {
  excellent: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', ring: 'ring-emerald-500' },
  very_good: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', ring: 'ring-blue-500' },
  good: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300', ring: 'ring-yellow-500' },
  acceptable: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', ring: 'ring-orange-500' },
  weak: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', ring: 'ring-red-500' },
  unevaluated: { bg: 'bg-slate-100 dark:bg-slate-800/30', text: 'text-slate-600 dark:text-slate-400', ring: 'ring-slate-400' },
};

// ===== Date helpers (Arabic) =====
const AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

export function arDayName(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return AR_DAYS[d.getDay()];
}

export function arMonthName(month: number): string {
  return AR_MONTHS[month - 1] || '';
}

export function formatArDate(date: Date | string, withDay = true): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const day = withDay ? `${AR_DAYS[d.getDay()]} ` : '';
  return `${day}${d.getDate()} ${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatArDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const period = h >= 12 ? 'م' : 'ص';
  h = h % 12 || 12;
  return `${h}:${m} ${period}`;
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export function scheduleText(group: Group): string {
  // If multiple schedules exist, show all
  if (group.schedules && group.schedules.length > 0) {
    return group.schedules.map(s => {
      const period = s.period === 'am' ? 'صباحاً' : 'مساءً';
      const h = s.hour % 12 || 12;
      return `${s.day} ${h}:${String(s.minute).padStart(2, '0')} ${period}`;
    }).join(' • ');
  }
  // Fallback to single schedule
  const period = group.schedulePeriod === 'am' ? 'صباحاً' : 'مساءً';
  const h = group.scheduleHour % 12 || 12;
  return `${group.scheduleDay} - ${h}:${String(group.scheduleMinute).padStart(2, '0')} ${period}`;
}

// Get group days as array (for upcoming lessons check)
export function getGroupDays(group: Group): string[] {
  if (group.schedules && group.schedules.length > 0) {
    return Array.from(new Set(group.schedules.map(s => s.day)));
  }
  return [group.scheduleDay];
}

// ===== QR / Barcode content =====
export function studentQRPayload(student: Student, group: Group | null | undefined, settings: Settings): string {
  const lines = [
    `التطبيق: ${settings.appName}`,
    `الطالب: ${student.name}`,
    `الصف: ${student.grade}`,
    `العام: ${student.academicYear}`,
    group ? `المجموعة: ${group.name}` : '',
    group ? `الموعد: ${scheduleText(group)}` : '',
    `المدرس: ${settings.teacherName}`,
    `الهاتف: ${settings.teacherPhone}`,
    `الكود: ${student.code}`,
  ].filter(Boolean);
  // Encode student id + code as primary key for scanning
  return JSON.stringify({ app: settings.appName, sid: student.id, code: student.code, name: student.name, info: lines.join('\n') });
}

// Parse scanned QR (could be our JSON or just a code)
export function parseScannedQr(raw: string): { sid?: string; code?: string } | null {
  try {
    const obj = JSON.parse(raw);
    if (obj.sid || obj.code) return { sid: obj.sid, code: obj.code };
  } catch {
    // not json - treat as code
  }
  const trimmed = raw.trim();
  if (/^\d{4}$/.test(trimmed)) return { code: trimmed };
  return { code: trimmed };
}

// ===== Money =====
export function formatMoney(n: number): string {
  return `${Number(n || 0).toLocaleString('ar-EG')} ج.م`;
}

// ===== Student file helpers =====
export function studentRiskLevel(student: Student, absencesThisMonth: number): 'safe' | 'warning' | 'danger' | null {
  let risk: 'safe' | 'warning' | 'danger' = 'safe';
  if (student.debt > 0) risk = 'warning';
  if (absencesThisMonth >= 3) risk = 'warning';
  if (student.debt > 0 && absencesThisMonth >= 3) risk = 'danger';
  if (absencesThisMonth >= 5) risk = 'danger';
  return risk;
}

// ===== WhatsApp deep link =====
export function whatsappLink(phone: string, message: string): string {
  // remove non digits except country code
  const clean = phone.replace(/[^\d]/g, '');
  // assume Egypt country code if starts with 0
  let international = clean;
  if (clean.startsWith('0')) international = '2' + clean; // 20 for Egypt
  const text = encodeURIComponent(message);
  return `https://wa.me/${international}?text=${text}`;
}

// ===== WhatsApp Templates =====
export const WHATSAPP_TEMPLATES: WhatsappTemplate[] = [
  {
    key: 'payment_reminder',
    title: 'تذكير بالدفع',
    icon: '💰',
    body: `السلام عليكم ورحمة الله وبركاته 🌙
نذكّركم بأن الطالب {student_name}
لديه مبلغ متبقٍ قدره {debt} جنيه
وذلك عن شهر {month}.
نرجو سداد المبلغ في أقرب وقت ممكن.
مع خالص التحية،
{teacher_name}`,
  },
  {
    key: 'absence',
    title: 'إشعار غياب',
    icon: '❌',
    body: `السلام عليكم ورحمة الله وبركاته
نحيطكم علمًا بأن الطالب {student_name}
قد تغيب عن حصة اليوم {today}.
مع خالص التحية،
{teacher_name}`,
  },
  {
    key: 'repeated_absence',
    title: 'غياب متكرر',
    icon: '🔔',
    body: `السلام عليكم ورحمة الله وبركاته 🔔
نذكّركم بأن الطالب {student_name}
قد تغيب عن {absence_count} جلسات متتالية،
وكان آخر غياب بتاريخ {last_absence}.
نرجو منكم التواصل معنا لمعرفة السبب ومتابعة الطالب.
مع خالص التحية،
{teacher_name}`,
  },
  {
    key: 'excellent',
    title: 'أداء ممتاز',
    icon: '🌟',
    body: `السلام عليكم ورحمة الله وبركاته 🌟
يسعدنا إبلاغكم بأن الطالب {student_name}
قدّم أداءً ممتازًا ورائعًا خلال هذا الشهر 👏
نشكر لكم متابعتكم المستمرة واهتمامكم.
مع خالص التحية،
{teacher_name}`,
  },
  {
    key: 'payment_confirm',
    title: 'تأكيد دفع',
    icon: '✅',
    body: `✅ تأكيد استلام دفعة
الطالب: {student_name}
المبلغ المستلم: {amount} جنيه
التاريخ: {today}
المبلغ المتبقي: {remaining} جنيه
مع خالص التحية،
{teacher_name}`,
  },
  {
    key: 'daily_report',
    title: 'تقرير حصة اليوم',
    icon: '📝',
    body: `تقرير حصة اليوم — {app_name} 📝
ولي أمر الطالب: {student_name}
التاريخ: {today}
✅ الحضور: {att}/10
📖 الحفظ: {mem}/10
🔄 المراجعة: {rev}/10
📝 الواجب: {hw}/10
🏆 المجموع: {total}/30
📊 التقدير: {grade}
ملاحظة المدرس: {note}
مع خالص التحية،
{teacher_name}`,
  },
  {
    key: 'monthly_report',
    title: 'التقرير الشهري',
    icon: '📘',
    body: `تقرير شهري — {app_name} 📘
ولي أمر الطالب: {student_name}
الشهر: {month} / {year}
📚 عدد الحصص: {lessons}
✅ الحضور: {present}
❌ الغياب: {absent}
📈 المتوسط العام: {avg}/30
🏅 التقدير الشهري: {grade}
نقاط القوة: {strengths}
نقاط تحتاج متابعة: {weaknesses}
مع خالص التحية،
{teacher_name}`,
  },
  {
    key: 'invoice',
    title: 'إيصال دفع',
    icon: '🧾',
    body: `إيصال دفع — {app_name} 🧾
ولي أمر الطالب: {student_name}
تم استلام مبلغ {amount} جنيه
وذلك عن اشتراك شهر {month} / {year}
بتاريخ {today}.
المتبقي حتى الآن: {remaining} جنيه
شكرًا لتعاونكم،
{teacher_name}`,
  },
  {
    key: 'welcome',
    title: 'ترحيب بطالب جديد',
    icon: '🎉',
    body: `السلام عليكم ورحمة الله وبركاته 🎉
أهلاً وسهلاً بكم في {app_name}
يسعدنا انضمام الطالب {student_name}
إلى {group_name}
نتطلع لمسيرة تعليمية موفقة.
مع خالص التحية،
{teacher_name}`,
  },
  {
    key: 'custom',
    title: 'رسالة مخصصة',
    icon: '✍️',
    body: `السلام عليكم ورحمة الله وبركاته
{teacher_name}`,
  },
];

export function fillTemplate(body: string, vars: Record<string, string | number>): string {
  return body.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

// ===== Monthly stats helper =====
export interface MonthlyStats {
  lessonsCount: number;
  present: number;
  absent: number;
  excused: number;
  avgAtt: number;
  avgMem: number;
  avgRev: number;
  avgHw: number;
  avgTotal: number;
  grade: GradeLabel;
}

export function computeMonthlyStats(
  attendances: Attendance[],
  evaluations: DailyEvaluation[]
): MonthlyStats {
  const lessonsCount = new Set(attendances.map(a => a.lessonId)).size;
  const present = attendances.filter(a => a.status === 'present').length;
  const absent = attendances.filter(a => a.status === 'absent').length;
  const excused = attendances.filter(a => a.status === 'excused').length;

  const n = evaluations.length || 1;
  const avgAtt = evaluations.reduce((s, e) => s + e.attendanceScore, 0) / n;
  const avgMem = evaluations.reduce((s, e) => s + e.memorizationScore, 0) / n;
  const avgRev = evaluations.reduce((s, e) => s + e.reviewScore, 0) / n;
  const avgHw = evaluations.reduce((s, e) => s + e.homeworkScore, 0) / n;
  const avgTotal = evaluations.reduce((s, e) => s + e.totalScore, 0) / n;

  return {
    lessonsCount,
    present,
    absent,
    excused,
    avgAtt: round1(avgAtt),
    avgMem: round1(avgMem),
    avgRev: round1(avgRev),
    avgHw: round1(avgHw),
    avgTotal: round1(avgTotal),
    grade: gradeFromTotal(round1(avgTotal)),
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ===== Strengths / weaknesses from stats =====
export function deriveStrengthsWeaknesses(stats: MonthlyStats): { strengths: string[]; weaknesses: string[] } {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  if (stats.present / (stats.lessonsCount || 1) >= 0.85) strengths.push('حضور منتظم');
  if (stats.avgHw >= 4) strengths.push('واجب ممتاز');  // v4: from 5
  if (stats.avgMem >= 8) strengths.push('حفظ قوي');
  if (stats.avgRev >= 8) strengths.push('مراجعة جيدة');
  if (stats.avgTotal >= 24) strengths.push('أداء عام مرتفع');  // v4: from 30

  if (stats.absent / (stats.lessonsCount || 1) >= 0.25) weaknesses.push('غياب متكرر');
  if (stats.avgRev < 6) weaknesses.push('المراجعة أقل من المطلوب');
  if (stats.avgMem < 6) weaknesses.push('الحفظ يحتاج تقوية');
  if (stats.avgHw < 3) weaknesses.push('الواجب ضعيف');  // v4: from 5
  if (stats.avgTotal < 15) weaknesses.push('أداء عام منخفض');  // v4: from 30

  if (strengths.length === 0) strengths.push('مستوى مقبول');
  if (weaknesses.length === 0) weaknesses.push('لا يوجد ملاحظات كبيرة');

  return { strengths, weaknesses };
}

// ===== Payments list helpers =====
export function paymentStatusFor(student: Student, month: number, year: number, payments: Payment[]): 'paid' | 'unpaid' | 'partial' | 'late' {
  const monthPayments = payments.filter(p => p.studentId === student.id && p.month === month && p.year === year);
  if (monthPayments.length === 0) {
    return student.debt > 0 ? 'late' : 'unpaid';
  }
  const totalPaid = monthPayments.reduce((s, p) => s + p.amountPaid, 0);
  if (totalPaid >= student.monthlyFee) return 'paid';
  if (totalPaid > 0) return 'partial';
  return 'unpaid';
}

// ===== v5: Unified Financial Calculations =====
export interface FinancialSummary {
  totalSubscriptions: number;      // إجمالي الاشتراكات (عدد)
  expectedTotal: number;           // إجمالي المبلغ المتوقع
  collectedTotal: number;          // إجمالي المبلغ المحصل
  outstandingTotal: number;        // إجمالي المتأخرات (expected - collected)
  paidStudentsCount: number;       // عدد المسددين
  unpaidStudentsCount: number;     // عدد غير المسددين
  studentsWithDebtCount: number;   // عدد الطلاب لديهم متأخرات
  collectionRate: number;          // نسبة التحصيل %
  outstandingRate: number;         // نسبة المتأخرات %
}

export function computeFinancialSummary(
  students: Student[],
  payments: Payment[],
  month: number,
  year: number
): FinancialSummary {
  const activeStudents = students.filter(s => s.status === 'active');
  const totalSubscriptions = activeStudents.length;
  const expectedTotal = activeStudents.reduce((sum, s) => sum + s.monthlyFee, 0);

  // Collect all payments for this month/year
  const monthPayments = payments.filter(p => p.month === month && p.year === year);
  const collectedTotal = monthPayments.reduce((sum, p) => sum + p.amountPaid, 0);

  // Outstanding = expected - collected (never negative)
  const outstandingTotal = Math.max(0, expectedTotal - collectedTotal);

  // Count paid/unpaid students
  let paidStudentsCount = 0;
  let unpaidStudentsCount = 0;
  let studentsWithDebtCount = 0;

  for (const s of activeStudents) {
    const studentPayments = monthPayments.filter(p => p.studentId === s.id);
    const studentPaid = studentPayments.reduce((sum, p) => sum + p.amountPaid, 0);
    if (studentPaid >= s.monthlyFee && s.monthlyFee > 0) {
      paidStudentsCount++;
    } else {
      unpaidStudentsCount++;
    }
    // Student has debt if they owe anything (current debt or unpaid this month)
    const remaining = Math.max(0, s.monthlyFee - studentPaid);
    if (remaining > 0 || s.debt > 0) {
      studentsWithDebtCount++;
    }
  }

  const collectionRate = expectedTotal > 0 ? Math.round((collectedTotal / expectedTotal) * 100) : 0;
  const outstandingRate = expectedTotal > 0 ? Math.round((outstandingTotal / expectedTotal) * 100) : 0;

  return {
    totalSubscriptions,
    expectedTotal,
    collectedTotal,
    outstandingTotal,
    paidStudentsCount,
    unpaidStudentsCount,
    studentsWithDebtCount,
    collectionRate,
    outstandingRate,
  };
}

// ===== v6: Unified Student Financial Status (للتطابق التام في كل الشاشات والتقارير) =====
export interface StudentFinancialStatus {
  monthlyFee: number;           // قيمة الاشتراك الشهري
  totalPaidThisMonth: number;   // إجمالي المدفوع هذا الشهر
  remaining: number;            // المتبقي هذا الشهر = monthlyFee - totalPaidThisMonth
  status: 'paid' | 'partial' | 'unpaid'; // حالة السداد
  statusAr: string;             // حالة السداد بالعربية
  totalDebt: number;            // المديونية الكلية (من حقل student.debt)
  paymentCount: number;         // عدد عمليات الدفع هذا الشهر
  lastPaymentDate: string | null; // تاريخ آخر دفعة
  lastPaymentAmount: number;    // قيمة آخر دفعة
}

export function computeStudentFinancialStatus(
  student: Student,
  payments: Payment[],
  month: number,
  year: number
): StudentFinancialStatus {
  const studentPayments = payments.filter(p => p.studentId === student.id && p.month === month && p.year === year);
  const totalPaidThisMonth = studentPayments.reduce((sum, p) => sum + p.amountPaid, 0);
  const remaining = Math.max(0, student.monthlyFee - totalPaidThisMonth);

  let status: 'paid' | 'partial' | 'unpaid';
  let statusAr: string;
  if (totalPaidThisMonth >= student.monthlyFee && student.monthlyFee > 0) {
    status = 'paid';
    statusAr = 'مسدد';
  } else if (totalPaidThisMonth > 0) {
    status = 'partial';
    statusAr = 'جزئي';
  } else {
    status = 'unpaid';
    statusAr = 'غير مسدد';
  }

  const sortedPayments = studentPayments.sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
  const lastPayment = sortedPayments[0];

  return {
    monthlyFee: student.monthlyFee,
    totalPaidThisMonth,
    remaining,
    status,
    statusAr,
    totalDebt: student.debt,
    paymentCount: studentPayments.length,
    lastPaymentDate: lastPayment?.paymentDate || null,
    lastPaymentAmount: lastPayment?.amountPaid || 0,
  };
}
