// ===== English Plus - Reports Screen =====
'use client';
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/lib/store';
import { getDB } from '@/lib/db';
import type { Student, Group, Lesson, Attendance, Payment, DailyEvaluation } from '@/lib/types';
import { formatMoney, formatArDate, formatArDateShort, arMonthName, GRADE_LABELS_AR, computeMonthlyStats, deriveStrengthsWeaknesses, scheduleText } from '@/lib/helpers';
import { generateTablePDF, downloadBlob, exportStudentsToExcel, exportPaymentsToExcel } from '@/lib/documents';
import { FileDown, FileSpreadsheet, Printer, Share2, ChevronLeft, CalendarDays, BarChart3, Wallet, AlertTriangle, Trophy, BookOpen, Users } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type ReportType =
  | 'daily_student' | 'daily_group' | 'weekly' | 'monthly_student' | 'monthly_group'
  | 'absence' | 'frequent_absent' | 'best_groups' | 'payment_late' | 'revenue' | 'academic' | 'weak_students';

const REPORTS: Array<{ key: ReportType; title: string; icon: any; color: string }> = [
  { key: 'daily_student', title: 'تقرير يومي للطالب', icon: Users, color: 'bg-blue-500' },
  { key: 'daily_group', title: 'تقرير يومي للمجموعة', icon: BookOpen, color: 'bg-emerald-500' },
  { key: 'weekly', title: 'تقرير أسبوعي', icon: CalendarDays, color: 'bg-cyan-500' },
  { key: 'monthly_student', title: 'تقرير شهري للطالب', icon: BarChart3, color: 'bg-violet-500' },
  { key: 'monthly_group', title: 'تقرير شهري للمجموعة', icon: BookOpen, color: 'bg-emerald-600' },
  { key: 'absence', title: 'تقرير الغياب', icon: AlertTriangle, color: 'bg-amber-500' },
  { key: 'frequent_absent', title: 'الطلاب كثيرو الغياب', icon: AlertTriangle, color: 'bg-red-500' },
  { key: 'best_groups', title: 'أفضل المجموعات التزاماً', icon: Trophy, color: 'bg-amber-500' },
  { key: 'payment_late', title: 'تأخرات الدفع', icon: Wallet, color: 'bg-orange-500' },
  { key: 'revenue', title: 'الإيرادات والمصروفات', icon: Wallet, color: 'bg-green-600' },
  { key: 'academic', title: 'أداء أكاديمي', icon: BarChart3, color: 'bg-blue-600' },
  { key: 'weak_students', title: 'طلاب يحتاجون متابعة', icon: AlertTriangle, color: 'bg-red-600' },
];

export function ReportsScreen() {
  const { params, settings, refreshKey, navigate } = useApp();
  const [selected, setSelected] = useState<ReportType | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [evaluations, setEvaluations] = useState<DailyEvaluation[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterGroupId, setFilterGroupId] = useState(params.id || '');
  const [filterStudentId, setFilterStudentId] = useState('');

  useEffect(() => {
    (async () => {
      const db = getDB();
      const [s, g, les, att, pay, ev] = await Promise.all([
        db.students.toArray(), db.groups.toArray(), db.lessons.toArray(),
        db.attendance.toArray(), db.payments.toArray(), db.evaluations.toArray(),
      ]);
      setStudents(s); setGroups(g); setLessons(les); setAttendances(att); setPayments(pay); setEvaluations(ev);
      setLoading(false);
    })();
  }, [refreshKey]);

  // Auto-select group if param (using initial render only)
  useEffect(() => {
    if (params.type === 'group' && params.id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFilterGroupId(params.id);
      setSelected('monthly_group');
    }
  }, []);

  function generateReport() {
    if (!selected) return;
    let title = REPORTS.find(r => r.key === selected)?.title || '';
    let subtitle = '';
    let headers: string[] = [];
    let rows: (string | number)[][] = [];

    switch (selected) {
      case 'daily_student': {
        const day = filterDate;
        const dayLessons = lessons.filter(l => l.date.split('T')[0] === day);
        const dayLessonIds = new Set(dayLessons.map(l => l.id));
        const dayEvals = evaluations.filter(e => dayLessonIds.has(e.lessonId));
        headers = ['الطالب', 'الحضور', 'الحفظ', 'المراجعة', 'الواجب', 'الإجمالي', 'التقدير', 'ملاحظة'];
        rows = dayEvals.map(ev => {
          const s = students.find(s => s.id === ev.studentId);
          return [
            s?.name || '—',
            ev.attendanceScore, ev.memorizationScore, ev.reviewScore, ev.homeworkScore,
            `${ev.totalScore}/40`, GRADE_LABELS_AR[ev.gradeLabel], ev.note || '',
          ];
        });
        subtitle = formatArDate(day);
        break;
      }
      case 'daily_group': {
        if (!filterGroupId) { toast.error('اختر مجموعة'); return; }
        const day = filterDate;
        const dayLessons = lessons.filter(l => l.groupId === filterGroupId && l.date.split('T')[0] === day);
        const dayLessonIds = new Set(dayLessons.map(l => l.id));
        const dayEvals = evaluations.filter(e => dayLessonIds.has(e.lessonId));
        const groupStudents = students.filter(s => s.groupId === filterGroupId);
        headers = ['الطالب', 'الحضور', 'الحفظ', 'المراجعة', 'الواجب', 'الإجمالي', 'التقدير'];
        rows = groupStudents.map(s => {
          const ev = dayEvals.find(e => e.studentId === s.id);
          return [
            s.name,
            ev ? ev.attendanceScore : 'غائب',
            ev ? ev.memorizationScore : '—',
            ev ? ev.reviewScore : '—',
            ev ? ev.homeworkScore : '—',
            ev ? `${ev.totalScore}/40` : '—',
            ev ? GRADE_LABELS_AR[ev.gradeLabel] : 'غائب',
          ];
        });
        const g = groups.find(g => g.id === filterGroupId);
        subtitle = `${g?.name} - ${formatArDate(day)}`;
        break;
      }
      case 'weekly': {
        const start = new Date(filterDate);
        const end = new Date(start);
        end.setDate(end.getDate() + 7);
        const weekLessons = lessons.filter(l => {
          const d = new Date(l.date);
          return d >= start && d <= end;
        });
        const weekLessonIds = new Set(weekLessons.map(l => l.id));
        const weekAtt = attendances.filter(a => weekLessonIds.has(a.lessonId));
        headers = ['الطالب', 'عدد الحصص', 'الحضور', 'الغياب', 'بعذر', 'نسبة الالتزام'];
        const byStudent = new Map<string, { lessons: number; present: number; absent: number; excused: number }>();
        for (const a of weekAtt) {
          if (!byStudent.has(a.studentId)) byStudent.set(a.studentId, { lessons: 0, present: 0, absent: 0, excused: 0 });
          const r = byStudent.get(a.studentId)!;
          r.lessons++;
          if (a.status === 'present') r.present++;
          else if (a.status === 'absent') r.absent++;
          else if (a.status === 'excused') r.excused++;
        }
        rows = Array.from(byStudent.entries()).map(([sid, r]) => {
          const s = students.find(s => s.id === sid);
          const rate = r.lessons > 0 ? Math.round((r.present / r.lessons) * 100) : 0;
          return [s?.name || '—', r.lessons, r.present, r.absent, r.excused, `${rate}%`];
        });
        subtitle = `من ${formatArDateShort(start)} إلى ${formatArDateShort(end)}`;
        break;
      }
      case 'monthly_student': {
        const monthLessons = lessons.filter(l => {
          const d = new Date(l.date);
          return d.getMonth() + 1 === filterMonth && d.getFullYear() === filterYear;
        });
        const monthLessonIds = new Set(monthLessons.map(l => l.id));
        headers = ['الطالب', 'الحصص', 'الحضور', 'الغياب', 'بعذر', 'متوسط/40', 'التقدير'];
        rows = students.filter(s => s.status === 'active').map(s => {
          const sAtt = attendances.filter(a => a.studentId === s.id && monthLessonIds.has(a.lessonId));
          const sEvals = evaluations.filter(e => e.studentId === s.id && monthLessonIds.has(e.lessonId));
          const stats = computeMonthlyStats(sAtt, sEvals);
          return [
            s.name, stats.lessonsCount, stats.present, stats.absent, stats.excused,
            stats.avgTotal, GRADE_LABELS_AR[stats.grade],
          ];
        });
        subtitle = `${arMonthName(filterMonth)} ${filterYear}`;
        break;
      }
      case 'monthly_group': {
        if (!filterGroupId) { toast.error('اختر مجموعة'); return; }
        const monthLessons = lessons.filter(l => {
          const d = new Date(l.date);
          return d.getMonth() + 1 === filterMonth && d.getFullYear() === filterYear && l.groupId === filterGroupId;
        });
        const monthLessonIds = new Set(monthLessons.map(l => l.id));
        const groupStudents = students.filter(s => s.groupId === filterGroupId && s.status === 'active');
        headers = ['الطالب', 'الحصص', 'الحضور', 'الغياب', 'بعذر', 'متوسط/40', 'التقدير'];
        rows = groupStudents.map(s => {
          const sAtt = attendances.filter(a => a.studentId === s.id && monthLessonIds.has(a.lessonId));
          const sEvals = evaluations.filter(e => e.studentId === s.id && monthLessonIds.has(e.lessonId));
          const stats = computeMonthlyStats(sAtt, sEvals);
          return [
            s.name, stats.lessonsCount, stats.present, stats.absent, stats.excused,
            stats.avgTotal, GRADE_LABELS_AR[stats.grade],
          ];
        });
        const g = groups.find(g => g.id === filterGroupId);
        subtitle = `${g?.name} - ${arMonthName(filterMonth)} ${filterYear}`;
        break;
      }
      case 'absence': {
        const monthAtt = attendances.filter(a => {
          const l = lessons.find(l => l.id === a.lessonId);
          if (!l) return false;
          const d = new Date(l.date);
          return d.getMonth() + 1 === filterMonth && d.getFullYear() === filterYear && a.status === 'absent';
        });
        headers = ['الطالب', 'الصف', 'عدد الغياب', 'تواريخ الغياب'];
        const byStudent = new Map<string, { count: number; dates: string[] }>();
        for (const a of monthAtt) {
          if (!byStudent.has(a.studentId)) byStudent.set(a.studentId, { count: 0, dates: [] });
          const r = byStudent.get(a.studentId)!;
          r.count++;
          const l = lessons.find(l => l.id === a.lessonId);
          if (l) r.dates.push(formatArDateShort(l.date));
        }
        rows = Array.from(byStudent.entries()).map(([sid, r]) => {
          const s = students.find(s => s.id === sid);
          return [s?.name || '—', s?.grade || '—', r.count, r.dates.join('، ')];
        });
        subtitle = `${arMonthName(filterMonth)} ${filterYear}`;
        break;
      }
      case 'frequent_absent': {
        const monthAtt = attendances.filter(a => {
          const l = lessons.find(l => l.id === a.lessonId);
          if (!l) return false;
          const d = new Date(l.date);
          return d.getMonth() + 1 === filterMonth && d.getFullYear() === filterYear && a.status === 'absent';
        });
        const counts = new Map<string, number>();
        for (const a of monthAtt) counts.set(a.studentId, (counts.get(a.studentId) || 0) + 1);
        headers = ['الطالب', 'الصف', 'عدد الغياب', 'هاتف ولي الأمر'];
        rows = Array.from(counts.entries())
          .filter(([_, c]) => c >= 3)
          .sort((a, b) => b[1] - a[1])
          .map(([sid, c]) => {
            const s = students.find(s => s.id === sid);
            return [s?.name || '—', s?.grade || '—', c, s?.parentPhone || '—'];
          });
        subtitle = `${arMonthName(filterMonth)} ${filterYear}`;
        break;
      }
      case 'best_groups': {
        const monthAtt = attendances.filter(a => {
          const l = lessons.find(l => l.id === a.lessonId);
          if (!l) return false;
          const d = new Date(l.date);
          return d.getMonth() + 1 === filterMonth && d.getFullYear() === filterYear;
        });
        headers = ['المجموعة', 'الصف', 'عدد الطلاب', 'نسبة الحضور', 'الإيراد المحصّل'];
        rows = groups.filter(g => !g.archived).map(g => {
          const gAtt = monthAtt.filter(a => a.groupId === g.id);
          const present = gAtt.filter(a => a.status === 'present').length;
          const rate = gAtt.length > 0 ? Math.round((present / gAtt.length) * 100) : 0;
          const groupStudents = students.filter(s => s.groupId === g.id);
          const collected = payments.filter(p => {
            const s = students.find(s => s.id === p.studentId);
            return s && s.groupId === g.id && p.month === filterMonth && p.year === filterYear;
          }).reduce((sum, p) => sum + p.amountPaid, 0);
          return [g.name, g.grade, groupStudents.length, `${rate}%`, formatMoney(collected)];
        }).sort((a, b) => parseInt(String(b[3])) - parseInt(String(a[3])));
        subtitle = `${arMonthName(filterMonth)} ${filterYear}`;
        break;
      }
      case 'payment_late': {
        headers = ['الطالب', 'الصف', 'المديونية', 'هاتف ولي الأمر'];
        rows = students
          .filter(s => s.status === 'active' && s.debt > 0)
          .sort((a, b) => b.debt - a.debt)
          .map(s => [s.name, s.grade, formatMoney(s.debt), s.parentPhone]);
        subtitle = `حتى ${formatArDate(new Date())}`;
        break;
      }
      case 'revenue': {
        const monthPayments = payments.filter(p => p.month === filterMonth && p.year === filterYear);
        const totalCollected = monthPayments.reduce((s, p) => s + p.amountPaid, 0);
        const totalDebt = students.reduce((s, st) => s + st.debt, 0);
        const expected = students.filter(s => s.status === 'active').reduce((s, st) => s + st.monthlyFee, 0);
        headers = ['البند', 'القيمة'];
        rows = [
          ['إجمالي الإيرادات المحصّلة', formatMoney(totalCollected)],
          ['إجمالي المتأخرات', formatMoney(totalDebt)],
          ['الإيراد المتوقع', formatMoney(expected)],
          ['نسبة التحصيل', `${expected > 0 ? Math.round((totalCollected / expected) * 100) : 0}%`],
          ['عدد المدفوعات', monthPayments.length],
        ];
        subtitle = `${arMonthName(filterMonth)} ${filterYear}`;
        break;
      }
      case 'academic': {
        const monthLessons = lessons.filter(l => {
          const d = new Date(l.date);
          return d.getMonth() + 1 === filterMonth && d.getFullYear() === filterYear;
        });
        const monthLessonIds = new Set(monthLessons.map(l => l.id));
        headers = ['الطالب', 'متوسط الحضور', 'متوسط الحفظ', 'متوسط المراجعة', 'متوسط الواجب', 'المتوسط العام', 'التقدير'];
        rows = students.filter(s => s.status === 'active').map(s => {
          const sAtt = attendances.filter(a => a.studentId === s.id && monthLessonIds.has(a.lessonId));
          const sEvals = evaluations.filter(e => e.studentId === s.id && monthLessonIds.has(e.lessonId));
          const stats = computeMonthlyStats(sAtt, sEvals);
          return [s.name, stats.avgAtt, stats.avgMem, stats.avgRev, stats.avgHw, stats.avgTotal, GRADE_LABELS_AR[stats.grade]];
        }).sort((a, b) => Number(b[5]) - Number(a[5]));
        subtitle = `${arMonthName(filterMonth)} ${filterYear}`;
        break;
      }
      case 'weak_students': {
        const monthLessons = lessons.filter(l => {
          const d = new Date(l.date);
          return d.getMonth() + 1 === filterMonth && d.getFullYear() === filterYear;
        });
        const monthLessonIds = new Set(monthLessons.map(l => l.id));
        headers = ['الطالب', 'الصف', 'المتوسط/40', 'التقدير', 'نقاط تحتاج متابعة'];
        rows = students.filter(s => s.status === 'active').map(s => {
          const sAtt = attendances.filter(a => a.studentId === s.id && monthLessonIds.has(a.lessonId));
          const sEvals = evaluations.filter(e => e.studentId === s.id && monthLessonIds.has(e.lessonId));
          const stats = computeMonthlyStats(sAtt, sEvals);
          const sw = deriveStrengthsWeaknesses(stats);
          return [s.name, s.grade, stats.avgTotal, GRADE_LABELS_AR[stats.grade], sw.weaknesses.join('، ')];
        }).filter(r => Number(r[2]) < 20);
        subtitle = `${arMonthName(filterMonth)} ${filterYear}`;
        break;
      }
    }

    return { title, subtitle, headers, rows };
  }

  function exportPDF() {
    const report = generateReport();
    if (!report) return;
    if (report.rows.length === 0) { toast.info('لا توجد بيانات'); return; }
    const blob = generateTablePDF(report.title, report.subtitle, report.headers, report.rows, settings);
    downloadBlob(blob, `${report.title}.pdf`);
    toast.success('تم تصدير PDF');
  }

  function exportExcel() {
    const report = generateReport();
    if (!report) return;
    if (report.rows.length === 0) { toast.info('لا توجد بيانات'); return; }
    const data = report.rows.map(r => {
      const obj: Record<string, string | number> = {};
      report.headers.forEach((h, i) => { obj[h] = r[i]; });
      return obj;
    });
    exportPaymentsToExcel(data, `${report.title}.xlsx`);
    toast.success('تم تصدير Excel');
  }

  if (loading) {
    return <div className="p-4 space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-12 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />)}</div>;
  }

  const report = selected ? generateReport() : null;

  return (
    <div className="p-4 space-y-3 animate-fade-in pb-32">
      {!selected ? (
        <>
          <div className="text-sm text-slate-500 mb-2">اختر نوع التقرير</div>
          <div className="grid grid-cols-2 gap-2">
            {REPORTS.map(r => {
              const Icon = r.icon;
              return (
                <button
                  key={r.key}
                  onClick={() => setSelected(r.key)}
                  className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 hover:shadow-md transition-all flex flex-col items-center gap-2 active:scale-95"
                >
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-white', r.color)}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 text-center leading-tight">{r.title}</span>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          {/* Filters */}
          <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <button onClick={() => setSelected(null)} className="text-xs text-blue-600 font-bold flex items-center gap-1">
                <ChevronLeft className="w-3 h-3 rotate-180" /> رجوع للقائمة
              </button>
              <div className="font-bold text-sm text-slate-800 dark:text-slate-100">{REPORTS.find(r => r.key === selected)?.title}</div>
            </div>
            {(selected === 'daily_student' || selected === 'daily_group' || selected === 'weekly') && (
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-sm"
              />
            )}
            {['monthly_student', 'monthly_group', 'absence', 'frequent_absent', 'best_groups', 'revenue', 'academic', 'weak_students'].includes(selected) && (
              <div className="grid grid-cols-2 gap-2">
                <select value={filterMonth} onChange={(e) => setFilterMonth(Number(e.target.value))} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-sm">
                  {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{arMonthName(i + 1)}</option>)}
                </select>
                <select value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-sm">
                  {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            )}
            {['daily_group', 'monthly_group'].includes(selected) && (
              <select value={filterGroupId} onChange={(e) => setFilterGroupId(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-sm">
                <option value="">اختر مجموعة</option>
                {groups.filter(g => !g.archived).map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            )}
          </div>

          {/* Preview */}
          {report && report.rows.length > 0 ? (
            <div className="rounded-2xl bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 overflow-hidden">
              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700">
                <div className="font-bold text-sm text-slate-800 dark:text-slate-100">{report.title}</div>
                <div className="text-xs text-slate-500">{report.subtitle}</div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-900/50">
                      {report.headers.map((h, i) => (
                        <th key={i} className="p-2 text-right font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.slice(0, 50).map((r, i) => (
                      <tr key={i} className="border-t border-slate-100 dark:border-slate-700">
                        {r.map((c, j) => (
                          <td key={j} className="p-2 text-slate-700 dark:text-slate-200 whitespace-nowrap">{c}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {report.rows.length > 50 && (
                  <div className="p-2 text-center text-xs text-slate-400">عرض أول 50 صف فقط - صدّر لرؤية الكل</div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400 text-sm">لا توجد بيانات في هذا النطاق</div>
          )}

          {/* Export buttons */}
          <div className="grid grid-cols-3 gap-2">
            <button onClick={exportPDF} className="py-3 rounded-xl bg-red-600 text-white text-xs font-bold flex flex-col items-center gap-1 active:scale-95">
              <FileDown className="w-5 h-5" /> PDF
            </button>
            <button onClick={exportExcel} className="py-3 rounded-xl bg-emerald-600 text-white text-xs font-bold flex flex-col items-center gap-1 active:scale-95">
              <FileSpreadsheet className="w-5 h-5" /> Excel
            </button>
            <button onClick={() => window.print()} className="py-3 rounded-xl bg-blue-600 text-white text-xs font-bold flex flex-col items-center gap-1 active:scale-95">
              <Printer className="w-5 h-5" /> طباعة
            </button>
          </div>
        </>
      )}
    </div>
  );
}
