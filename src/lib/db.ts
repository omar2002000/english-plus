// ===== English Plus - Database Layer (Dexie/IndexedDB) =====
import Dexie, { type Table } from 'dexie';
import type {
  Student, Group, Lesson, Attendance, DailyEvaluation,
  Payment, MessageLog, ActivityLog, Settings
} from './types';

class EnglishPlusDB extends Dexie {
  students!: Table<Student, string>;
  groups!: Table<Group, string>;
  lessons!: Table<Lesson, string>;
  attendance!: Table<Attendance, string>;
  evaluations!: Table<DailyEvaluation, string>;
  payments!: Table<Payment, string>;
  messages!: Table<MessageLog, string>;
  activities!: Table<ActivityLog, string>;
  // NEW tables
  packages!: Table<import('./types').Package, string>;
  notifications!: Table<import('./types').SmartNotification, string>;
  parentTokens!: Table<import('./types').ParentToken, string>;
  voiceLogs!: Table<import('./types').VoiceCommandLog, string>;
  pinAttempts!: Table<import('./types').PinAttempt, string>;

  constructor() {
    super('EnglishPlusDB');
    this.version(1).stores({
      students: 'id, code, name, grade, groupId, status, academicYear',
      groups: 'id, code, name, grade, academicYear, archived',
      lessons: 'id, groupId, date, closed',
      attendance: 'id, studentId, lessonId, groupId, status, scannedAt',
      evaluations: 'id, lessonId, studentId, createdAt',
      payments: 'id, studentId, month, year, paymentMode, paymentDate',
      messages: 'id, studentId, sentAt, status',
      activities: 'id, timestamp, entity, entityId',
    });
    this.version(2).stores({
      students: 'id, code, name, grade, groupId, status, academicYear',
      groups: 'id, code, name, grade, academicYear, archived',
      lessons: 'id, groupId, date, closed',
      attendance: 'id, studentId, lessonId, groupId, status, scannedAt',
      evaluations: 'id, lessonId, studentId, createdAt',
      payments: 'id, studentId, month, year, paymentMode, paymentDate',
      messages: 'id, studentId, sentAt, status',
      activities: 'id, timestamp, entity, entityId',
      packages: 'id, studentId, type, active, createdAt',
      notifications: 'id, type, targetId, sent, read, createdAt, scheduledFor',
      parentTokens: 'token, studentId, active, createdAt',
      voiceLogs: 'id, timestamp, success',
    });
    // v3: add pinAttempts table
    this.version(3).stores({
      students: 'id, code, name, grade, groupId, status, academicYear',
      groups: 'id, code, name, grade, academicYear, archived',
      lessons: 'id, groupId, date, closed',
      attendance: 'id, studentId, lessonId, groupId, status, scannedAt',
      evaluations: 'id, lessonId, studentId, createdAt',
      payments: 'id, studentId, month, year, paymentMode, paymentDate',
      messages: 'id, studentId, sentAt, status',
      activities: 'id, timestamp, entity, entityId',
      packages: 'id, studentId, type, active, createdAt',
      notifications: 'id, type, targetId, sent, read, createdAt, scheduledFor',
      parentTokens: 'token, studentId, active, createdAt',
      voiceLogs: 'id, timestamp, success',
      pinAttempts: 'id, timestamp, success',
    });
    // v6: add parentPhone index for packages eligibility check
    this.version(4).stores({
      students: 'id, code, name, grade, groupId, status, academicYear, parentPhone',
      groups: 'id, code, name, grade, academicYear, archived',
      lessons: 'id, groupId, date, closed',
      attendance: 'id, studentId, lessonId, groupId, status, scannedAt',
      evaluations: 'id, lessonId, studentId, createdAt',
      payments: 'id, studentId, month, year, paymentMode, paymentDate',
      messages: 'id, studentId, sentAt, status',
      activities: 'id, timestamp, entity, entityId',
      packages: 'id, studentId, type, active, createdAt',
      notifications: 'id, type, targetId, sent, read, createdAt, scheduledFor',
      parentTokens: 'token, studentId, active, createdAt',
      voiceLogs: 'id, timestamp, success',
      pinAttempts: 'id, timestamp, success',
    });
  }
}

let _db: EnglishPlusDB | null = null;

export function getDB(): EnglishPlusDB {
  if (typeof window === 'undefined') {
    // SSR safety
    throw new Error('DB can only be used on client');
  }
  if (!_db) {
    _db = new EnglishPlusDB();
  }
  return _db;
}

// ===== Activity Logger =====
export async function logActivity(action: string, entity: string, entityId?: string, details?: string) {
  try {
    const db = getDB();
    await db.activities.add({
      id: crypto.randomUUID(),
      action,
      entity,
      entityId,
      details,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('logActivity failed', e);
  }
}

// ===== Code Generator (4-digit unique) =====
export async function generateUniqueStudentCode(): Promise<string> {
  const db = getDB();
  let code = '';
  let attempts = 0;
  while (attempts < 100) {
    code = String(Math.floor(1000 + Math.random() * 9000));
    const existing = await db.students.where('code').equals(code).first();
    if (!existing) return code;
    attempts++;
  }
  return String(Date.now()).slice(-4);
}

// ===== Invoice number generator =====
export async function generateInvoiceNumber(): Promise<string> {
  const db = getDB();
  const year = new Date().getFullYear();
  const count = await db.payments.count();
  return `INV-${year}-${String(count + 1).padStart(4, '0')}`;
}

// ===== Seed data (DISABLED in v3 - app starts empty) =====
// Keeping the function for manual seeding if user requests it
export async function seedDemoData() {
  const db = getDB();
  const count = await db.groups.count();
  if (count > 0) return; // already seeded

  const now = new Date().toISOString();
  const groups: Group[] = [
    {
      id: crypto.randomUUID(),
      code: 'G001',
      name: 'مجموعة الصف الأول الثانوي',
      grade: 'الأول الثانوي',
      subject: 'اللغة الإنجليزية',
      academicYear: '2025/2026',
      teacherName: 'مستر نصر علي',
      scheduleDay: 'السبت',
      scheduleHour: 4,
      scheduleMinute: 0,
      schedulePeriod: 'pm',
      schedules: [
        { id: crypto.randomUUID(), day: 'السبت', hour: 4, minute: 0, period: 'pm' as const },
        { id: crypto.randomUUID(), day: 'الثلاثاء', hour: 4, minute: 0, period: 'pm' as const },
      ],
      paymentMode: 'end',
      startDate: now,
      lessonsPerMonth: 8,
      monthlyFee: 300,
      maxStudents: 20,
      archived: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      code: 'G002',
      name: 'مجموعة الصف الثاني الثانوي',
      grade: 'الثاني الثانوي',
      subject: 'اللغة الإنجليزية',
      academicYear: '2025/2026',
      teacherName: 'مستر نصر علي',
      scheduleDay: 'الأحد',
      scheduleHour: 5,
      scheduleMinute: 30,
      schedulePeriod: 'pm',
      schedules: [
        { id: crypto.randomUUID(), day: 'الأحد', hour: 5, minute: 30, period: 'pm' as const },
        { id: crypto.randomUUID(), day: 'الأربعاء', hour: 5, minute: 30, period: 'pm' as const },
      ],
      paymentMode: 'start',
      startDate: now,
      lessonsPerMonth: 8,
      monthlyFee: 350,
      maxStudents: 15,
      archived: false,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      code: 'G003',
      name: 'مجموعة الصف الثالث الإعدادي',
      grade: 'الثالث الإعدادي',
      subject: 'اللغة الإنجليزية',
      academicYear: '2025/2026',
      teacherName: 'مستر نصر علي',
      scheduleDay: 'الاثنين',
      scheduleHour: 6,
      scheduleMinute: 0,
      schedulePeriod: 'pm',
      schedules: [
        { id: crypto.randomUUID(), day: 'الاثنين', hour: 6, minute: 0, period: 'pm' as const },
      ],
      paymentMode: 'end',
      startDate: now,
      lessonsPerMonth: 8,
      monthlyFee: 250,
      maxStudents: 18,
      archived: false,
      createdAt: now,
      updatedAt: now,
    },
  ];
  await db.groups.bulkAdd(groups);

  const sampleStudents: Omit<Student, 'id' | 'code' | 'createdAt' | 'updatedAt'>[] = [
    { name: 'أحمد محمد علي', phone: '01012345678', parentPhone: '01112345678', grade: 'الأول الثانوي', subject: 'اللغة الإنجليزية', academicYear: '2025/2026', semester: 'first', groupId: groups[0].id, joinDate: now, monthlyFee: 300, debt: 0, status: 'active', notes: 'طالب متميز' },
    { name: 'محمود إبراهيم حسن', phone: '01023456789', parentPhone: '01123456789', grade: 'الأول الثانوي', subject: 'اللغة الإنجليزية', academicYear: '2025/2026', semester: 'first', groupId: groups[0].id, joinDate: now, monthlyFee: 300, debt: 300, status: 'active', notes: '' },
    { name: 'سارة أحمد خالد', phone: '01034567890', parentPhone: '01134567890', grade: 'الأول الثانوي', subject: 'اللغة الإنجليزية', academicYear: '2025/2026', semester: 'first', groupId: groups[0].id, joinDate: now, monthlyFee: 300, debt: 0, status: 'active', notes: '' },
    { name: 'يوسف عبد الله محمد', phone: '01045678901', parentPhone: '01145678901', grade: 'الثاني الثانوي', subject: 'اللغة الإنجليزية', academicYear: '2025/2026', semester: 'first', groupId: groups[1].id, joinDate: now, monthlyFee: 350, debt: 0, status: 'active', notes: '' },
    { name: 'ملكة أحمد فؤاد', phone: '01056789012', parentPhone: '01156789012', grade: 'الثاني الثانوي', subject: 'اللغة الإنجليزية', academicYear: '2025/2026', semester: 'first', groupId: groups[1].id, joinDate: now, monthlyFee: 350, debt: 350, status: 'active', notes: '' },
    { name: 'عمر خالد سعيد', phone: '01067890123', parentPhone: '01167890123', grade: 'الثالث الإعدادي', subject: 'اللغة الإنجليزية', academicYear: '2025/2026', semester: 'first', groupId: groups[2].id, joinDate: now, monthlyFee: 250, debt: 0, status: 'active', notes: '' },
    { name: 'فاطمة محمد عبد الرحمن', phone: '01078901234', parentPhone: '01178901234', grade: 'الثالث الإعدادي', subject: 'اللغة الإنجليزية', academicYear: '2025/2026', semester: 'first', groupId: groups[2].id, joinDate: now, monthlyFee: 250, debt: 0, status: 'paused', notes: 'متوقفة مؤقتاً' },
    { name: 'علي حسن إبراهيم', phone: '01089012345', parentPhone: '01189012345', grade: 'الأول الثانوي', subject: 'اللغة الإنجليزية', academicYear: '2025/2026', semester: 'first', groupId: groups[0].id, joinDate: now, monthlyFee: 300, debt: 0, status: 'active', notes: '' },
  ];

  for (const s of sampleStudents) {
    const code = await generateUniqueStudentCode();
    const student: Student = {
      ...s,
      id: crypto.randomUUID(),
      code,
      createdAt: now,
      updatedAt: now,
    };
    await db.students.add(student);
  }

  await logActivity('seed', 'system', undefined, 'تم إضافة بيانات تجريبية');
}

// ===== NEW v3: Manual seed (optional - user-triggered from settings) =====
export async function addDemoDataManually() {
  await seedDemoData();
}

// ===== NEW v3: Check if app is empty (first run) =====
export async function isAppEmpty(): Promise<boolean> {
  const db = getDB();
  const studentCount = await db.students.count();
  const groupCount = await db.groups.count();
  return studentCount === 0 && groupCount === 0;
}

// ===== Settings (localStorage) =====
const SETTINGS_KEY = 'english_plus_settings_v1';

export const DEFAULT_SETTINGS: Settings = {
  teacherName: 'مستر نصر علي',
  teacherPhone: '01220765121',
  appName: 'English Plus',
  pin: '1234',
  appLockEnabled: false,
  autoLockMinutes: 5,
  darkMode: false,
  absentScorePolicy: 'zero',
  semesterDefault: 'first',
  defaultMonthlyFee: 300,
  notificationSound: true,
  autoDailyReport: false,
  // NEW
  arabicNumerals: true,
  smartNotificationsEnabled: true,
  notifyBeforeLessonMinutes: 30,
  notifyParentBeforeLesson: true,
  cloudSyncEnabled: false,
  cloudSyncEncryptionKey: '',
  // NEW v3
  autoWeeklyBackup: true,
  whatsappApiEnabled: false,
  whatsappApiToken: '',
  whatsappApiPhoneId: '',
  whatsappAutoMessages: {
    beforeLesson: true,
    absenceAlert: true,
    paymentReminder: true,
    paymentConfirm: true,
    monthlyCertificate: false,
    birthday: true,
    topStudent: true,
  },
  voiceControlEnabled: false,
  arCardsEnabled: false,
  smartRecommendationsEnabled: true,
  // NEW v3: PIN security
  pinChangedFromDefault: false,
  colors: {
    dashboard: '#2563eb',
    students: '#7c3aed',
    groups: '#16a34a',
    attendance: '#ea580c',
    todayClass: '#0891b2',
    subscriptions: '#d97706',
    reports: '#64748b',
    whatsapp: '#15803d',
    settings: '#334155',
  },
};

export function loadSettings(): Settings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed, colors: { ...DEFAULT_SETTINGS.colors, ...(parsed.colors || {}) } };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

// ===== Backup / Restore =====
export async function exportBackup(): Promise<string> {
  const db = getDB();
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    students: await db.students.toArray(),
    groups: await db.groups.toArray(),
    lessons: await db.lessons.toArray(),
    attendance: await db.attendance.toArray(),
    evaluations: await db.evaluations.toArray(),
    payments: await db.payments.toArray(),
    messages: await db.messages.toArray(),
    activities: await db.activities.toArray(),
    settings: loadSettings(),
  };
  return JSON.stringify(data, null, 2);
}

export async function importBackup(json: string): Promise<void> {
  const data = JSON.parse(json);
  const db = getDB();
  await db.transaction('rw', db.students, db.groups, db.lessons, db.attendance, db.evaluations, db.payments, db.messages, db.activities, async () => {
    await db.students.clear();
    await db.groups.clear();
    await db.lessons.clear();
    await db.attendance.clear();
    await db.evaluations.clear();
    await db.payments.clear();
    await db.messages.clear();
    await db.activities.clear();
    if (data.students) await db.students.bulkAdd(data.students);
    if (data.groups) await db.groups.bulkAdd(data.groups);
    if (data.lessons) await db.lessons.bulkAdd(data.lessons);
    if (data.attendance) await db.attendance.bulkAdd(data.attendance);
    if (data.evaluations) await db.evaluations.bulkAdd(data.evaluations);
    if (data.payments) await db.payments.bulkAdd(data.payments);
    if (data.messages) await db.messages.bulkAdd(data.messages);
    if (data.activities) await db.activities.bulkAdd(data.activities);
    if (data.settings) saveSettings(data.settings);
  });
}

export async function clearAllData(): Promise<void> {
  const db = getDB();
  await db.transaction('rw', db.students, db.groups, db.lessons, db.attendance, db.evaluations, db.payments, db.messages, db.activities, async () => {
    await db.students.clear();
    await db.groups.clear();
    await db.lessons.clear();
    await db.attendance.clear();
    await db.evaluations.clear();
    await db.payments.clear();
    await db.messages.clear();
    await db.activities.clear();
  });
}
