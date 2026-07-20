// ===== English Plus - Today's Class (v4 - COMPLETE with all 23 requirements) =====
'use client';
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/lib/store';
import { getDB, logActivity } from '@/lib/db';
import type { Group, Student, Lesson, Attendance, DailyEvaluation, GradeLabel, LessonSummary } from '@/lib/types';
import { gradeFromTotal, GRADE_LABELS_AR, GRADE_COLORS, computeTotal, formatArDate, arDayName, scheduleText, getGroupDays, formatMoney, whatsappLink, fillTemplate, WHATSAPP_TEMPLATES, MAX_TOTAL_SCORE, WEAK_THRESHOLD } from '@/lib/helpers';
import { SearchBar, EmptyState } from '@/components/ui-shared';
import { ScanLine, Save, BookOpen, ChevronLeft, Filter, ArrowUpDown, MessageCircle, FileDown, Send, Check, AlertCircle, Lock, Unlock, X, Users, CalendarDays, Clock, TrendingUp, Award, FileText, ChevronDown, UserPlus, UserMinus, CheckSquare, Square, FolderX, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

const QUICK_NOTES = [
  'ممتاز اليوم',
  'يحتاج مراجعة',
  'لم يحل الواجب كاملاً',
  'متأخر في الحضور',
  'مستواه في تحسن',
  'مشاركة جيدة',
  'غير منتبه',
  'أداء رائع',
];

export function TodayClassScreen() {
  const { params, navigate, settings, refreshKey, triggerRefresh, back } = useApp();
  // Step 1: Day/Date selection
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  // Step 2: Group selection
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  // Quick mode: auto-select today's group
  const [quickMode, setQuickMode] = useState(params.quick === '1');
  // Data
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [evaluations, setEvaluations] = useState<DailyEvaluation[]>([]);
  // UI state
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'present' | 'absent' | 'excused' | 'weak' | 'excellent' | 'needs_followup'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'score' | 'absence' | 'level' | 'last_eval'>('name');
  const [globalNote, setGlobalNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState<LessonSummary | null>(null);
  const [excludedStudents, setExcludedStudents] = useState<Set<string>>(new Set());
  const [addedStudents, setAddedStudents] = useState<Set<string>>(new Set());
  const [showStudentManager, setShowStudentManager] = useState(false);
  const [showNotePicker, setShowNotePicker] = useState<string | null>(null); // studentId
  const [pinDialog, setPinDialog] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [focusMode, setFocusMode] = useState(false); // v6: Focus Mode
  const [lessonTimer, setLessonTimer] = useState(0); // v7: Lesson Timer

  // Derived state (declared early so any useEffect / handler can use them safely)
  const selectedGroup = groups.find(g => g.id === selectedGroupId);
  const isLocked = lesson?.status === 'locked';
  const isClosed = lesson?.status === 'closed';

  // Load groups
  useEffect(() => {
    (async () => {
      const db = getDB();
      const g = await db.groups.toArray();
      const activeGroups = g.filter(g => !g.archived);
      setGroups(activeGroups);
      // Quick mode: auto-select the group that has a lesson today
      if (quickMode && !selectedGroupId) {
        const todayArDay = arDayName(new Date());
        const todayGroups = activeGroups.filter(grp => getGroupDays(grp).includes(todayArDay));
        if (todayGroups.length === 1) {
          setSelectedGroupId(todayGroups[0].id);
          setQuickMode(false);
        }
      }
    })();
  }, [refreshKey, quickMode, selectedGroupId]);

  // Load lesson + students + data when group selected
  useEffect(() => {
    if (!selectedGroupId) return;
    (async () => {
      const db = getDB();
      const group = await db.groups.get(selectedGroupId);
      // Find or create lesson for selected date
      let les = await db.lessons.where('groupId').equals(selectedGroupId).toArray();
      let dateLesson = les.find(l => l.date.split('T')[0] === selectedDate);
      if (!dateLesson) {
        dateLesson = {
          id: crypto.randomUUID(),
          groupId: selectedGroupId,
          date: new Date(selectedDate).toISOString(),
          teacherName: group?.teacherName || '',
          closed: false,
          status: 'open',
          duration: group?.lessonsPerMonth ? 90 : 90, // default 90 min
          createdAt: new Date().toISOString(),
        };
        await db.lessons.add(dateLesson);
      }
      setLesson(dateLesson);
      // v7: Start lesson timer
      setLessonTimer(0);
      const [sts, allSts, atts, evs] = await Promise.all([
        db.students.where('groupId').equals(selectedGroupId).toArray(),
        db.students.toArray(),
        db.attendance.where('lessonId').equals(dateLesson.id).toArray(),
        db.evaluations.where('lessonId').equals(dateLesson.id).toArray(),
      ]);
      setStudents(sts.filter(s => s.status === 'active').sort((a, b) => a.name.localeCompare(b.name, 'ar')));
      setAllStudents(allSts);
      setAttendances(atts);
      setEvaluations(evs);
      // If lesson is closed, show summary
      if (dateLesson.closed && dateLesson.summary) {
        setSummary(dateLesson.summary);
      }
    })();
  }, [selectedGroupId, selectedDate, refreshKey]);

  function getEval(studentId: string): DailyEvaluation | undefined {
    return evaluations.find(e => e.studentId === studentId);
  }
  function getAttendance(studentId: string): Attendance | undefined {
    return attendances.find(a => a.studentId === studentId);
  }

  function updateScore(studentId: string, field: 'attendanceScore' | 'memorizationScore' | 'reviewScore' | 'homeworkScore', value: number) {
    setEvaluations(prev => {
      const idx = prev.findIndex(e => e.studentId === studentId);
      const existing = idx >= 0 ? { ...prev[idx] } : {
        id: crypto.randomUUID(),
        lessonId: lesson!.id,
        studentId,
        attendanceScore: 0, memorizationScore: 0, reviewScore: 0, homeworkScore: 0,
        totalScore: 0,
        gradeLabel: 'unevaluated' as GradeLabel,
        note: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      existing[field] = value;
      existing.totalScore = computeTotal(existing.attendanceScore, existing.memorizationScore, existing.reviewScore, existing.homeworkScore);
      existing.gradeLabel = gradeFromTotal(existing.totalScore);
      existing.updatedAt = new Date().toISOString();
      const next = idx >= 0 ? [...prev] : [...prev, existing];
      if (idx >= 0) next[idx] = existing;
      return next;
    });
  }

  async function markAttendance(studentId: string, status: 'present' | 'absent' | 'excused') {
    if (!lesson) return;
    const db = getDB();
    const now = new Date();
    // v6: Smart attendance — check if late (more than 10 min after lesson start)
    let actualStatus: 'present' | 'absent' | 'excused' | 'late' = status;
    if (status === 'present' && selectedGroup) {
      const grp = selectedGroup;
      let lessonHour = grp.scheduleHour;
      if (grp.schedulePeriod === 'pm' && lessonHour < 12) lessonHour += 12;
      const lessonStart = new Date();
      lessonStart.setHours(lessonHour, grp.scheduleMinute, 0, 0);
      const diffMin = (now.getTime() - lessonStart.getTime()) / 60000;
      if (diffMin > 10) {
        actualStatus = 'late';
      }
    }
    const existing = attendances.find(a => a.studentId === studentId);
    if (existing) {
      await db.attendance.update(existing.id, { status: actualStatus as any, scannedAt: now.toISOString() });
      setAttendances(prev => prev.map(a => a.id === existing.id ? { ...a, status: actualStatus as any } : a));
    } else {
      const att: Attendance = {
        id: crypto.randomUUID(),
        studentId, lessonId: lesson.id, groupId: lesson.groupId,
        status: actualStatus as any, scannedAt: now.toISOString(),
      };
      await db.attendance.add(att);
      setAttendances(prev => [...prev, att]);
      await db.students.update(studentId, { lastAttendance: now.toISOString() });
    }
    // v6: Auto-set attendance score based on status
    if (actualStatus === 'present') {
      const ev = getEval(studentId);
      if (!ev || ev.attendanceScore === 0) {
        updateScore(studentId, 'attendanceScore', 5);
      }
    } else if (actualStatus === 'late') {
      // v6: Late = deduct 2 points (5 - 2 = 3)
      updateScore(studentId, 'attendanceScore', 3);
      toast.info(`طالب متأخر — تم خصم 2 من درجة الحضور`);
    } else {
      updateScore(studentId, 'attendanceScore', 0);
    }
  }

  async function handlePinSubmit() {
    if (!lesson) return;
    const student = students.find(s => s.code === pinInput);
    if (!student) { toast.error('الكود غير صحيح'); return; }
    await markAttendance(student.id, 'present');
    toast.success(`حضر: ${student.name}`);
    setPinInput(''); setPinDialog(false);
  }

  // v7: Lesson timer tick
  useEffect(() => {
    if (!selectedGroupId || isLocked) return;
    const interval = setInterval(() => {
      setLessonTimer(prev => prev + 1);
    }, 60000); // every minute
    return () => clearInterval(interval);
  }, [selectedGroupId, isLocked]);

  // Format timer
  const timerDisplay = `${Math.floor(lessonTimer / 60)}:${String(lessonTimer % 60).padStart(2, '0')}`;

  // Filter + sort
  const activeStudents = useMemo(() => {
    let list = students.filter(s => !excludedStudents.has(s.id));
    // Add manually added students
    const added = allStudents.filter(s => addedStudents.has(s.id) && !excludedStudents.has(s.id) && s.status === 'active');
    list = [...list, ...added];
    if (search.trim()) {
      const q = search.trim();
      list = list.filter(s => s.name.includes(q) || s.code.includes(q));
    }
    if (filter !== 'all') {
      list = list.filter(s => {
        const att = getAttendance(s.id);
        const ev = getEval(s.id);
        if (filter === 'present') return att?.status === 'present';
        if (filter === 'absent') return !att || att.status === 'absent';
        if (filter === 'excused') return att?.status === 'excused';
        if (filter === 'weak') return ev && ev.totalScore < WEAK_THRESHOLD;
        if (filter === 'excellent') return ev && ev.totalScore >= 27;
        if (filter === 'needs_followup') return ev && ev.totalScore < WEAK_THRESHOLD && ev.totalScore > 0;
        return true;
      });
    }
    list.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name, 'ar');
      if (sortBy === 'score') return (getEval(b.id)?.totalScore || 0) - (getEval(a.id)?.totalScore || 0);
      if (sortBy === 'absence') {
        const aAbs = getAttendance(a.id)?.status === 'absent' ? 1 : 0;
        const bAbs = getAttendance(b.id)?.status === 'absent' ? 1 : 0;
        return bAbs - aAbs;
      }
      if (sortBy === 'level') return (getEval(a.id)?.totalScore || 0) - (getEval(b.id)?.totalScore || 0);
      if (sortBy === 'last_eval') {
        const aEv = getEval(a.id);
        const bEv = getEval(b.id);
        if (!aEv && !bEv) return 0;
        if (!aEv) return 1;
        if (!bEv) return -1;
        return bEv.updatedAt.localeCompare(aEv.updatedAt);
      }
      return 0;
    });
    return list;
  }, [students, allStudents, excludedStudents, addedStudents, search, filter, sortBy, attendances, evaluations]);

  // Stats
  const stats = useMemo(() => {
    const total = activeStudents.length;
    const present = attendances.filter(a => a.status === 'present' && activeStudents.some(s => s.id === a.studentId)).length;
    const absent = attendances.filter(a => a.status === 'absent' && activeStudents.some(s => s.id === a.studentId)).length;
    const excused = attendances.filter(a => a.status === 'excused' && activeStudents.some(s => s.id === a.studentId)).length;
    const evaluated = evaluations.length;
    const weakCount = evaluations.filter(e => e.totalScore < WEAK_THRESHOLD).length;
    const excellentCount = evaluations.filter(e => e.totalScore >= 27).length;
    const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;
    return { total, present, absent, excused, evaluated, weakCount, excellentCount, attendanceRate };
  }, [activeStudents, attendances, evaluations]);

  // Check if student is new (joined within 7 days)
  function isNewStudent(studentId: string): boolean {
    const s = students.find(s => s.id === studentId) || allStudents.find(s => s.id === studentId);
    if (!s || !s.joinDate) return false;
    const joinDate = new Date(s.joinDate);
    const daysSince = (Date.now() - joinDate.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince <= 7;
  }

  // ===== SAVE LESSON (with lock + summary) =====
  async function handleSave() {
    if (!lesson) return;
    setSaving(true);
    try {
      const db = getDB();
      const now = new Date().toISOString();
      // Mark absent students with 0 if policy is 'zero'
      for (const s of activeStudents) {
        const att = attendances.find(a => a.studentId === s.id);
        if (!att || att.status === 'absent') {
          if (settings.absentScorePolicy === 'zero') {
            const existing = getEval(s.id);
            const ev: DailyEvaluation = existing ? { ...existing } : {
              id: crypto.randomUUID(), lessonId: lesson.id, studentId: s.id,
              attendanceScore: 0, memorizationScore: 0, reviewScore: 0, homeworkScore: 0,
              totalScore: 0, gradeLabel: 'unevaluated', note: 'غائب',
              createdAt: now, updatedAt: now,
            };
            ev.note = 'غائب';
            ev.updatedAt = now;
            await db.evaluations.put(ev);
          }
        } else {
          const ev = getEval(s.id);
          if (ev) await db.evaluations.put({ ...ev, note: ev.note || globalNote, updatedAt: now });
        }
      }
      // Compute summary
      const scores = evaluations.filter(e => e.totalScore > 0).map(e => e.totalScore);
      const sum: LessonSummary = {
        totalStudents: activeStudents.length,
        present: stats.present,
        absent: stats.absent,
        excused: stats.excused,
        attendanceRate: stats.attendanceRate,
        avgScore: scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0,
        maxScore: scores.length > 0 ? Math.max(...scores) : 0,
        minScore: scores.length > 0 ? Math.min(...scores) : 0,
        weakCount: stats.weakCount,
        excellentCount: stats.excellentCount,
      };
      // Lock the lesson
      await db.lessons.update(lesson.id, {
        closed: true,
        status: 'locked',
        lockedAt: now,
        lockedBy: settings.teacherName,
        notes: globalNote,
        summary: sum,
      });
      await logActivity('save_lesson', 'lesson', lesson.id, `حفظ وقفل حصة ${formatArDate(lesson.date)}`);
      setSummary(sum);
      setShowSummary(true);
      toast.success('تم حفظ الحصة بنجاح');
      triggerRefresh();
    } catch (e) {
      console.error(e);
      toast.error('فشل الحفظ');
    } finally {
      setSaving(false);
    }
  }

  // ===== UNLOCK LESSON =====
  async function handleUnlock() {
    if (!lesson) return;
    if (!confirm('سيتم فك قفل الحصة للتعديل. متابعة؟')) return;
    const db = getDB();
    const now = new Date().toISOString();
    await db.lessons.update(lesson.id, {
      status: 'open',
      unlockedAt: now,
      unlockedBy: settings.teacherName,
    });
    await logActivity('unlock_lesson', 'lesson', lesson.id, `فك قفل حصة ${formatArDate(lesson.date)}`);
    toast.success('تم فك القفل - يمكنك التعديل الآن');
    setLesson({ ...lesson, status: 'open' });
    setSummary(null);
  }

  // ===== RE-LOCK LESSON =====
  async function handleRelock() {
    if (!lesson) return;
    const db = getDB();
    const now = new Date().toISOString();
    await db.lessons.update(lesson.id, {
      status: 'locked',
      lockedAt: now,
      lockedBy: settings.teacherName,
    });
    await logActivity('relock_lesson', 'lesson', lesson.id, `إعادة قفل حصة ${formatArDate(lesson.date)}`);
    toast.success('تم إعادة القفل');
    setLesson({ ...lesson, status: 'locked' });
  }

  // ===== CLOSE/FOLD LESSON (طي الحصة) =====
  async function handleClose() {
    if (!lesson) return;
    if (!confirm('سيتم طي الحصة ونقلها لسجل الحصص السابقة. متابعة؟')) return;
    const db = getDB();
    const now = new Date().toISOString();
    await db.lessons.update(lesson.id, {
      status: 'closed',
      closedAt: now,
    });
    await logActivity('close_lesson', 'lesson', lesson.id, `طي حصة ${formatArDate(lesson.date)}`);
    toast.success('تم طي الحصة');
    // Reset to group selection
    setSelectedGroupId('');
    setLesson(null);
    setStudents([]);
    setAttendances([]);
    setEvaluations([]);
    setSummary(null);
    setShowSummary(false);
  }

  // ===== SEND DAILY REPORT =====
  async function sendDailyReport(student: Student) {
    if (!lesson) return;
    const ev = getEval(student.id);
    const att = getAttendance(student.id);
    const status = att?.status === 'absent' ? 'غائب' : att?.status === 'excused' ? 'غياب بعذر' : 'حاضر';
    const grade = ev ? GRADE_LABELS_AR[ev.gradeLabel] : status;
    const gradeIcon = ev?.gradeLabel === 'excellent' ? '⭐' : ev?.gradeLabel === 'very_good' ? '✨' : ev?.gradeLabel === 'good' ? '👍' : ev?.gradeLabel === 'acceptable' ? '😐' : ev?.gradeLabel === 'weak' ? '⚠️' : '—';
    // v5: Enhanced message with emojis and parent address
    const body = `📋 تقرير حصة اليوم - ${settings.appName}

👨‍👩‍👦 ولي أمر الطالب: ${student.name}

📅 التاريخ: ${formatArDate(new Date())}

✅ الحضور: ${ev?.attendanceScore || 0}/5
📖 الحفظ: ${ev?.memorizationScore || 0}/10
🔄 المراجعة: ${ev?.reviewScore || 0}/10
📝 الواجب: ${ev?.homeworkScore || 0}/5

🏆 المجموع: ${ev?.totalScore || 0}/30
📊 التقدير: ${gradeIcon} ${grade}
${ev?.note ? `\n💬 ملاحظة المعلم: ${ev.note}` : ''}

مع تحياتي 🙏
${settings.teacherName}
📞 ${settings.teacherPhone}`;
    window.open(whatsappLink(student.parentPhone, body), '_blank');
    const db = getDB();
    await db.messages.add({
      id: crypto.randomUUID(), studentId: student.id, parentPhone: student.parentPhone,
      templateType: 'daily_report', messageBody: body, sentAt: new Date().toISOString(), status: 'sent',
    });
    toast.success(`تم إرسال التقرير لولي أمر ${student.name}`);
  }

  // ===== DOWNLOAD DAILY REPORT =====
  async function downloadDailyReport(student: Student) {
    if (!lesson) return;
    const ev = getEval(student.id);
    const att = getAttendance(student.id);
    const status = att?.status === 'absent' ? 'غائب' : att?.status === 'excused' ? 'غياب بعذر' : 'حاضر';
    const group = groups.find(g => g.id === selectedGroupId) || null;
    const { generateDailyReportPDF, downloadBlob } = await import('@/lib/documents');
    const blob = await generateDailyReportPDF(student, lesson, group, ev || null, status, settings);
    downloadBlob(blob, `daily-${student.code}.pdf`);
  }

  // ===== EXCLUDE/INCLUDE STUDENT =====
  function toggleExclude(studentId: string) {
    setExcludedStudents(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId); else next.add(studentId);
      return next;
    });
  }

  // ===== ADD STUDENT TO LESSON =====
  function toggleAddStudent(studentId: string) {
    setAddedStudents(prev => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId); else next.add(studentId);
      return next;
    });
  }

  // ===== RENDER =====
  if (groups.length === 0) {
    return <EmptyState title="لا توجد مجموعات" subtitle="أنشئ مجموعة أولاً" icon={<BookOpen className="w-10 h-10" />} />;
  }

  // ===== STEP 1: Date + Group Selection =====
  if (!selectedGroupId) {
    const arDay = arDayName(new Date(selectedDate));
    const todayGroups = groups.filter(g => getGroupDays(g).includes(arDay));
    return (
      <div className="p-4 space-y-4 animate-fade-in">
        {/* Step 1: Date Selection */}
        <div className="rounded-2xl bg-gradient-to-l from-cyan-700 to-cyan-900 p-4 text-white shadow-lg">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="w-5 h-5" />
            <div className="font-bold">الخطوة 1: اختر اليوم والتاريخ</div>
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full bg-white/20 rounded-xl py-2.5 px-3 text-white font-bold focus:outline-none"
          />
          <div className="text-sm mt-2 opacity-90">{arDay} - {formatArDate(selectedDate)}</div>
        </div>

        {/* Step 2: Group Selection */}
        <div>
          <div className="font-bold text-sm text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-2">
            <Users className="w-4 h-4 text-cyan-600" />
            الخطوة 2: اختر المجموعة ({todayGroups.length} مجموعة اليوم)
          </div>
          {todayGroups.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-sm">لا توجد مجموعات في هذا اليوم</div>
          ) : (
            <div className="space-y-2">
              {todayGroups.map(g => (
                <button
                  key={g.id}
                  onClick={() => setSelectedGroupId(g.id)}
                  className="w-full p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 hover:shadow-md transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center text-cyan-600">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-sm text-slate-800 dark:text-slate-100">{g.name}</div>
                      <div className="text-xs text-slate-500">{g.grade} • {g.subject}</div>
                    </div>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-slate-400" />
                </button>
              ))}
            </div>
          )}
          {/* Show all groups (not just today's) */}
          <details className="mt-3">
            <summary className="text-xs font-bold text-slate-500 cursor-pointer">كل المجموعات ({groups.length})</summary>
            <div className="mt-2 space-y-1.5">
              {groups.map(g => (
                <button
                  key={g.id}
                  onClick={() => setSelectedGroupId(g.id)}
                  className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-900/50 text-right text-sm hover:bg-slate-100"
                >
                  {g.name} - {getGroupDays(g).join('، ')}
                </button>
              ))}
            </div>
          </details>
        </div>
      </div>
    );
  }

  // ===== LESSON VIEW =====
  return (
    <div className={cn("p-4 space-y-3 animate-fade-in pb-40", focusMode && "p-2")}>
      {/* v6: Focus Mode toggle */}
      <button
        onClick={() => setFocusMode(!focusMode)}
        className={cn(
          "w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all",
          focusMode ? "bg-cyan-600 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
        )}
      >
        {focusMode ? <><Eye className="w-4 h-4" /> إظهار كل العناصر</> : <><EyeOff className="w-4 h-4" /> 🎯 وضع مركّز (جدول التقييم فقط)</>}
      </button>

      {/* ===== رأس شاشة الحصة (10 بنود) ===== */}
      {!focusMode && (
      <div className="rounded-2xl bg-gradient-to-l from-cyan-700 to-cyan-900 p-4 text-white shadow-lg">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-xs opacity-80">{formatArDate(selectedDate)}</div>
            <div className="font-bold text-lg">{selectedGroup?.name}</div>
            <div className="text-xs opacity-90 mt-0.5">{selectedGroup?.subject} • {selectedGroup?.teacherName}</div>
            <div className="text-xs opacity-90 mt-0.5">{scheduleText(selectedGroup!)} • مدة: {lesson?.duration || 90} دقيقة</div>
          </div>
          <button onClick={() => setSelectedGroupId('')} className="text-xs bg-white/20 px-2 py-1 rounded-lg">تغيير</button>
        </div>
        <div className="grid grid-cols-5 gap-1.5 text-center">
          <div className="bg-white/10 rounded-lg py-1.5">
            <div className="text-base font-bold">{stats.total}</div>
            <div className="text-[9px] opacity-80">الطلاب</div>
          </div>
          <div className="bg-white/10 rounded-lg py-1.5">
            <div className="text-base font-bold text-emerald-300">{stats.present}</div>
            <div className="text-[9px] opacity-80">حاضر</div>
          </div>
          <div className="bg-white/10 rounded-lg py-1.5">
            <div className="text-base font-bold text-red-300">{stats.absent}</div>
            <div className="text-[9px] opacity-80">غائب</div>
          </div>
          <div className="bg-white/10 rounded-lg py-1.5">
            <div className="text-base font-bold text-blue-300">{stats.excused}</div>
            <div className="text-[9px] opacity-80">بعذر</div>
          </div>
          <div className="bg-white/10 rounded-lg py-1.5">
            <div className="text-base font-bold">{stats.attendanceRate}%</div>
            <div className="text-[9px] opacity-80">نسبة</div>
          </div>
        </div>
        {/* Lesson status badge */}
        <div className="mt-2 flex items-center justify-center gap-2">
          {isLocked && <span className="px-3 py-1 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center gap-1"><Lock className="w-3 h-3" /> مقفلة</span>}
          {isClosed && <span className="px-3 py-1 rounded-full bg-slate-500 text-white text-xs font-bold flex items-center gap-1"><FolderX className="w-3 h-3" /> مطوية</span>}
          {!isLocked && !isClosed && <span className="px-3 py-1 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center gap-1"><Unlock className="w-3 h-3" /> مفتوحة</span>}
          {/* v7: Lesson Timer */}
          {!isLocked && !isClosed && <span className="px-3 py-1 rounded-full bg-cyan-600 text-white text-xs font-bold flex items-center gap-1"><Clock className="w-3 h-3" /> {timerDisplay}</span>}
        </div>
      </div>
      )}

      {/* ===== Lock/Unlock Controls ===== */}
      {isLocked && (
        <div className="flex gap-2">
          <button onClick={handleUnlock} className="flex-1 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold flex items-center justify-center gap-1">
            <Unlock className="w-4 h-4" /> إلغاء القفل للتعديل
          </button>
          <button onClick={handleClose} className="flex-1 py-2 rounded-xl bg-slate-600 text-white text-xs font-bold flex items-center justify-center gap-1">
            <FolderX className="w-4 h-4" /> طي الحصة
          </button>
        </div>
      )}
      {!isLocked && lesson?.closed && (
        <button onClick={handleRelock} className="w-full py-2 rounded-xl bg-cyan-600 text-white text-xs font-bold flex items-center justify-center gap-1">
          <Lock className="w-4 h-4" /> إعادة القفل
        </button>
      )}

      {/* ===== Always-visible Lesson Report Button ===== */}
      <button
        onClick={async () => {
          const { generateLessonReportPDF, downloadBlob } = await import('@/lib/documents');
          const studentsData = activeStudents.map(s => {
            const ev = getEval(s.id);
            const att = getAttendance(s.id);
            const status = att?.status === 'absent' ? 'غائب' : att?.status === 'excused' ? 'غياب بعذر' : 'حاضر';
            return {
              name: s.name,
              attendance: ev?.attendanceScore || (att?.status === 'present' ? 5 : 0),
              memorization: ev?.memorizationScore || 0,
              review: ev?.reviewScore || 0,
              homework: ev?.homeworkScore || 0,
              total: ev?.totalScore || 0,
              grade: ev ? GRADE_LABELS_AR[ev.gradeLabel] : status,
              note: ev?.note || '',
            };
          });
          const blob = await generateLessonReportPDF(
            selectedGroup?.name || '', selectedGroup?.subject || '', selectedGroup?.teacherName || '',
            formatArDate(lesson!.date), scheduleText(selectedGroup!),
            stats.total, stats.present, stats.absent, stats.attendanceRate,
            studentsData, settings
          );
          downloadBlob(blob, `تقرير-حصة-${selectedGroup?.name}-${selectedDate}.pdf`);
          toast.success('تم تصدير تقرير الحصة');
        }}
        className="w-full py-3 rounded-xl bg-gradient-to-l from-red-600 to-rose-700 text-white font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-md"
      >
        <FileDown className="w-5 h-5" /> 📄 تصدير تقرير الحصة (PDF)
      </button>

      {/* ===== Attendance methods (disabled if locked) ===== */}
      {!isLocked && !isClosed && (
        <>
          <button
            onClick={() => navigate('scanner', { groupId: selectedGroupId, lessonId: lesson?.id || '' })}
            className="w-full py-3 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 text-white font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-md"
          >
            <ScanLine className="w-5 h-5" /> مسح باركود الطالب
          </button>
          <button
            onClick={() => setPinDialog(true)}
            className="w-full py-2 rounded-xl bg-blue-600 text-white text-sm font-bold flex items-center justify-center gap-2"
          >
            <ScanLine className="w-4 h-4" /> إدخال PIN
          </button>

          {/* v6: Quick Grade Presets */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                // "الكل ممتاز" — 5/10/10/5 for all present students
                for (const s of activeStudents) {
                  const att = getAttendance(s.id);
                  if (att?.status === 'present' || att?.status === 'late') {
                    updateScore(s.id, 'attendanceScore', att.status === 'late' ? 3 : 5);
                    updateScore(s.id, 'memorizationScore', 10);
                    updateScore(s.id, 'reviewScore', 10);
                    updateScore(s.id, 'homeworkScore', 5);
                  }
                }
                toast.success('تم تطبيق "الكل ممتاز" للحاضرين');
              }}
              className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"
            >
              ⭐ الكل ممتاز
            </button>
            <button
              onClick={() => {
                // "الكل جيد" — 5/8/8/4
                for (const s of activeStudents) {
                  const att = getAttendance(s.id);
                  if (att?.status === 'present' || att?.status === 'late') {
                    updateScore(s.id, 'attendanceScore', att.status === 'late' ? 3 : 5);
                    updateScore(s.id, 'memorizationScore', 8);
                    updateScore(s.id, 'reviewScore', 8);
                    updateScore(s.id, 'homeworkScore', 4);
                  }
                }
                toast.success('تم تطبيق "الكل جيد" للحاضرين');
              }}
              className="flex-1 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold"
            >
              👍 الكل جيد
            </button>
            <button
              onClick={() => {
                // "الكل مقبول" — 5/6/6/3
                for (const s of activeStudents) {
                  const att = getAttendance(s.id);
                  if (att?.status === 'present' || att?.status === 'late') {
                    updateScore(s.id, 'attendanceScore', att.status === 'late' ? 3 : 5);
                    updateScore(s.id, 'memorizationScore', 6);
                    updateScore(s.id, 'reviewScore', 6);
                    updateScore(s.id, 'homeworkScore', 3);
                  }
                }
                toast.success('تم تطبيق "الكل مقبول" للحاضرين');
              }}
              className="flex-1 py-2 rounded-xl bg-amber-600 text-white text-xs font-bold"
            >
              ✅ الكل مقبول
            </button>
          </div>

          {/* Student manager */}
          <button onClick={() => setShowStudentManager(!showStudentManager)} className="w-full py-2 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1">
            <Users className="w-4 h-4" /> إدارة الطلاب ({activeStudents.length})
          </button>
          {showStudentManager && (
            <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-3 space-y-2">
              <div className="flex gap-2">
                <button onClick={() => setExcludedStudents(new Set())} className="flex-1 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold">تحديد الكل</button>
                <button onClick={() => setExcludedStudents(new Set(students.map(s => s.id)))} className="flex-1 py-1.5 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-bold">إلغاء الكل</button>
              </div>
              <details>
                <summary className="text-xs font-bold text-slate-500 cursor-pointer">إضافة/استبعاد طالب</summary>
                <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                  {allStudents.filter(s => s.status === 'active').map(s => {
                    const isInGroup = s.groupId === selectedGroupId;
                    const isExcluded = excludedStudents.has(s.id);
                    const isAdded = addedStudents.has(s.id);
                    return (
                      <div key={s.id} className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-50 dark:bg-slate-900/50">
                        <span className="flex-1 text-xs">{s.name} {isInGroup ? '(مجموعة)' : isAdded ? '(مضاف)' : '(خارج)'}</span>
                        {isInGroup || isAdded ? (
                          <button onClick={() => toggleExclude(s.id)} className={cn('px-2 py-0.5 rounded text-[10px] font-bold', isExcluded ? 'bg-red-600 text-white' : 'bg-amber-100 text-amber-700')}>
                            {isExcluded ? 'استبعاد ✓' : 'استبعاد'}
                          </button>
                        ) : (
                          <button onClick={() => toggleAddStudent(s.id)} className={cn('px-2 py-0.5 rounded text-[10px] font-bold', isAdded ? 'bg-emerald-600 text-white' : 'bg-blue-100 text-blue-700')}>
                            {isAdded ? 'مضاف ✓' : 'إضافة'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </details>
            </div>
          )}

          {/* Filters (7 types) */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {([
              ['all', 'الكل'], ['present', 'الحاضرون'], ['absent', 'الغائبون'],
              ['excused', 'بعذر'], ['weak', 'الضعاف'], ['excellent', 'الممتازون'], ['needs_followup', 'يحتاج متابعة']
            ] as const).map(([v, l]) => (
              <button key={v} onClick={() => setFilter(v)} className={cn('px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors', filter === v ? 'bg-cyan-700 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300')}>
                {l}
              </button>
            ))}
          </div>

          {/* Sort (6 types) */}
          <div className="flex items-center justify-between">
            <div className="flex-1 max-w-xs"><SearchBar value={search} onChange={setSearch} placeholder="بحث عن طالب" /></div>
            <button onClick={() => setSortBy(s => s === 'name' ? 'score' : s === 'score' ? 'absence' : s === 'absence' ? 'level' : s === 'level' ? 'last_eval' : 'name')} className="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1 whitespace-nowrap mr-2">
              <ArrowUpDown className="w-3 h-3" />
              {sortBy === 'name' ? 'الاسم' : sortBy === 'score' ? 'الدرجة' : sortBy === 'absence' ? 'الغياب' : sortBy === 'level' ? 'المستوى' : 'آخر تقييم'}
            </button>
          </div>

          {/* Students evaluation table */}
          <div className="space-y-2">
            {activeStudents.map(s => {
              const att = getAttendance(s.id);
              const ev = getEval(s.id);
              const isPresent = att?.status === 'present';
              const isAbsent = !att || att.status === 'absent';
              const isExcused = att?.status === 'excused';
              const isNew = isNewStudent(s.id);
              const isWeak = ev && ev.totalScore < WEAK_THRESHOLD && ev.totalScore > 0;
              return (
                <div key={s.id} className={cn(
                  'rounded-2xl border p-3 transition-all',
                  isAbsent ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900' :
                  isWeak ? 'bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900' :
                  ev && ev.totalScore >= 27 ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900' :
                  'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'
                )}>
                  {/* Header row */}
                  <div className="flex items-center justify-between mb-2">
                    <button onClick={() => navigate('student_profile', { id: s.id })} className="flex items-center gap-2 flex-1 text-right">
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm', isAbsent ? 'bg-red-500' : isExcused ? 'bg-blue-500' : ev ? 'bg-gradient-to-br from-cyan-500 to-teal-700' : 'bg-slate-400')}>
                        {s.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-800 dark:text-slate-100">
                          {s.name}
                          {isNew && <span className="ml-1 text-[9px] px-1 py-0.5 rounded bg-blue-100 text-blue-700">طالب جديد</span>}
                        </div>
                        <div className="text-[10px] text-slate-500">{isAbsent ? 'غائب' : isExcused ? 'غياب بعذر' : isPresent ? 'حاضر' : 'غير محدد'}</div>
                      </div>
                    </button>
                    {ev && !isAbsent && (
                      <div className={cn('grade-badge', GRADE_COLORS[ev.gradeLabel].bg, GRADE_COLORS[ev.gradeLabel].text)}>
                        {ev.totalScore}/30 • {GRADE_LABELS_AR[ev.gradeLabel]}
                      </div>
                    )}
                  </div>

                  {/* Attendance buttons */}
                  {!isAbsent && (
                    <div className="flex gap-1 mb-2">
                      <button onClick={() => markAttendance(s.id, 'present')} className={cn('flex-1 py-1 rounded-lg text-[10px] font-bold', isPresent ? 'bg-emerald-600 text-white' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600')}>حاضر</button>
                      <button onClick={() => markAttendance(s.id, 'absent')} className={cn('flex-1 py-1 rounded-lg text-[10px] font-bold', isAbsent ? 'bg-red-600 text-white' : 'bg-red-100 dark:bg-red-900/30 text-red-600')}>غائب</button>
                      <button onClick={() => markAttendance(s.id, 'excused')} className={cn('flex-1 py-1 rounded-lg text-[10px] font-bold', isExcused ? 'bg-blue-600 text-white' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600')}>بعذر</button>
                    </div>
                  )}

                  {/* Score grid */}
                  {!isAbsent && (
                    <div className="grid grid-cols-4 gap-2 mt-2">
                      <ScoreBlock label="حضور" value={ev?.attendanceScore ?? (isPresent ? 5 : 0)} max={5} color="emerald" onChange={(v) => updateScore(s.id, 'attendanceScore', v)} />
                      <ScoreBlock label="حفظ" value={ev?.memorizationScore || 0} max={10} color="blue" onChange={(v) => updateScore(s.id, 'memorizationScore', v)} />
                      <ScoreBlock label="مراجعة" value={ev?.reviewScore || 0} max={10} color="amber" onChange={(v) => updateScore(s.id, 'reviewScore', v)} />
                      <ScoreBlock label="واجب" value={ev?.homeworkScore || 0} max={5} color="violet" onChange={(v) => updateScore(s.id, 'homeworkScore', v)} />
                    </div>
                  )}

                  {/* Note + actions */}
                  {!isAbsent && (
                    <div className="flex gap-1 mt-2">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          placeholder="ملاحظة اليوم..."
                          value={ev?.note || ''}
                          onChange={(e) => {
                            const note = e.target.value;
                            setEvaluations(prev => {
                              const idx = prev.findIndex(p => p.studentId === s.id);
                              if (idx < 0) return prev;
                              const next = [...prev]; next[idx] = { ...next[idx], note }; return next;
                            });
                          }}
                          onFocus={() => setShowNotePicker(s.id)}
                          className="w-full text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-cyan-500"
                        />
                        {showNotePicker === s.id && (
                          <div className="absolute top-full left-0 right-0 z-10 mt-1 p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg">
                            <div className="text-[10px] font-bold text-slate-500 mb-1">ملاحظات جاهزة:</div>
                            <div className="flex flex-wrap gap-1">
                              {QUICK_NOTES.map(n => (
                                <button key={n} onClick={() => {
                                  setEvaluations(prev => {
                                    const idx = prev.findIndex(p => p.studentId === s.id);
                                    if (idx < 0) return prev;
                                    const next = [...prev]; next[idx] = { ...next[idx], note: n }; return next;
                                  });
                                  setShowNotePicker(null);
                                }} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-[10px] hover:bg-cyan-100">{n}</button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <button onClick={() => sendDailyReport(s)} className="w-8 h-8 rounded-lg bg-green-600 text-white flex items-center justify-center" title="إرسال تقرير واتساب">
                        <MessageCircle className="w-4 h-4" />
                      </button>
                      <button onClick={() => downloadDailyReport(s)} className="w-8 h-8 rounded-lg bg-cyan-600 text-white flex items-center justify-center" title="تحميل PDF">
                        <FileDown className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* Weak alert */}
                  {isWeak && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-orange-700 dark:text-orange-300 bg-orange-100 dark:bg-orange-900/30 rounded-lg p-1.5">
                      <AlertCircle className="w-3 h-3" /> يحتاج متابعة - درجة منخفضة
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {activeStudents.length === 0 && (
            <EmptyState title="لا يوجد طلاب" subtitle="أضف طلاباً لهذه المجموعة" icon={<BookOpen className="w-10 h-10" />} />
          )}

          {/* Save bar */}
          <div className="sticky bottom-20 z-20 mx-4 mb-4 p-3 rounded-2xl glass border-2 border-cyan-300 dark:border-cyan-700 shadow-xl space-y-2">
            <input
              type="text"
              placeholder="ملاحظة عامة للحصة..."
              value={globalNote}
              onChange={(e) => setGlobalNote(e.target.value)}
              className="w-full text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <button
              onClick={handleSave}
              data-voice-action="save_lesson"
              disabled={saving}
              className="w-full py-4 rounded-2xl bg-gradient-to-l from-cyan-600 to-teal-700 text-white font-extrabold text-lg flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg disabled:opacity-60"
            >
              <Save className="w-6 h-6" />
              {saving ? 'جاري الحفظ...' : '💾 حفظ الحصة'}
            </button>
          </div>
        </>
      )}

      {/* ===== Summary view (after save/lock) ===== */}
      {(isLocked || isClosed) && summary && (
        <div className="space-y-3">
          <div className="rounded-2xl bg-gradient-to-l from-emerald-600 to-green-800 p-4 text-white shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <Award className="w-5 h-5" />
              <div className="font-bold">ملخص الحصة</div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <SummaryBox label="المجموعة" value={selectedGroup?.name || '—'} />
              <SummaryBox label="التاريخ" value={formatArDate(lesson!.date)} />
              <SummaryBox label="عدد الطلاب" value={String(summary.totalStudents)} />
              <SummaryBox label="الحاضرون" value={String(summary.present)} color="text-emerald-300" />
              <SummaryBox label="الغائبون" value={String(summary.absent)} color="text-red-300" />
              <SummaryBox label="غياب بعذر" value={String(summary.excused)} color="text-blue-300" />
              <SummaryBox label="نسبة الحضور" value={`${summary.attendanceRate}%`} />
              <SummaryBox label="متوسط الدرجات" value={`${summary.avgScore}/30`} />
              <SummaryBox label="أعلى درجة" value={`${summary.maxScore}/30`} color="text-yellow-300" />
              <SummaryBox label="أقل درجة" value={`${summary.minScore}/30`} color="text-orange-300" />
              <SummaryBox label="طلاب يحتاجون متابعة" value={String(summary.weakCount)} color="text-orange-300" />
              <SummaryBox label="ممتازون" value={String(summary.excellentCount)} color="text-yellow-300" />
            </div>
          </div>

          {/* Export/Share */}
          <div className="grid grid-cols-3 gap-2">
            <button onClick={async () => {
              // v5: Generate full lesson report PDF with student table
              const { generateLessonReportPDF, downloadBlob } = await import('@/lib/documents');
              const studentsData = activeStudents.map(s => {
                const ev = getEval(s.id);
                const att = getAttendance(s.id);
                const status = att?.status === 'absent' ? 'غائب' : att?.status === 'excused' ? 'غياب بعذر' : 'حاضر';
                return {
                  name: s.name,
                  attendance: ev?.attendanceScore || (att?.status === 'present' ? 5 : 0),
                  memorization: ev?.memorizationScore || 0,
                  review: ev?.reviewScore || 0,
                  homework: ev?.homeworkScore || 0,
                  total: ev?.totalScore || 0,
                  grade: ev ? GRADE_LABELS_AR[ev.gradeLabel] : status,
                  note: ev?.note || '',
                };
              });
              const blob = await generateLessonReportPDF(
                selectedGroup?.name || '', selectedGroup?.subject || '', selectedGroup?.teacherName || '',
                formatArDate(lesson!.date), scheduleText(selectedGroup!),
                summary.totalStudents, summary.present, summary.absent, summary.attendanceRate,
                studentsData, settings
              );
              downloadBlob(blob, `lesson-report-${selectedDate}.pdf`);
              toast.success('تم تصدير تقرير الحصة');
            }} className="py-2 rounded-xl bg-red-600 text-white text-xs font-bold flex items-center justify-center gap-1">
              <FileDown className="w-3 h-3" /> PDF
            </button>
            <button onClick={() => window.print()} className="py-2 rounded-xl bg-blue-600 text-white text-xs font-bold flex items-center justify-center gap-1">
              <FileText className="w-3 h-3" /> طباعة
            </button>
            <button onClick={() => {
              const text = `ملخص حصة ${selectedGroup?.name} - ${formatArDate(lesson!.date)}\nالحاضر: ${summary.present}/${summary.totalStudents}\nمتوسط الدرجات: ${summary.avgScore}/30`;
              if (navigator.share) navigator.share({ title: 'ملخص الحصة', text });
              else { navigator.clipboard.writeText(text); toast.success('تم النسخ'); }
            }} className="py-2 rounded-xl bg-green-600 text-white text-xs font-bold flex items-center justify-center gap-1">
              <Send className="w-3 h-3" /> مشاركة
            </button>
          </div>
        </div>
      )}

      {/* PIN Dialog */}
      <Dialog open={pinDialog} onOpenChange={setPinDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>إدخال كود الطالب</DialogTitle></DialogHeader>
          <input
            type="text" inputMode="numeric" maxLength={4}
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="••••"
            className="w-full text-center text-3xl font-bold tracking-widest py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <button onClick={handlePinSubmit} className="w-full py-3 rounded-xl bg-emerald-600 text-white font-bold">تسجيل</button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-white/10 rounded-lg p-2 flex justify-between items-center">
      <span className="text-xs opacity-80">{label}</span>
      <span className={cn('font-bold', color || 'text-white')}>{value}</span>
    </div>
  );
}

function ScoreBlock({ label, value, max, color, onChange }: { label: string; value: number; max: number; color: 'emerald' | 'blue' | 'amber' | 'violet'; onChange: (v: number) => void; }) {
  const colorMap: Record<string, string> = { emerald: 'text-emerald-600', blue: 'text-blue-600', amber: 'text-amber-600', violet: 'text-violet-600' };
  const buttons = Array.from({ length: max + 1 }, (_, i) => i);
  return (
    <div className="text-center">
      <div className="text-[10px] text-slate-500 mb-1">{label}</div>
      <div className={cn('text-lg font-bold mb-1', colorMap[color])}>{value}/{max}</div>
      <div className={cn('grid gap-0.5', max <= 5 ? 'grid-cols-6' : 'grid-cols-11')}>
        {buttons.map(i => (
          <button key={i} onClick={() => onChange(i)} className={cn('text-[9px] py-0.5 rounded transition-all active:scale-90', value === i ? 'bg-slate-800 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-500')}>
            {i}
          </button>
        ))}
      </div>
    </div>
  );
}
