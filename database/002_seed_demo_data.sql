-- ============================================================================
-- حقيبة المهام — بيانات تجريبية منفصلة متوافقة مع ملف 001_init_haqibat_almaham.sql
-- الملف: 002_seed_demo_data.sql
-- تنبيه: للاختبار في قاعدة تجريبية فقط ولا يُستورد على بيانات الإنتاج الحقيقية.
-- ============================================================================

SET NAMES utf8mb4;

INSERT INTO `organizations` (`id`, `name`, `tax_registration_number`)
VALUES ('org-01', 'شركة المدار للأعمال والاستشارات', '310482910400003');

INSERT INTO `departments` (`id`, `org_id`, `name`) VALUES
('dept-01', 'org-01', 'الشؤون القانونية'),
('dept-02', 'org-01', 'الوثائق والتراخيص'),
('dept-03', 'org-01', 'العمليات الإدارية'),
('dept-04', 'org-01', 'المالية والضرائب');

INSERT INTO `authorities` (`id`, `org_id`, `name`, `authority_type`) VALUES
('auth-01', 'org-01', 'المديرية العامة للدفاع المدني', 'جهة ترخيص'),
('auth-02', 'org-01', 'هيئة الزكاة والضريبة والجمارك', 'جهة تنظيمية وضريبية'),
('auth-03', 'org-01', 'أمانة محافظة جدة', 'أمانة / بلدية'),
('auth-04', 'org-01', 'وزارة التجارة', 'جهة تسجيل تجاري');

INSERT INTO `specialists` (`id`, `org_id`, `department_id`, `department_name`, `name`, `role_title`, `mobile`, `email`, `is_active`) VALUES
('spec-01', 'org-01', 'dept-01', 'الشؤون القانونية', 'فهد الدوسري', 'مستشار قانوني أول', '0550112233', 'fahad.legal@example.sa', 1),
('spec-02', 'org-01', 'dept-02', 'الوثائق والتراخيص', 'نورة الحربي', 'أخصائية امتثال وتراخيص', '0550445566', 'noura.compliance@example.sa', 1),
('spec-03', 'org-01', 'dept-03', 'العمليات الإدارية', 'خالد الشهري', 'منسق اتصالات إدارية', '0550778899', 'khaled.admin@example.sa', 1),
('spec-04', 'org-01', 'dept-04', 'المالية والضرائب', 'سارة القحطاني', 'محاسبة ضريبية', '0550991100', 'sara.tax@example.sa', 1);

INSERT INTO `cases` (`id`, `org_id`, `case_number`, `title`, `parties`, `court`, `status`, `lawyer_specialist_id`, `notes`) VALUES
('case-01', 'org-01', '47201948', 'مطالبة مستحقات عقد توريد التجهيزات المكتبية', 'شركة المدار ضد مؤسسة الأفق التجارية', 'المحكمة التجارية بالرياض — الدائرة الثالثة', 'قيد المرافعة', 'spec-01', 'تجهيز المذكرة الختامية وإرفاق فواتير الاستلام الموقعة.'),
('case-02', 'org-01', '47202511', 'اعتراض على غرامة بلدية — فرع جدة', 'شركة المدار ضد أمانة محافظة جدة', 'المحكمة الإدارية بجدة', 'مفتوحة', 'spec-01', 'تم تقديم لائحة الاعتراض وبانتظار تحديد موعد المرافعة الثانية.');

INSERT INTO `case_sessions` (`id`, `org_id`, `case_id`, `title`, `scheduled_at`, `status`, `outcome`, `specialist_id`, `location`, `notes`) VALUES
('sess-01', 'org-01', 'case-01', 'جلسة تقديم المذكرة الختامية والبينات', DATE_ADD(CURDATE(), INTERVAL 1 DAY) + INTERVAL 10 HOUR + INTERVAL 30 MINUTE, 'مجدولة', NULL, 'spec-01', 'عن بُعد — منصة ناجز', 'التأكد من رفع المرفقات قبل موعد الجلسة بساعة.'),
('sess-02', 'org-01', 'case-02', 'جلسة الاستماع الأولى للاعتراض الإداري', DATE_ADD(CURDATE(), INTERVAL 6 DAY) + INTERVAL 9 HOUR + INTERVAL 15 MINUTE, 'مجدولة', NULL, 'spec-01', 'القاعة 4 — المحكمة الإدارية بجدة', 'إحضار أصل السجل التجاري ورخصة الفرع.');

INSERT INTO `document_categories` (`id`, `org_id`, `name`) VALUES
('cat-health', 'org-01', 'تأمين صحي'),
('cat-vehicles', 'org-01', 'تأمين مركبات'),
('cat-municipal', 'org-01', 'رخص بلدية'),
('cat-records', 'org-01', 'سجلات'),
('cat-certs', 'org-01', 'شهادات'),
('cat-iqamas', 'org-01', 'إقامات'),
('cat-contracts', 'org-01', 'عقود');

INSERT INTO `task_types` (`id`, `org_id`, `name`, `is_admin_kind`, `is_renewal_kind`) VALUES
('ttype-judicial', 'org-01', 'قضائية', 0, 0),
('ttype-admin', 'org-01', 'إدارية', 1, 0),
('ttype-renewal', 'org-01', 'تجديد', 0, 1);

INSERT INTO `documents` (`id`, `org_id`, `authority_id`, `category_id`, `name`, `doc_type`, `reference_number`, `issuing_authority`, `specialist_id`, `issue_date`, `expiry_date`, `notes`) VALUES
('doc-01', 'org-01', 'auth-01', 'cat-municipal', 'رخصة الدفاع المدني — المقر الرئيسي', 'رخص بلدية', 'CD-992014', 'المديرية العامة للدفاع المدني', 'spec-02', DATE_SUB(CURDATE(), INTERVAL 350 DAY), DATE_ADD(CURDATE(), INTERVAL 14 DAY), 'يتطلب فحص طفايات الحريق وعقد الصيانة السنوي.'),
('doc-02', 'org-01', 'auth-02', 'cat-certs', 'شهادة الزكاة والدخل السنوية', 'شهادات', 'ZATCA-441209', 'هيئة الزكاة والضريبة والجمارك', 'spec-04', DATE_SUB(CURDATE(), INTERVAL 365 DAY), CURDATE(), 'تنتهي اليوم — يجب سداد الفاتورة وإصدار الشهادة المحدثة.'),
('doc-03', 'org-01', 'auth-03', 'cat-municipal', 'رخصة نشاط تجاري — فرع جدة', 'رخص بلدية', 'BAL-33812', 'أمانة محافظة جدة', 'spec-02', DATE_SUB(CURDATE(), INTERVAL 380 DAY), DATE_SUB(CURDATE(), INTERVAL 5 DAY), 'متأخرة منذ 5 أيام.'),
('doc-04', 'org-01', 'auth-04', 'cat-records', 'السجل التجاري الرئيسي', 'سجلات', '1010558291', 'وزارة التجارة', 'spec-02', DATE_SUB(CURDATE(), INTERVAL 180 DAY), DATE_ADD(CURDATE(), INTERVAL 185 DAY), 'سارٍ ومحدث.'),
('doc-05', 'org-01', 'auth-04', 'cat-contracts', 'عقد تأسيس الشركة والملحق المعدل', 'عقود', 'MOA-101055', 'وزارة التجارة — التوثيق', 'spec-01', DATE_SUB(CURDATE(), INTERVAL 900 DAY), NULL, 'وثيقة دائمة بلا تاريخ انتهاء.');

INSERT INTO `document_renewals` (`id`, `document_id`, `previous_expiry_date`, `new_expiry_date`, `notes`, `actor_name`, `renewed_at`) VALUES
('ren-01', 'doc-01', DATE_SUB(CURDATE(), INTERVAL 715 DAY), DATE_ADD(CURDATE(), INTERVAL 14 DAY), 'تم التجديد السنوي السابق بعد مطابقة اشتراطات السلامة.', 'نورة الحربي', NOW());

INSERT INTO `tasks` (`id`, `org_id`, `type_id`, `type`, `title`, `specialist_id`, `department_id`, `department_name`, `priority`, `status`, `due_date`, `actual_delivery_date`, `letter_number`, `authority_name`, `received_date`, `document_id`, `case_id`, `session_id`, `notes`) VALUES
('task-01', 'org-01', 'ttype-judicial', 'قضائية', 'إعداد المذكرة الختامية لقضية التجهيزات المكتبية', 'spec-01', 'dept-01', 'الشؤون القانونية', 'عاجلة', 'قيد التنفيذ', CURDATE(), NULL, NULL, NULL, NULL, NULL, 'case-01', 'sess-01', 'تضمين جدول الفواتير وتقرير الاستلام.'),
('task-02', 'org-01', 'ttype-admin', 'إدارية', 'الرد على خطاب استفسار مكتب العمل رقم 1142', 'spec-03', 'dept-03', 'العمليات الإدارية', 'مرتفعة', 'قيد التنفيذ', DATE_SUB(CURDATE(), INTERVAL 3 DAY), NULL, 'خ-1142/1447', 'وزارة الموارد البشرية والتنمية الاجتماعية', DATE_SUB(CURDATE(), INTERVAL 8 DAY), NULL, NULL, NULL, 'تجهيز كشف العقود.'),
('task-03', 'org-01', 'ttype-renewal', 'تجديد', 'استكمال فحص السلامة لتجديد رخصة الدفاع المدني', 'spec-02', 'dept-02', 'الوثائق والتراخيص', 'مرتفعة', 'جديدة', DATE_ADD(CURDATE(), INTERVAL 2 DAY), NULL, NULL, NULL, NULL, 'doc-01', NULL, NULL, 'مهمة مرتبطة بالرخصة.');
