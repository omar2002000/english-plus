// ===== English Plus - Educational Center Management =====
// Types definitions

export type StudentStatus = 'active' | 'archived' | 'paused';
export type Semester = 'first' | 'second';
export type PaymentMode = 'start' | 'end'; // first of month / end of month
export type PaymentStatus = 'paid' | 'unpaid' | 'partial' | 'late' | 'exempt';
export type AttendanceStatus = 'present' | 'absent' | 'excused' | 'late';
export type GradeLabel = 'excellent' | 'very_good' | 'good' | 'acceptable' | 'weak' | 'unevaluated';

export interface Student {
  id: string;
  code: string; // 4-digit code
  name: string;
  phone: string;
  parentPhone: string;
  parentAltPhone?: string;
  grade: string; // الصف الدراسي
  subject: string; // المادة
  academicYear: string;
  semester: Semester;
  groupId: string | null;
  scheduleNote?: string; // مواعيد الحصص (نص حر)
  joinDate: string; // ISO
  monthlyFee: number;
  debt: number;
  notes?: string;
  healthNotes?: string;
  behaviorNotes?: string;
  photo?: string; // base64
  address?: string;
  school?: string;
  status: StudentStatus;
  preferredContact?: 'parent_phone' | 'student_phone' | 'alt_phone';
  lastAttendance?: string; // ISO date
  createdAt: string;
  updatedAt: string;
}

export interface Group {
  id: string;
  code: string;
  name: string;
  grade: string;
  subject: string;
  academicYear: string;
  teacherName: string;
  // ===== MODIFIED: multiple schedules supported =====
  scheduleDay: string; // primary day (backward compat)
  scheduleHour: number;
  scheduleMinute: number;
  schedulePeriod: 'am' | 'pm';
  schedules: GroupSchedule[]; // multiple schedules
  paymentMode: PaymentMode;
  startDate: string; // ISO
  lessonsPerMonth: number;
  monthlyFee: number;
  maxStudents?: number;
  notes?: string;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

// ===== NEW: Multiple group schedules =====
export interface GroupSchedule {
  id: string;
  day: string;     // السبت، الأحد...
  hour: number;    // 1-12
  minute: number;  // 0, 15, 30, 45
  period: 'am' | 'pm';
}

export interface Lesson {
  id: string;
  groupId: string;
  date: string; // ISO date (the lesson day)
  startTime?: string;
  endTime?: string;
  duration?: number; // مدة الحصة بالدقائق
  teacherName: string;
  notes?: string;
  closed: boolean; // تم حفظ الحصة
  // ===== v4: Lesson lock/status =====
  status: 'open' | 'locked' | 'closed'; // مفتوحة / مقفلة / مطوية
  lockedAt?: string; // متى تم القفل
  lockedBy?: string; // من قفل (للـ audit log)
  unlockedAt?: string; // متى تم فك القفل
  unlockedBy?: string; // من فك القفل
  closedAt?: string; // متى تم الطي
  summary?: LessonSummary; // ملخص الحصة بعد الحفظ
  createdAt: string;
}

// ===== v4: Lesson Summary =====
export interface LessonSummary {
  totalStudents: number;
  present: number;
  absent: number;
  excused: number;
  attendanceRate: number;
  avgScore: number;
  maxScore: number;
  minScore: number;
  weakCount: number;
  excellentCount: number;
}

export interface Attendance {
  id: string;
  studentId: string;
  lessonId: string;
  groupId: string;
  status: AttendanceStatus;
  excuse?: string;
  scannedAt: string; // ISO datetime
}

export interface DailyEvaluation {
  id: string;
  lessonId: string;
  studentId: string;
  attendanceScore: number; // 0-10
  memorizationScore: number; // 0-10
  reviewScore: number; // 0-10
  homeworkScore: number; // 0-10
  totalScore: number; // 0-40
  gradeLabel: GradeLabel;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  studentId: string;
  amountPaid: number;
  amountRemaining: number;
  paymentDate: string; // ISO
  month: number; // 1-12
  year: number;
  paymentMode: PaymentMode;
  invoiceNumber: string;
  notes?: string;
  createdAt: string;
}

export interface MessageLog {
  id: string;
  studentId: string;
  parentPhone: string;
  templateType: string;
  messageBody: string;
  sentAt: string;
  status: 'sent' | 'failed';
}

export interface ActivityLog {
  id: string;
  action: string;
  entity: string; // student / group / payment / attendance ...
  entityId?: string;
  details?: string;
  timestamp: string;
}

export interface Settings {
  teacherName: string;
  teacherPhone: string;
  appName: string;
  pin: string; // app lock pin
  appLockEnabled: boolean;
  autoLockMinutes: number;
  darkMode: boolean;
  absentScorePolicy: 'zero' | 'unevaluated'; // غائب = صفر أو غير مقيم
  semesterDefault: Semester;
  defaultMonthlyFee: number;
  notificationSound: boolean;
  autoDailyReport: boolean;
  // ===== NEW: Arabic/English numerals =====
  arabicNumerals: boolean;
  // ===== NEW: Smart notifications =====
  smartNotificationsEnabled: boolean;
  notifyBeforeLessonMinutes: number; // 30 default
  notifyParentBeforeLesson: boolean;
  // ===== NEW: Cloud sync (REMOVED in v3 - replaced with manual backup) =====
  cloudSyncEnabled: boolean;
  cloudSyncEncryptionKey: string;
  cloudSyncLastSync?: string;
  // ===== NEW v3: Auto weekly backup =====
  autoWeeklyBackup: boolean;
  lastAutoBackupDate?: string;
  // ===== NEW: WhatsApp Business API =====
  whatsappApiEnabled: boolean;
  whatsappApiToken: string;
  whatsappApiPhoneId: string;
  whatsappAutoMessages: {
    beforeLesson: boolean;
    absenceAlert: boolean;
    paymentReminder: boolean;
    paymentConfirm: boolean;
    monthlyCertificate: boolean;
    birthday: boolean;
    topStudent: boolean;
  };
  // ===== NEW: Voice control =====
  voiceControlEnabled: boolean;
  // ===== NEW: AR cards =====
  arCardsEnabled: boolean;
  // ===== NEW: Smart recommendations =====
  smartRecommendationsEnabled: boolean;
  // ===== NEW v3: PIN security =====
  pinChangedFromDefault: boolean; // must change 1234 on first use
  // Color theme per section
  colors: {
    dashboard: string;
    students: string;
    groups: string;
    attendance: string;
    todayClass: string;
    subscriptions: string;
    reports: string;
    whatsapp: string;
    settings: string;
  };
}

// ===== NEW: Packages & Scholarships =====
export type PackageType =
  | 'siblings'      // باقة الإخوة 10%
  | 'commitment'    // باقة الالتزام 15% (حضور 90%+)
  | 'excellence'    // باقة التفوق 20% (ممتاز)
  | 'yearly'        // باقة السنة (شهر مجاني لـ 6 شهور مقدماً)
  | 'scholarship'   // منحة كاملة
  | 'custom';       // خصم مخصص

export interface Package {
  id: string;
  type: PackageType;
  studentId: string;
  discountPercent: number; // 0-100
  reason: string;
  startDate: string;
  endDate?: string;
  active: boolean;
  createdAt: string;
}

// ===== NEW: Smart Notification =====
export interface SmartNotification {
  id: string;
  type: 'lesson_reminder' | 'absence_alert' | 'payment_reminder' | 'payment_confirm' | 'monthly_certificate' | 'birthday' | 'top_student' | 'recommendation';
  title: string;
  body: string;
  targetId?: string; // student/group id
  targetType?: 'student' | 'group' | 'teacher';
  scheduledFor?: string;
  sent: boolean;
  read: boolean;
  createdAt: string;
}

// ===== NEW: Cloud sync session =====
export interface CloudSyncSession {
  id: string;
  deviceName: string;
  lastSync: string;
  dataHash: string;
  encrypted: boolean;
}

// ===== NEW: Parent app token (with expiration + open count) =====
export interface ParentToken {
  token: string;
  studentId: string;
  createdAt: string;
  expiresAt?: string;       // optional expiration date
  maxOpens?: number;        // optional limit on number of opens
  opensCount: number;       // current open count
  active: boolean;
}

// ===== NEW: Voice command log =====
export interface VoiceCommandLog {
  id: string;
  transcript: string;
  action: string;
  success: boolean;
  timestamp: string;
}

// ===== NEW v3: PIN attempt tracking =====
export interface PinAttempt {
  id: string;
  timestamp: string;
  success: boolean;
  // Lockout state
  failedCount: number;     // total failed attempts in current window
  lockedUntil?: string;    // ISO datetime when lock expires
}

export interface WhatsappTemplate {
  key: string;
  title: string;
  body: string;
  icon: string;
}
