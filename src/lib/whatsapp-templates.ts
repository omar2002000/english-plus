// ===== English Plus - WhatsApp Templates System (35 templates) =====
// Organized by category, with real data binding

export interface WhatsappTemplateV2 {
  id: string;
  category: string;
  status_key: string;
  name: string;
  message: string;
  short_message: string;
  variables: string[]; // e.g. ["[اسم الطالب]", "[اليوم]"]
  tone: 'شبه رسمي' | 'إيجابي' | 'تنبيهي' | 'سريع';
  active: boolean;
}

// All available variables that can be replaced
export const WHATSAPP_VARIABLES = [
  '[اسم الطالب]',
  '[اليوم]',
  '[التاريخ]',
  '[الوقت]',
  '[اسم الشهر]',
  '[المبلغ]',
  '[المبلغ المدفوع]',
  '[المبلغ المتبقي]',
  '[الدرجة]',
  '[حالة الطالب]',
  '[الصف]',
  '[المجموعة]',
  '[ملاحظات المدرس]',
  '[عدد الغيابات]',
  '[عدد الحصص]',
  '[عدد الحضور]',
  '[اسم المدرس]',
  '[رقم المدرس]',
];

export const WHATSAPP_CATEGORIES = [
  'التسجيل والانضمام',
  'الحضور والغياب',
  'الاشتراكات والمدفوعات',
  'المستوى والتقييم',
  'الواجب والمتابعة',
  'السلوك والانضباط',
  'الامتحانات والنتائج',
  'التنبيهات والتنظيم',
  'قوالب سريعة',
];

export const WHATSAPP_TEMPLATES_V2: WhatsappTemplateV2[] = [
  // ===== التسجيل والانضمام =====
  {
    id: 'WT001', category: 'التسجيل والانضمام', status_key: 'welcome_after_registration',
    name: 'رسالة ترحيب بعد التسجيل',
    message: 'السيد ولي أمر / [اسم الطالب]\nنرحب بحضرتك، ونفيدكم بأنه تم تسجيل الطالب لدينا بنجاح، وتم إضافة بياناته على النظام.\nنسأل الله التوفيق له، ونتمنى له فترة دراسية موفقة ومنظمة معنا.\nولأي استفسار يمكن لحضرتك التواصل في أي وقت.\nتحياتي [اسم المدرس]',
    short_message: 'السيد ولي أمر / [اسم الطالب]\nتم تسجيل الطالب لدينا بنجاح على النظام.\nتحياتي [اسم المدرس]',
    variables: ['[اسم الطالب]', '[اسم المدرس]'], tone: 'شبه رسمي', active: true,
  },
  {
    id: 'WT002', category: 'التسجيل والانضمام', status_key: 'group_join_confirmation',
    name: 'تأكيد الانضمام للمجموعة',
    message: 'السيد ولي أمر / [اسم الطالب]\nنحيط علم حضرتك بأنه تم ضم الطالب إلى المجموعة: [المجموعة] بنجاح،\nوميعاد المجموعة هو: [اليوم] - [الوقت].\nبرجاء الالتزام بالمواعيد من أول حصة، مع تمنياتنا بالتوفيق والتميز.\nتحياتي [اسم المدرس]',
    short_message: 'السيد ولي أمر / [اسم الطالب]\nتم ضم الطالب إلى المجموعة [المجموعة] بنجاح، وميعادها: [اليوم] - [الوقت].\nتحياتي [اسم المدرس]',
    variables: ['[اسم الطالب]', '[اليوم]', '[الوقت]', '[المجموعة]', '[اسم المدرس]'], tone: 'شبه رسمي', active: true,
  },
  {
    id: 'WT003', category: 'التسجيل والانضمام', status_key: 'first_lesson_reminder',
    name: 'تذكير بموعد أول حصة',
    message: 'السيد ولي أمر / [اسم الطالب]\nنفيد حضرتك بأن أول حصة للطالب ستكون يوم [اليوم] الموافق [التاريخ] في تمام الساعة [الوقت].\nبرجاء الالتزام بالحضور قبل الموعد بوقت مناسب.\nوشكرًا لتعاونكم الكريم.\nتحياتي [اسم المدرس]',
    short_message: 'السيد ولي أمر / [اسم الطالب]\nأول حصة للطالب يوم [اليوم] الموافق [التاريخ] الساعة [الوقت].\nتحياتي [اسم المدرس]',
    variables: ['[اسم الطالب]', '[اليوم]', '[التاريخ]', '[الوقت]', '[اسم المدرس]'], tone: 'شبه رسمي', active: true,
  },
  // ===== الحضور والغياب =====
  {
    id: 'WT004', category: 'الحضور والغياب', status_key: 'attendance_present',
    name: 'حضور الطالب',
    message: 'السيد ولي أمر / [اسم الطالب]\nنحيط علم حضرتك بأن الطالب حضر حصة اليوم بنجاح، وتم تسجيل حضوره على النظام.\nمع تمنياتنا له بدوام الالتزام والتفوق.\nتحياتي [اسم المدرس]',
    short_message: 'السيد ولي أمر / [اسم الطالب]\nتم تسجيل حضور الطالب اليوم بنجاح.\nتحياتي [اسم المدرس]',
    variables: ['[اسم الطالب]', '[اسم المدرس]'], tone: 'شبه رسمي', active: true,
  },
  {
    id: 'WT005', category: 'الحضور والغياب', status_key: 'attendance_absent',
    name: 'غياب الطالب',
    message: 'السيد ولي أمر / [اسم الطالب]\nنحيط علم حضرتك بأن الطالب قد تغيب عن حصة اليوم، ولم يتم تسجيل حضور له.\nبرجاء المتابعة ومعرفة سبب الغياب، حرصًا على انتظامه الدراسي.\nتحياتي [اسم المدرس]',
    short_message: 'السيد ولي أمر / [اسم الطالب]\nالطالب تغيب عن حصة اليوم، برجاء المتابعة.\nتحياتي [اسم المدرس]',
    variables: ['[اسم الطالب]', '[اسم المدرس]'], tone: 'شبه رسمي', active: true,
  },
  {
    id: 'WT006', category: 'الحضور والغياب', status_key: 'attendance_excused_absence',
    name: 'غياب بعذر',
    message: 'السيد ولي أمر / [اسم الطالب]\nتم تسجيل غياب الطالب عن حصة اليوم بعذر، وذلك بناءً على الإفادة المقدمة.\nونسأل الله له السلامة، ونرجو له دوام التوفيق والانتظام.\nتحياتي [اسم المدرس]',
    short_message: 'السيد ولي أمر / [اسم الطالب]\nتم تسجيل غياب الطالب بعذر.\nتحياتي [اسم المدرس]',
    variables: ['[اسم الطالب]', '[اسم المدرس]'], tone: 'شبه رسمي', active: true,
  },
  {
    id: 'WT007', category: 'الحضور والغياب', status_key: 'attendance_repeated_absence',
    name: 'تكرار الغياب',
    message: 'السيد ولي أمر / [اسم الطالب]\nنود لفت انتباه حضرتك إلى أن هناك تكرارًا في غياب الطالب خلال الفترة الأخيرة،\nحيث تغيب عن [عدد الغيابات] حصص، وهو ما قد يؤثر على مستواه الدراسي وانتظامه داخل المجموعة.\nبرجاء المتابعة والاهتمام خلال الفترة القادمة.\nتحياتي [اسم المدرس]',
    short_message: 'السيد ولي أمر / [اسم الطالب]\nهناك تكرار في غياب الطالب ([عدد الغيابات] مرات)، برجاء المتابعة.\nتحياتي [اسم المدرس]',
    variables: ['[اسم الطالب]', '[عدد الغيابات]', '[اسم المدرس]'], tone: 'تنبيهي', active: true,
  },
  {
    id: 'WT008', category: 'الحضور والغياب', status_key: 'attendance_late_arrival',
    name: 'التأخر عن الموعد',
    message: 'السيد ولي أمر / [اسم الطالب]\nنحيط علم حضرتك بأن الطالب حضر اليوم متأخرًا عن موعد الحصة.\nبرجاء التنبيه عليه بضرورة الالتزام بالموعد، حتى يستفيد بشكل كامل من الحصة.\nتحياتي [اسم المدرس]',
    short_message: 'السيد ولي أمر / [اسم الطالب]\nالطالب حضر اليوم متأخرًا عن موعد الحصة.\nتحياتي [اسم المدرس]',
    variables: ['[اسم الطالب]', '[اسم المدرس]'], tone: 'تنبيهي', active: true,
  },
  // ===== الاشتراكات والمدفوعات =====
  {
    id: 'WT009', category: 'الاشتراكات والمدفوعات', status_key: 'payment_subscription_due',
    name: 'تذكير بسداد الاشتراك',
    message: 'السيد ولي أمر / [اسم الطالب]\nنذكّر حضرتك بأن اشتراك الطالب عن شهر [اسم الشهر] مستحق السداد، وقيمته [المبلغ] جنيه.\nبرجاء التكرم بسداد الاشتراك في أقرب وقت، مع خالص الشكر لتعاونكم.\nتحياتي [اسم المدرس]',
    short_message: 'السيد ولي أمر / [اسم الطالب]\nبرجاء التكرم بسداد اشتراك شهر [اسم الشهر] بقيمة [المبلغ] جنيه.\nتحياتي [اسم المدرس]',
    variables: ['[اسم الطالب]', '[اسم الشهر]', '[المبلغ]', '[اسم المدرس]'], tone: 'شبه رسمي', active: true,
  },
  {
    id: 'WT010', category: 'الاشتراكات والمدفوعات', status_key: 'payment_outstanding_balance',
    name: 'وجود متأخرات',
    message: 'السيد ولي أمر / [اسم الطالب]\nنحيط علم حضرتك بوجود متأخرات مالية على الطالب بقيمة [المبلغ المتبقي] جنيه.\nبرجاء التكرم بتسوية المبلغ المستحق في أقرب فرصة، حتى يستمر انتظام الملف المالي للطالب.\nتحياتي [اسم المدرس]',
    short_message: 'السيد ولي أمر / [اسم الطالب]\nعلى الطالب متأخرات مالية بقيمة [المبلغ المتبقي] جنيه.\nتحياتي [اسم المدرس]',
    variables: ['[اسم الطالب]', '[المبلغ المتبقي]', '[اسم المدرس]'], tone: 'تنبيهي', active: true,
  },
  {
    id: 'WT011', category: 'الاشتراكات والمدفوعات', status_key: 'payment_received_confirmation',
    name: 'تأكيد استلام الدفع',
    message: 'السيد ولي أمر / [اسم الطالب]\nنفيد حضرتك بأنه تم استلام مبلغ [المبلغ المدفوع] جنيه، قيمة الاشتراك عن شهر [اسم الشهر].\nوالمتبقي على الطالب هو [المبلغ المتبقي] جنيه.\nونشكر حضرتك على حسن التعاون والالتزام.\nتحياتي [اسم المدرس]',
    short_message: 'السيد ولي أمر / [اسم الطالب]\nتم استلام مبلغ [المبلغ المدفوع] جنيه عن شهر [اسم الشهر]. المتبقي [المبلغ المتبقي] جنيه.\nتحياتي [اسم المدرس]',
    variables: ['[اسم الطالب]', '[المبلغ المدفوع]', '[المبلغ المتبقي]', '[اسم الشهر]', '[اسم المدرس]'], tone: 'شبه رسمي', active: true,
  },
  {
    id: 'WT012', category: 'الاشتراكات والمدفوعات', status_key: 'payment_partial_paid',
    name: 'سداد جزئي',
    message: 'السيد ولي أمر / [اسم الطالب]\nنحيط علم حضرتك بأنه تم استلام مبلغ [المبلغ المدفوع] جنيه من قيمة الاشتراك الشهري البالغ [المبلغ] جنيه،\nوالمتبقي على الطالب هو [المبلغ المتبقي] جنيه.\nبرجاء استكمال المبلغ في الموعد المناسب.\nتحياتي [اسم المدرس]',
    short_message: 'السيد ولي أمر / [اسم الطالب]\nتم استلام [المبلغ المدفوع] جنيه من أصل [المبلغ] جنيه، والمتبقي [المبلغ المتبقي] جنيه.\nتحياتي [اسم المدرس]',
    variables: ['[اسم الطالب]', '[المبلغ]', '[المبلغ المدفوع]', '[المبلغ المتبقي]', '[اسم المدرس]'], tone: 'شبه رسمي', active: true,
  },
  // ===== المستوى والتقييم =====
  {
    id: 'WT013', category: 'المستوى والتقييم', status_key: 'evaluation_good_performance',
    name: 'إشادة بالمستوى',
    message: 'السيد ولي أمر / [اسم الطالب]\nيسعدني إبلاغ حضرتك بأن الطالب كان مستواه اليوم جيد جدًا،\nوأظهر التزامًا ومشاركة طيبة أثناء الحصة.\nمع تمنياتنا له بمزيد من التقدم والتفوق.\nتحياتي [اسم المدرس]',
    short_message: 'السيد ولي أمر / [اسم الطالب]\nمستوى الطالب اليوم كان جيد جدًا.\nتحياتي [اسم المدرس]',
    variables: ['[اسم الطالب]', '[اسم المدرس]'], tone: 'إيجابي', active: true,
  },
  {
    id: 'WT014', category: 'المستوى والتقييم', status_key: 'evaluation_average_needs_followup',
    name: 'مستوى متوسط يحتاج متابعة',
    message: 'السيد ولي أمر / [اسم الطالب]\nنحيط علم حضرتك بأن مستوى الطالب اليوم كان متوسطًا (الدرجة: [الدرجة])،\nويحتاج إلى مزيد من التركيز والمراجعة خلال الفترة القادمة.\nبرجاء متابعته وتشجيعه بشكل مستمر.\nتحياتي [اسم المدرس]',
    short_message: 'السيد ولي أمر / [اسم الطالب]\nمستوى الطالب اليوم متوسط ([الدرجة]) ويحتاج متابعة.\nتحياتي [اسم المدرس]',
    variables: ['[اسم الطالب]', '[الدرجة]', '[اسم المدرس]'], tone: 'تنبيهي', active: true,
  },
  {
    id: 'WT015', category: 'المستوى والتقييم', status_key: 'evaluation_low_performance',
    name: 'ضعف في الأداء',
    message: 'السيد ولي أمر / [اسم الطالب]\nنود إفادة حضرتك بأن مستوى الطالب في الحصة الأخيرة كان أقل من المتوقع (الدرجة: [الدرجة])،\nويحتاج إلى متابعة أقوى في المذاكرة والالتزام.\nبرجاء الاهتمام خلال الأيام القادمة حتى يتحسن مستواه بصورة أفضل.\nتحياتي [اسم المدرس]',
    short_message: 'السيد ولي أمر / [اسم الطالب]\nمستوى الطالب في الحصة الأخيرة أقل من المتوقع ([الدرجة]) ويحتاج متابعة.\nتحياتي [اسم المدرس]',
    variables: ['[اسم الطالب]', '[الدرجة]', '[اسم المدرس]'], tone: 'تنبيهي', active: true,
  },
  {
    id: 'WT016', category: 'المستوى والتقييم', status_key: 'evaluation_excellent_performance',
    name: 'تميز واضح',
    message: 'السيد ولي أمر / [اسم الطالب]\nأحب أن أوصل لحضرتك أن الطالب كان متميزًا جدًا في الحصة اليوم (الدرجة: [الدرجة])،\nسواء من حيث الفهم أو المشاركة أو الالتزام.\nونتمنى له الاستمرار على هذا المستوى المشرف.\nتحياتي [اسم المدرس]',
    short_message: 'السيد ولي أمر / [اسم الطالب]\nالطالب كان متميزًا جدًا في الحصة اليوم ([الدرجة]).\nتحياتي [اسم المدرس]',
    variables: ['[اسم الطالب]', '[الدرجة]', '[اسم المدرس]'], tone: 'إيجابي', active: true,
  },
  // ===== الواجب والمتابعة =====
  {
    id: 'WT017', category: 'الواجب والمتابعة', status_key: 'homework_not_done',
    name: 'عدم حل الواجب',
    message: 'السيد ولي أمر / [اسم الطالب]\nنحيط علم حضرتك بأن الطالب لم يقم بحل الواجب المطلوب بالشكل المطلوب.\nبرجاء متابعته والاهتمام بإنجاز الواجبات أولًا بأول، لما لذلك من أثر كبير على مستواه.\nتحياتي [اسم المدرس]',
    short_message: 'السيد ولي أمر / [اسم الطالب]\nالطالب لم يقم بحل الواجب المطلوب.\nتحياتي [اسم المدرس]',
    variables: ['[اسم الطالب]', '[اسم المدرس]'], tone: 'تنبيهي', active: true,
  },
  {
    id: 'WT018', category: 'الواجب والمتابعة', status_key: 'homework_done_regularly',
    name: 'حل الواجب بانتظام',
    message: 'السيد ولي أمر / [اسم الطالب]\nنفيد حضرتك بأن الطالب ملتزم بحل الواجب بشكل جيد ومنتظم،\nوذلك ينعكس بصورة إيجابية على مستواه داخل الحصة.\nمع تمنياتنا له بمزيد من التفوق.\nتحياتي [اسم المدرس]',
    short_message: 'السيد ولي أمر / [اسم الطالب]\nالطالب ملتزم بحل الواجب بشكل جيد ومنتظم.\nتحياتي [اسم المدرس]',
    variables: ['[اسم الطالب]', '[اسم المدرس]'], tone: 'إيجابي', active: true,
  },
  {
    id: 'WT019', category: 'الواجب والمتابعة', status_key: 'homework_review_required',
    name: 'ضرورة المراجعة',
    message: 'السيد ولي أمر / [اسم الطالب]\nبرجاء متابعة الطالب في مراجعة الدروس السابقة،\nلأن الفترة الحالية تحتاج إلى تثبيت المعلومات والتركيز على النقاط الأساسية.\nونشكر لحضرتك حسن المتابعة.\nتحياتي [اسم المدرس]',
    short_message: 'السيد ولي أمر / [اسم الطالب]\nبرجاء متابعة الطالب في مراجعة الدروس السابقة.\nتحياتي [اسم المدرس]',
    variables: ['[اسم الطالب]', '[اسم المدرس]'], tone: 'تنبيهي', active: true,
  },
  // ===== السلوك والانضباط =====
  {
    id: 'WT020', category: 'السلوك والانضباط', status_key: 'behavior_excellent_discipline',
    name: 'انضباط ممتاز',
    message: 'السيد ولي أمر / [اسم الطالب]\nنحيط علم حضرتك بأن الطالب ملتزم بشكل ممتاز داخل الحصة،\nمن حيث الحضور والانضباط واحترام التعليمات.\nوهذا أمر يسعدنا ونقدره كثيرًا.\nتحياتي [اسم المدرس]',
    short_message: 'السيد ولي أمر / [اسم الطالب]\nالطالب ملتزم بشكل ممتاز داخل الحصة.\nتحياتي [اسم المدرس]',
    variables: ['[اسم الطالب]', '[اسم المدرس]'], tone: 'إيجابي', active: true,
  },
  {
    id: 'WT021', category: 'السلوك والانضباط', status_key: 'behavior_minor_note',
    name: 'ملاحظة سلوكية بسيطة',
    message: 'السيد ولي أمر / [اسم الطالب]\nنود لفت نظر حضرتك إلى وجود بعض الملاحظات البسيطة على سلوك الطالب داخل الحصة،\nونرجو التنبيه عليه بضرورة الالتزام الكامل بالتعليمات أثناء الشرح.\nونثق أن المتابعة من حضرتك سيكون لها أثر إيجابي كبير.\nتحياتي [اسم المدرس]',
    short_message: 'السيد ولي أمر / [اسم الطالب]\nتوجد بعض الملاحظات البسيطة على سلوك الطالب داخل الحصة.\nتحياتي [اسم المدرس]',
    variables: ['[اسم الطالب]', '[اسم المدرس]'], tone: 'تنبيهي', active: true,
  },
  {
    id: 'WT022', category: 'السلوك والانضباط', status_key: 'behavior_needs_improvement',
    name: 'ضرورة تحسين الالتزام',
    message: 'السيد ولي أمر / [اسم الطالب]\nنحيط علم حضرتك بأن الطالب يحتاج إلى تحسين مستوى الالتزام داخل الحصة،\nسواء من حيث التركيز أو الانتباه أو تنفيذ التعليمات.\nبرجاء المتابعة الجادة خلال الفترة القادمة.\nتحياتي [اسم المدرس]',
    short_message: 'السيد ولي أمر / [اسم الطالب]\nالطالب يحتاج إلى تحسين مستوى الالتزام داخل الحصة.\nتحياتي [اسم المدرس]',
    variables: ['[اسم الطالب]', '[اسم المدرس]'], tone: 'تنبيهي', active: true,
  },
  // ===== الامتحانات والنتائج =====
  {
    id: 'WT023', category: 'الامتحانات والنتائج', status_key: 'exam_good_result',
    name: 'نتيجة امتحان جيدة',
    message: 'السيد ولي أمر / [اسم الطالب]\nنفيد حضرتك بأن الطالب حصل في التقييم أو الامتحان الأخير على درجة [الدرجة].\nوالنتيجة تعتبر جيدة، ونتمنى له مزيدًا من التقدم في القادم.\nتحياتي [اسم المدرس]',
    short_message: 'السيد ولي أمر / [اسم الطالب]\nحصل الطالب في التقييم الأخير على درجة [الدرجة].\nتحياتي [اسم المدرس]',
    variables: ['[اسم الطالب]', '[الدرجة]', '[اسم المدرس]'], tone: 'شبه رسمي', active: true,
  },
  {
    id: 'WT024', category: 'الامتحانات والنتائج', status_key: 'exam_low_result',
    name: 'نتيجة ضعيفة',
    message: 'السيد ولي أمر / [اسم الطالب]\nنحيط علم حضرتك بأن نتيجة الطالب في التقييم أو الامتحان الأخير (الدرجة: [الدرجة]) كانت أقل من المتوقع،\nويحتاج إلى مراجعة واهتمام أكبر خلال الفترة القادمة.\nبرجاء المتابعة المستمرة معه حتى يتحسن مستواه.\nتحياتي [اسم المدرس]',
    short_message: 'السيد ولي أمر / [اسم الطالب]\nنتيجة الطالب الأخيرة ([الدرجة]) أقل من المتوقع وتحتاج متابعة.\nتحياتي [اسم المدرس]',
    variables: ['[اسم الطالب]', '[الدرجة]', '[اسم المدرس]'], tone: 'تنبيهي', active: true,
  },
  {
    id: 'WT025', category: 'الامتحانات والنتائج', status_key: 'exam_excellent_result',
    name: 'تفوق في الامتحان',
    message: 'السيد ولي أمر / [اسم الطالب]\nيسعدني إبلاغ حضرتك بأن الطالب حقق نتيجة مميزة في التقييم أو الامتحان الأخير (الدرجة: [الدرجة])،\nوأظهر مستوى طيبًا جدًا يستحق الإشادة.\nمع تمنياتنا له بدوام التفوق والنجاح.\nتحياتي [اسم المدرس]',
    short_message: 'السيد ولي أمر / [اسم الطالب]\nالطالب حقق نتيجة مميزة في التقييم الأخير ([الدرجة]).\nتحياتي [اسم المدرس]',
    variables: ['[اسم الطالب]', '[الدرجة]', '[اسم المدرس]'], tone: 'إيجابي', active: true,
  },
  // ===== التنبيهات والتنظيم =====
  {
    id: 'WT026', category: 'التنبيهات والتنظيم', status_key: 'schedule_group_time_changed',
    name: 'تغيير موعد مجموعة',
    message: 'السيد ولي أمر / [اسم الطالب]\nنحيط علم حضرتك بأنه تم تعديل موعد المجموعة [المجموعة]،\nليصبح يوم [اليوم] الساعة [الوقت].\nبرجاء التكرم بمراعاة الموعد الجديد، وشكرًا لتعاونكم.\nتحياتي [اسم المدرس]',
    short_message: 'السيد ولي أمر / [اسم الطالب]\nتم تعديل موعد المجموعة [المجموعة] إلى [اليوم] الساعة [الوقت].\nتحياتي [اسم المدرس]',
    variables: ['[اسم الطالب]', '[اليوم]', '[الوقت]', '[المجموعة]', '[اسم المدرس]'], tone: 'شبه رسمي', active: true,
  },
  {
    id: 'WT027', category: 'التنبيهات والتنظيم', status_key: 'schedule_lesson_cancelled',
    name: 'إلغاء حصة',
    message: 'السيد ولي أمر / [اسم الطالب]\nنعتذر لحضرتك، ونفيدكم بأنه تم إلغاء حصة يوم [اليوم] الموافق [التاريخ] لظرف طارئ.\nوسيتم إبلاغكم بالموعد البديل في أقرب وقت.\nوشكرًا لتفهمكم الكريم.\nتحياتي [اسم المدرس]',
    short_message: 'السيد ولي أمر / [اسم الطالب]\nتم إلغاء حصة يوم [اليوم] الموافق [التاريخ] لظرف طارئ.\nتحياتي [اسم المدرس]',
    variables: ['[اسم الطالب]', '[اليوم]', '[التاريخ]', '[اسم المدرس]'], tone: 'شبه رسمي', active: true,
  },
  {
    id: 'WT028', category: 'التنبيهات والتنظيم', status_key: 'schedule_before_lesson_reminder',
    name: 'تذكير قبل الحصة',
    message: 'السيد ولي أمر / [اسم الطالب]\nنذكّر حضرتك بموعد حصة الطالب اليوم في تمام الساعة [الوقت] بمجموعة [المجموعة].\nبرجاء الالتزام بالحضور في الموعد المحدد.\nتحياتي [اسم المدرس]',
    short_message: 'السيد ولي أمر / [اسم الطالب]\nتذكير بموعد حصة الطالب اليوم الساعة [الوقت].\nتحياتي [اسم المدرس]',
    variables: ['[اسم الطالب]', '[الوقت]', '[المجموعة]', '[اسم المدرس]'], tone: 'شبه رسمي', active: true,
  },
  {
    id: 'WT029', category: 'التنبيهات والتنظيم', status_key: 'schedule_student_card_sent',
    name: 'إرسال بطاقة الطالب',
    message: 'السيد ولي أمر / [اسم الطالب]\nمرفق لحضرتك بطاقة الطالب الخاصة به،\nوبرجاء الاحتفاظ بها لسهولة المتابعة والتنظيم عند الحاجة.\nوشكرًا لتعاونكم.\nتحياتي [اسم المدرس]',
    short_message: 'السيد ولي أمر / [اسم الطالب]\nمرفق بطاقة الطالب الخاصة به.\nتحياتي [اسم المدرس]',
    variables: ['[اسم الطالب]', '[اسم المدرس]'], tone: 'شبه رسمي', active: true,
  },
  {
    id: 'WT030', category: 'التنبيهات والتنظيم', status_key: 'schedule_monthly_followup',
    name: 'متابعة شهرية مختصرة',
    message: 'السيد ولي أمر / [اسم الطالب]\nنحيط علم حضرتك بمتابعة الطالب خلال شهر [اسم الشهر]،\nحيث حضر [عدد الحضور] حصة من أصل [عدد الحصص] حصة.\nوالطالب حالته الحالية: [حالة الطالب].\nونرجو استمرار التعاون لما فيه مصلحة الطالب.\nتحياتي [اسم المدرس]',
    short_message: 'السيد ولي أمر / [اسم الطالب]\nمتابعة شهرية للطالب - حضور [عدد الحضور] من [عدد الحصص] حصة، وحالته: [حالة الطالب].\nتحياتي [اسم المدرس]',
    variables: ['[اسم الطالب]', '[اسم الشهر]', '[عدد الحضور]', '[عدد الحصص]', '[حالة الطالب]', '[اسم المدرس]'], tone: 'شبه رسمي', active: true,
  },
  // ===== قوالب سريعة =====
  {
    id: 'WT031', category: 'قوالب سريعة', status_key: 'quick_absent',
    name: 'غياب سريع',
    message: 'السيد ولي أمر / [اسم الطالب]\nالطالب تغيب عن حصة اليوم، برجاء المتابعة.\nتحياتي [اسم المدرس]',
    short_message: 'السيد ولي أمر / [اسم الطالب]\nالطالب تغيب عن حصة اليوم.\nتحياتي [اسم المدرس]',
    variables: ['[اسم الطالب]', '[اسم المدرس]'], tone: 'سريع', active: true,
  },
  {
    id: 'WT032', category: 'قوالب سريعة', status_key: 'quick_present',
    name: 'حضور سريع',
    message: 'السيد ولي أمر / [اسم الطالب]\nتم تسجيل حضور الطالب اليوم بنجاح.\nتحياتي [اسم المدرس]',
    short_message: 'السيد ولي أمر / [اسم الطالب]\nتم تسجيل حضور الطالب اليوم.\nتحياتي [اسم المدرس]',
    variables: ['[اسم الطالب]', '[اسم المدرس]'], tone: 'سريع', active: true,
  },
  {
    id: 'WT033', category: 'قوالب سريعة', status_key: 'quick_subscription_due',
    name: 'اشتراك سريع',
    message: 'السيد ولي أمر / [اسم الطالب]\nبرجاء التكرم بسداد اشتراك شهر [اسم الشهر] بقيمة [المبلغ] جنيه.\nتحياتي [اسم المدرس]',
    short_message: 'السيد ولي أمر / [اسم الطالب]\nبرجاء سداد اشتراك شهر [اسم الشهر].\nتحياتي [اسم المدرس]',
    variables: ['[اسم الطالب]', '[اسم الشهر]', '[المبلغ]', '[اسم المدرس]'], tone: 'سريع', active: true,
  },
  {
    id: 'WT034', category: 'قوالب سريعة', status_key: 'quick_praise',
    name: 'إشادة سريعة',
    message: 'السيد ولي أمر / [اسم الطالب]\nالطالب كان ممتازًا اليوم من حيث الالتزام والمستوى.\nتحياتي [اسم المدرس]',
    short_message: 'السيد ولي أمر / [اسم الطالب]\nالطالب كان ممتازًا اليوم.\nتحياتي [اسم المدرس]',
    variables: ['[اسم الطالب]', '[اسم المدرس]'], tone: 'سريع', active: true,
  },
  {
    id: 'WT035', category: 'قوالب سريعة', status_key: 'quick_followup_needed',
    name: 'متابعة سريعة',
    message: 'السيد ولي أمر / [اسم الطالب]\nالطالب يحتاج إلى متابعة أكبر في المذاكرة خلال الفترة الحالية.\nتحياتي [اسم المدرس]',
    short_message: 'السيد ولي أمر / [اسم الطالب]\nالطالب يحتاج إلى متابعة أكبر.\nتحياتي [اسم المدرس]',
    variables: ['[اسم الطالب]', '[اسم المدرس]'], tone: 'سريع', active: true,
  },
];

// Build variables map from real student data
export async function buildStudentVariables(
  studentId: string,
  settings: { teacherName: string; teacherPhone: string; appName: string }
): Promise<Record<string, string>> {
  const { getDB } = await import('./db');
  const { formatArDate, formatArDateShort, arMonthName, scheduleText, GRADE_LABELS_AR, computeMonthlyStats } = await import('./helpers');
  const db = getDB();
  const student = await db.students.get(studentId);
  if (!student) return {};
  const group = student.groupId ? await db.groups.get(student.groupId) : null;
  const now = new Date();
  const arDays = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  // Get this month's attendance & evaluations
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
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
  const stats = computeMonthlyStats(monthAtts, monthEvals);

  // Today's attendance status
  const today = now.toISOString().split('T')[0];
  const todayLessons = lessons.filter(l => l.date.split('T')[0] === today);
  const todayLessonIds = new Set(todayLessons.map(l => l.id));
  const todayAtt = atts.find(a => todayLessonIds.has(a.lessonId));
  const todayStatus = todayAtt ? (todayAtt.status === 'present' ? 'حاضر' : todayAtt.status === 'absent' ? 'غائب' : todayAtt.status === 'excused' ? 'غياب بعذر' : 'متأخر') : 'لم يُسجل';

  // Last evaluation
  const lastEval = evals[evals.length - 1];
  const lastNote = lastEval?.note || 'لا توجد ملاحظات';

  // v6: Use unified computeStudentFinancialStatus for consistency
  const { computeStudentFinancialStatus } = await import('./helpers');
  const payments = await db.payments.where('studentId').equals(studentId).toArray();
  const finStatus = computeStudentFinancialStatus(student, payments, month, year);
  const paidThisMonth = finStatus.totalPaidThisMonth;
  const remaining = finStatus.remaining;

  // Student status text
  let statusText = 'منتظم';
  if (student.status === 'paused') statusText = 'متوقف مؤقتاً';
  else if (student.status === 'archived') statusText = 'مؤرشف';
  else if (student.debt > 0) statusText = `عليه متأخرات بقيمة ${student.debt} ج.م`;
  else if (stats.absent >= 3) statusText = 'كثير الغياب';
  else if (stats.avgTotal >= 27) statusText = 'متفوق';
  else if (stats.avgTotal >= 22) statusText = 'جيد جداً';
  else if (stats.avgTotal >= 15) statusText = 'جيد';
  else if (stats.avgTotal > 0 && stats.avgTotal < 10) statusText = 'ضعيف يحتاج متابعة';

  // Group schedule time
  let scheduleTimeStr = '—';
  if (group) {
    if (group.schedules && group.schedules.length > 0) {
      const s = group.schedules[0];
      const period = s.period === 'am' ? 'ص' : 'م';
      const h = s.hour % 12 || 12;
      scheduleTimeStr = `${h}:${String(s.minute).padStart(2, '0')} ${period}`;
    } else {
      const period = group.schedulePeriod === 'am' ? 'ص' : 'م';
      const h = group.scheduleHour % 12 || 12;
      scheduleTimeStr = `${h}:${String(group.scheduleMinute).padStart(2, '0')} ${period}`;
    }
  }

  return {
    '[اسم الطالب]': student.name,
    '[اليوم]': arDays[now.getDay()],
    '[التاريخ]': formatArDateShort(now.toISOString()),
    '[الوقت]': scheduleTimeStr,
    '[اسم الشهر]': arMonthName(month),
    '[المبلغ]': String(student.monthlyFee),
    '[المبلغ المدفوع]': String(paidThisMonth),
    '[المبلغ المتبقي]': String(remaining),
    '[الدرجة]': lastEval ? `${lastEval.totalScore}/30` : 'غير مُقيّم',
    '[حالة الطالب]': statusText,
    '[الصف]': student.grade,
    '[المجموعة]': group?.name || '—',
    '[ملاحظات المدرس]': lastNote,
    '[عدد الغيابات]': String(stats.absent),
    '[عدد الحصص]': String(stats.lessonsCount),
    '[عدد الحضور]': String(stats.present),
    '[اسم المدرس]': settings.teacherName,
    '[رقم المدرس]': settings.teacherPhone,
  };
}

// Replace variables in template message
export function fillTemplateV2(message: string, vars: Record<string, string>): { filled: string; missing: string[] } {
  let filled = message;
  const missing: string[] = [];
  // Find all [variables] in message
  const matches = message.match(/\[[^\]]+\]/g) || [];
  for (const v of matches) {
    if (v in vars && vars[v] !== '' && vars[v] !== '—' && vars[v] !== '0' && vars[v] !== 'غير مُقيّم') {
      filled = filled.split(v).join(vars[v]);
    } else if (v === '[اسم المدرس]' || v === '[رقم المدرس]') {
      // skip - these always exist
      filled = filled.split(v).join(vars[v] || '');
    } else {
      // Check if value is meaningful
      const value = vars[v];
      if (!value || value === '—' || value === '0' || value === 'غير مُقيّم') {
        missing.push(v);
      }
      filled = filled.split(v).join(value || v);
    }
  }
  return { filled, missing };
}
