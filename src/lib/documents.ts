// ===== English Plus - QR / Barcode / PDF / Excel generators =====
'use client';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import type { Student, Group, Settings, Payment, Lesson, Attendance, DailyEvaluation } from './types';
import { scheduleText, formatArDate, formatArDateShort, GRADE_LABELS_AR, formatMoney } from './helpers';

// ===== QR generation =====
export async function generateQRDataUrl(text: string, size = 256): Promise<string> {
  return await QRCode.toDataURL(text, {
    width: size,
    margin: 1,
    color: { dark: '#0f172a', light: '#ffffff' },
    errorCorrectionLevel: 'M',
  });
}

// ===== Barcode (Code128) generation =====
export function generateBarcodeDataUrl(code: string): string {
  const canvas = document.createElement('canvas');
  try {
    JsBarcode(canvas, code, {
      format: 'CODE128',
      width: 2,
      height: 60,
      displayValue: true,
      fontSize: 14,
      margin: 4,
    });
    return canvas.toDataURL('image/png');
  } catch {
    return '';
  }
}

// ===== Student Card PDF (4 per A4) =====
export async function generateStudentCardsPDF(students: Student[], groups: Group[], settings: Settings): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const pageHeight = 297;
  const cardW = 90;
  const cardH = 60;
  const gapX = 10;
  const gapY = 10;
  const marginX = (pageWidth - (2 * cardW + gapX)) / 2;
  const marginY = 15;

  // Embed Amiri-like font: jsPDF default Helvetica supports Latin only.
  // We will draw Arabic text using a workaround: render text via canvas -> png -> addImage.
  // For simplicity & reliability, we'll render each card on a canvas then embed image.

  const cardsPerPage = 4; // 2x2
  for (let i = 0; i < students.length; i++) {
    const student = students[i];
    const group = groups.find(g => g.id === student.groupId) || null;
    const pageIndex = Math.floor(i / cardsPerPage);
    const posInPage = i % cardsPerPage;
    const col = posInPage % 2;
    const row = Math.floor(posInPage / 2);
    const x = marginX + col * (cardW + gapX);
    const y = marginY + row * (cardH + gapY);

    if (posInPage === 0 && pageIndex > 0) {
      doc.addPage();
    }

    // Render card as image on canvas (so Arabic displays correctly)
    const cardCanvas = await renderStudentCardCanvas(student, group, settings);
    const imgData = cardCanvas.toDataURL('image/png');
    doc.addImage(imgData, 'PNG', x, y, cardW, cardH);

    // Add cut marks
    doc.setDrawColor(200);
    doc.setLineWidth(0.1);
    doc.rect(x, y, cardW, cardH);
  }

  return doc.output('blob');
}

async function renderStudentCardCanvas(student: Student, group: Group | null, settings: Settings): Promise<HTMLCanvasElement> {
  const scale = 4; // high res
  const w = 360;
  const h = 240;
  const canvas = document.createElement('canvas');
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#1e3a8a');
  grad.addColorStop(0.5, '#2563eb');
  grad.addColorStop(1, '#0e7490');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // decorative shapes
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.beginPath();
  ctx.arc(w - 30, 30, 60, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(20, h - 30, 50, 0, Math.PI * 2);
  ctx.fill();

  // Header bar
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(0, 0, w, 36);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(settings.appName, w / 2, 24);
  ctx.font = '10px sans-serif';
  ctx.fillText('بطاقة هوية الطالب', w / 2, 33);

  // Student name
  ctx.font = 'bold 16px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'right';
  ctx.fillText(student.name, w - 12, 60);

  // Info lines
  ctx.font = '11px sans-serif';
  ctx.fillStyle = '#e0e7ff';
  let ly = 80;
  const infoLines = [
    `الصف: ${student.grade}`,
    group ? `المجموعة: ${group.name}` : 'المجموعة: —',
    group ? `الموعد: ${scheduleText(group)}` : 'الموعد: —',
    `الكود: ${student.code}`,
    `العام: ${student.academicYear}`,
  ];
  for (const line of infoLines) {
    ctx.fillText(line, w - 12, ly);
    ly += 16;
  }

  // QR code
  try {
    const qrPayload = JSON.stringify({ app: settings.appName, sid: student.id, code: student.code, name: student.name });
    const qrData = await QRCode.toDataURL(qrPayload, { width: 200, margin: 0, color: { dark: '#0f172a', light: '#ffffff' } });
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject();
      img.src = qrData;
    });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(12, 60, 70, 70);
    ctx.drawImage(img, 14, 62, 66, 66);
  } catch (e) {
    // ignore
  }

  // Footer
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fillRect(0, h - 24, w, 24);
  ctx.fillStyle = '#1e3a8a';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${settings.teacherName}  •  ${settings.teacherPhone}`, w / 2, h - 9);

  return canvas;
}

// ===== Invoice PDF =====
export async function generateInvoicePDF(
  student: Student,
  group: Group | null,
  payment: Payment,
  settings: Settings
): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = 210;

  // Render on canvas for Arabic
  const canvas = document.createElement('canvas');
  const scale = 3;
  canvas.width = 700 * scale;
  canvas.height = 1000 * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  // bg
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 700, 1000);

  // border
  ctx.strokeStyle = '#1e3a8a';
  ctx.lineWidth = 3;
  ctx.strokeRect(10, 10, 680, 980);

  // header band
  const grad = ctx.createLinearGradient(0, 0, 700, 0);
  grad.addColorStop(0, '#1e3a8a');
  grad.addColorStop(1, '#0e7490');
  ctx.fillStyle = grad;
  ctx.fillRect(10, 10, 680, 110);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 42px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🧾 فاتورة إلكترونية', 350, 60);
  ctx.font = '20px sans-serif';
  ctx.fillText(settings.appName, 350, 92);
  ctx.font = '14px sans-serif';
  ctx.fillText(`رقم الفاتورة: ${payment.invoiceNumber}`, 350, 110);

  // Invoice body
  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'right';
  let y = 170;
  const lines: Array<[string, string]> = [
    ['الطالب', student.name],
    ['الصف', student.grade],
    ['المجموعة', group?.name || '—'],
    ['موعد المجموعة', group ? scheduleText(group) : '—'],
    ['الشهر', `${payment.month} / ${payment.year}`],
    ['المبلغ المدفوع', formatMoney(payment.amountPaid)],
    ['المبلغ المتبقي', formatMoney(payment.amountRemaining)],
    ['نظام الدفع', payment.paymentMode === 'start' ? 'أول الشهر' : 'آخر الشهر'],
    ['التاريخ', formatArDate(payment.paymentDate)],
  ];
  for (const [label, value] of lines) {
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#1e3a8a';
    ctx.fillText(label, 650, y);
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(value, 480, y);
    // line
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(40, y + 10);
    ctx.lineTo(660, y + 10);
    ctx.stroke();
    y += 50;
  }

  // Total box
  ctx.fillStyle = '#ecfdf5';
  ctx.fillRect(380, y + 10, 280, 60);
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2;
  ctx.strokeRect(380, y + 10, 280, 60);
  ctx.fillStyle = '#065f46';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`إجمالي المدفوع: ${formatMoney(payment.amountPaid)}`, 520, y + 48);

  // Footer
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(10, 920, 680, 70);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(settings.teacherName, 350, 950);
  ctx.font = '18px sans-serif';
  ctx.fillText(`📞 ${settings.teacherPhone}`, 350, 975);

  ctx.fillStyle = '#64748b';
  ctx.font = '14px sans-serif';
  ctx.fillText('شكرًا لتعاونكم', 350, 1010 - 20);

  const imgData = canvas.toDataURL('image/png');
  doc.addImage(imgData, 'PNG', 0, 0, pageWidth, 297);

  return doc.output('blob');
}

// ===== Daily report PDF =====
export async function generateDailyReportPDF(
  student: Student,
  lesson: Lesson,
  group: Group | null,
  evaluation: DailyEvaluation | null,
  status: string,
  settings: Settings
): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const canvas = document.createElement('canvas');
  const scale = 3;
  canvas.width = 700 * scale;
  canvas.height = 900 * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 700, 900);

  // header
  const grad = ctx.createLinearGradient(0, 0, 700, 0);
  grad.addColorStop(0, '#0891b2');
  grad.addColorStop(1, '#0e7490');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 700, 120);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('📝 تقرير حصة اليوم', 350, 55);
  ctx.font = '22px sans-serif';
  ctx.fillText(settings.appName, 350, 90);
  ctx.font = '14px sans-serif';
  ctx.fillText(formatArDate(lesson.date), 350, 112);

  // student name banner
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(40, 150, 620, 60);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`الطالب: ${student.name}`, 640, 190);

  // scores
  let y = 260;
  ctx.textAlign = 'right';
  const items = evaluation
    ? [
        ['✅ الحضور', `${evaluation.attendanceScore}/5`],
        ['📖 الحفظ', `${evaluation.memorizationScore}/10`],
        ['🔄 المراجعة', `${evaluation.reviewScore}/10`],
        ['📝 الواجب', `${evaluation.homeworkScore}/5`],
      ]
    : [];
  for (const [label, val] of items) {
    ctx.fillStyle = '#1e3a8a';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(label, 640, y);
    ctx.fillStyle = '#0f172a';
    ctx.font = '22px sans-serif';
    ctx.fillText(val, 320, y);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(40, y + 12);
    ctx.lineTo(660, y + 12);
    ctx.stroke();
    y += 50;
  }

  // total
  if (evaluation) {
    ctx.fillStyle = '#ecfdf5';
    ctx.fillRect(40, y + 10, 620, 80);
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    ctx.strokeRect(40, y + 10, 620, 80);
    ctx.fillStyle = '#065f46';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`🏆 المجموع: ${evaluation.totalScore}/30`, 350, y + 50);
    ctx.font = '22px sans-serif';
    ctx.fillText(`التقدير: ${GRADE_LABELS_AR[evaluation.gradeLabel]}`, 350, y + 78);
    y += 110;
  } else {
    ctx.fillStyle = '#fee2e2';
    ctx.fillRect(40, y + 10, 620, 60);
    ctx.fillStyle = '#991b1b';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`الطالب: ${status}`, 350, y + 50);
    y += 90;
  }

  // note
  if (evaluation?.note) {
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('ملاحظة المدرس:', 640, y + 20);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#475569';
    const noteLines = wrapText(evaluation.note, 50);
    let ny = y + 45;
    for (const line of noteLines) {
      ctx.fillText(line, 640, ny);
      ny += 22;
    }
    y = ny;
  }

  // footer
  ctx.fillStyle = '#0891b2';
  ctx.fillRect(0, 830, 700, 70);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(settings.teacherName, 350, 860);
  ctx.font = '16px sans-serif';
  ctx.fillText(`📞 ${settings.teacherPhone}`, 350, 885);

  const imgData = canvas.toDataURL('image/png');
  doc.addImage(imgData, 'PNG', 0, 0, 210, 270);

  return doc.output('blob');
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length > maxChars) {
      if (line) lines.push(line);
      line = word;
    } else {
      line = (line + ' ' + word).trim();
    }
  }
  if (line) lines.push(line);
  return lines;
}

// ===== Generic table PDF (for reports) =====
export function generateTablePDF(
  title: string,
  subtitle: string,
  headers: string[],
  rows: (string | number)[][],
  settings: Settings
): Blob {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Header band as image for Arabic
  const canvas = document.createElement('canvas');
  canvas.width = 1400;
  canvas.height = 200;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 1400, 0);
  grad.addColorStop(0, '#1e3a8a');
  grad.addColorStop(1, '#0e7490');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1400, 200);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 56px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, 700, 80);
  ctx.font = '28px sans-serif';
  ctx.fillText(subtitle, 700, 140);
  ctx.font = '18px sans-serif';
  ctx.fillText(`${settings.teacherName}  •  ${settings.teacherPhone}`, 700, 180);

  const imgData = canvas.toDataURL('image/png');
  doc.addImage(imgData, 'PNG', 0, 0, 210, 30);

  // Table (use latin for numbers, but our content is Arabic - render via canvas per cell is heavy)
  // Instead, render table on a canvas entirely
  const tableCanvas = renderTableCanvas(headers, rows);
  const tableImg = tableCanvas.toDataURL('image/png');
  doc.addImage(tableImg, 'PNG', 5, 35, 200, (200 * tableCanvas.height) / tableCanvas.width);

  return doc.output('blob');
}

function renderTableCanvas(headers: string[], rows: (string | number)[][]): HTMLCanvasElement {
  const colCount = headers.length;
  const cellPad = 10;
  const rowH = 36;
  const headerH = 44;
  const colWidths: number[] = [];
  // compute column widths roughly by content
  const canvas = document.createElement('canvas');
  canvas.width = 1400;
  const ctx = canvas.getContext('2d')!;
  ctx.font = '16px sans-serif';
  for (let c = 0; c < colCount; c++) {
    let maxW = ctx.measureText(headers[c]).width;
    for (const row of rows) {
      const w = ctx.measureText(String(row[c] ?? '')).width;
      if (w > maxW) maxW = w;
    }
    colWidths.push(Math.ceil(maxW + cellPad * 2));
  }
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  canvas.width = Math.max(totalW, 1400);
  const totalH = headerH + rows.length * rowH + 10;
  canvas.height = totalH;
  const ctx2 = canvas.getContext('2d')!;

  // bg
  ctx2.fillStyle = '#ffffff';
  ctx2.fillRect(0, 0, canvas.width, totalH);

  // header
  ctx2.fillStyle = '#1e3a8a';
  ctx2.fillRect(0, 0, canvas.width, headerH);
  ctx2.fillStyle = '#ffffff';
  ctx2.font = 'bold 18px sans-serif';
  ctx2.textAlign = 'center';
  ctx2.textBaseline = 'middle';
  let x = 0;
  for (let c = 0; c < colCount; c++) {
    ctx2.fillText(headers[c], x + colWidths[c] / 2, headerH / 2);
    x += colWidths[c];
  }

  // rows
  ctx2.font = '16px sans-serif';
  for (let r = 0; r < rows.length; r++) {
    if (r % 2 === 1) {
      ctx2.fillStyle = '#f8fafc';
      ctx2.fillRect(0, headerH + r * rowH, canvas.width, rowH);
    }
    ctx2.fillStyle = '#0f172a';
    ctx2.textAlign = 'center';
    let xc = 0;
    for (let c = 0; c < colCount; c++) {
      const val = String(rows[r][c] ?? '');
      ctx2.fillText(val, xc + colWidths[c] / 2, headerH + r * rowH + rowH / 2);
      xc += colWidths[c];
    }
    // border bottom
    ctx2.strokeStyle = '#e2e8f0';
    ctx2.lineWidth = 0.5;
    ctx2.beginPath();
    ctx2.moveTo(0, headerH + (r + 1) * rowH);
    ctx2.lineTo(canvas.width, headerH + (r + 1) * rowH);
    ctx2.stroke();
  }

  // outer border
  ctx2.strokeStyle = '#cbd5e1';
  ctx2.lineWidth = 1;
  ctx2.strokeRect(0, 0, canvas.width, totalH);
  // vertical lines
  let xv = 0;
  for (let c = 0; c < colCount - 1; c++) {
    xv += colWidths[c];
    ctx2.beginPath();
    ctx2.moveTo(xv, 0);
    ctx2.lineTo(xv, totalH);
    ctx2.stroke();
  }

  return canvas;
}

// ===== Excel Export =====
export function exportStudentsToExcel(students: Student[], groups: Group[], fileName = 'students.xlsx') {
  const data = students.map(s => {
    const g = groups.find(g => g.id === s.groupId);
    return {
      'الكود': s.code,
      'الاسم': s.name,
      'هاتف الطالب': s.phone,
      'هاتف ولي الأمر': s.parentPhone,
      'الصف': s.grade,
      'المادة': s.subject,
      'المجموعة': g?.name || '',
      'العام الدراسي': s.academicYear,
      'الفصل': s.semester === 'first' ? 'الأول' : 'الثاني',
      'الاشتراك الشهري': s.monthlyFee,
      'المديونية': s.debt,
      'تاريخ التسجيل': formatArDateShort(s.joinDate),
      'الحالة': s.status === 'active' ? 'نشط' : s.status === 'archived' ? 'مؤرشف' : 'متوقف',
      'ملاحظات': s.notes || '',
    };
  });
  const ws = XLSX.utils.json_to_sheet(data);
  ws['!cols'] = Object.keys(data[0] || {}).map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'الطلاب');
  XLSX.writeFile(wb, fileName);
}

export function exportPaymentsToExcel(rows: Array<Record<string, string | number>>, fileName = 'payments.xlsx') {
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = Object.keys(rows[0] || {}).map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'المدفوعات');
  XLSX.writeFile(wb, fileName);
}

// ===== Excel Import =====
export interface ImportedStudent {
  name: string;
  phone: string;
  parentPhone: string;
  grade: string;
  subject: string;
  groupName?: string;
  monthlyFee: number;
  joinDate: string;
  notes?: string;
}

export async function parseStudentsExcel(file: File): Promise<ImportedStudent[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
  return json.map(row => {
    const get = (keys: string[]) => {
      for (const k of keys) {
        for (const rk of Object.keys(row)) {
          if (rk.includes(k)) return String(row[rk] ?? '').trim();
        }
      }
      return '';
    };
    return {
      name: get(['الاسم', 'name']) || 'بدون اسم',
      phone: get(['هاتف الطالب', 'phone']),
      parentPhone: get(['ولي الأمر', 'parent']),
      grade: get(['الصف', 'grade']),
      subject: get(['المادة', 'subject']),
      groupName: get(['المجموعة', 'group']),
      monthlyFee: Number(get(['الاشتراك', 'fee'])) || 0,
      joinDate: new Date().toISOString(),
      notes: get(['ملاحظات', 'notes']),
    } as ImportedStudent;
  });
}

// ===== Download helper =====
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ===== v4: Lesson Report PDF (full student table) =====
export async function generateLessonReportPDF(
  groupName: string,
  subject: string,
  teacherName: string,
  lessonDate: string,
  lessonTime: string,
  totalStudents: number,
  presentCount: number,
  absentCount: number,
  attendanceRate: number,
  studentsData: Array<{
    name: string;
    attendance: number;
    memorization: number;
    review: number;
    homework: number;
    total: number;
    grade: string;
    note: string;
  }>,
  settings: { teacherName: string; teacherPhone: string; appName: string }
): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Render on canvas for Arabic support
  const canvas = document.createElement('canvas');
  const scale = 3;
  canvas.width = 794 * scale;
  canvas.height = (200 + studentsData.length * 35 + 100) * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 794, canvas.height / scale);

  // Header
  const grad = ctx.createLinearGradient(0, 0, 794, 0);
  grad.addColorStop(0, '#1e3a8a');
  grad.addColorStop(1, '#0e7490');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 794, 120);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 32px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('تقرير حصة اليوم', 397, 45);
  ctx.font = '20px sans-serif';
  ctx.fillText(settings.appName, 397, 72);
  ctx.font = '14px sans-serif';
  ctx.fillText(`${groupName} • ${subject} • ${teacherName}`, 397, 95);
  ctx.fillText(`${lessonDate} • ${lessonTime}`, 397, 112);

  // Stats bar
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(20, 130, 754, 40);
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#1e3a8a';
  ctx.fillText(`الطلاب: ${totalStudents}`, 130, 155);
  ctx.fillStyle = '#059669';
  ctx.fillText(`الحاضر: ${presentCount}`, 290, 155);
  ctx.fillStyle = '#dc2626';
  ctx.fillText(`الغائب: ${absentCount}`, 450, 155);
  ctx.fillStyle = '#7c3aed';
  ctx.fillText(`نسبة الحضور: ${attendanceRate}%`, 620, 155);

  // Table header
  let y = 190;
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(20, y, 754, 30);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  const cols = [
    { label: 'الطالب', x: 397, w: 180 },
    { label: 'الحضور/5', x: 300, w: 50 },
    { label: 'الحفظ/10', x: 240, w: 50 },
    { label: 'المراجعة/10', x: 180, w: 55 },
    { label: 'الواجب/5', x: 125, w: 45 },
    { label: 'المجموع/30', x: 75, w: 55 },
    { label: 'التقدير', x: 38, w: 40 },
  ];
  // Right-to-left headers
  ctx.fillText('الطالب', 600, y + 20);
  ctx.fillText('الحضور', 490, y + 20);
  ctx.fillText('الحفظ', 420, y + 20);
  ctx.fillText('المراجعة', 350, y + 20);
  ctx.fillText('الواجب', 280, y + 20);
  ctx.fillText('المجموع', 210, y + 20);
  ctx.fillText('التقدير', 140, y + 20);
  ctx.fillText('ملاحظة', 60, y + 20);

  // Student rows
  y += 30;
  ctx.font = '11px sans-serif';
  for (let i = 0; i < studentsData.length; i++) {
    const s = studentsData[i];
    if (i % 2 === 1) {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(20, y, 754, 28);
    }
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'right';
    ctx.fillText(s.name.slice(0, 18), 760, y + 18);
    ctx.textAlign = 'center';
    ctx.fillText(String(s.attendance), 490, y + 18);
    ctx.fillText(String(s.memorization), 420, y + 18);
    ctx.fillText(String(s.review), 350, y + 18);
    ctx.fillText(String(s.homework), 280, y + 18);
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(String(s.total), 210, y + 18);
    ctx.font = '11px sans-serif';
    // Grade color
    const gradeColors: Record<string, string> = {
      'ممتاز': '#059669', 'جيد جداً': '#2563eb', 'جيد': '#ca8a04',
      'مقبول': '#ea580c', 'ضعيف': '#dc2626', 'غير مُقيّم': '#64748b',
    };
    ctx.fillStyle = gradeColors[s.grade] || '#64748b';
    ctx.fillText(s.grade, 140, y + 18);
    ctx.fillStyle = '#64748b';
    ctx.fillText(s.note ? s.note.slice(0, 12) : '—', 60, y + 18);
    y += 28;
  }

  // Footer
  y += 20;
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(0, y, 794, 60);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(settings.teacherName, 397, y + 25);
  ctx.font = '14px sans-serif';
  ctx.fillText(`📞 ${settings.teacherPhone}`, 397, y + 45);

  const imgData = canvas.toDataURL('image/png');
  const pageHeight = (canvas.height / scale) * 0.264583; // px to mm
  doc.addImage(imgData, 'PNG', 0, 0, 210, pageHeight);

  return doc.output('blob');
}

// ===== v5: Generate Student Card as PNG image (for WhatsApp sharing) =====
export async function generateStudentCardImage(
  student: Student,
  group: Group | null,
  settings: Settings
): Promise<Blob> {
  const canvas = await renderStudentCardCanvas(student, group, settings);
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob!);
    }, 'image/png', 1.0);
  });
}

// ===== v5: Share student card via WhatsApp (image + text) =====
export async function shareStudentCardViaWhatsApp(
  student: Student,
  group: Group | null,
  settings: Settings
): Promise<void> {
  const cardBlob = await generateStudentCardImage(student, group, settings);
  const cardUrl = URL.createObjectURL(cardBlob);

  // Try Web Share API (supports image sharing on mobile)
  if (navigator.share && navigator.canShare) {
    try {
      const file = new File([cardBlob], `بطاقة-${student.name}.png`, { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        const message = `بطاقة هوية الطالب - ${settings.appName}\nالطالب: ${student.name}\nالكود: ${student.code}\n${settings.teacherName}`;
        await navigator.share({
          title: 'بطاقة الطالب',
          text: message,
          files: [file],
        });
        URL.revokeObjectURL(cardUrl);
        return;
      }
    } catch (e) {
      console.warn('Web Share failed, falling back to download', e);
    }
  }

  // Fallback: download the image + open WhatsApp with text
  const a = document.createElement('a');
  a.href = cardUrl;
  a.download = `بطاقة-${student.name}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Open WhatsApp with accompanying message
  const message = `بطاقة هوية الطالب - ${settings.appName}\nالطالب: ${student.name}\nالكود: ${student.code}\n${settings.teacherName}\n📞 ${settings.teacherPhone}\n\nتم إرفاق صورة البطاقة — يرجى حفظها على هاتفك`;
  const { whatsappLink } = await import('./helpers');
  window.open(whatsappLink(student.parentPhone, message), '_blank');

  setTimeout(() => URL.revokeObjectURL(cardUrl), 5000);
}
