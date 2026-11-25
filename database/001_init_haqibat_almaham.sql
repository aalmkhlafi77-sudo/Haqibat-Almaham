-- ============================================================================
-- حقيبة المهام — ملف إنشاء الجداول الأولي المتوافق مع MySQL 8+ (هوستنجر)
-- الملف: 001_init_haqibat_almaham.sql
-- الترميز: utf8mb4 / utf8mb4_unicode_ci لدعم النصوص العربية الكاملة
-- ملاحظة: أُعد هذا الملف للمرحلة الثانية (الربط مع Express + MySQL)، وتستمر
--        المعاينة في المرحلة الأولى على التخزين المحلي بنفس المعرّفات والحقول.
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 1. المنشآت
CREATE TABLE IF NOT EXISTS `organizations` (
  `id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `tax_registration_number` VARCHAR(64) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_organizations_tax_number` (`tax_registration_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. الأقسام
CREATE TABLE IF NOT EXISTS `departments` (
  `id` VARCHAR(64) NOT NULL,
  `org_id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_departments_org_name` (`org_id`, `name`),
  CONSTRAINT `fk_departments_org` FOREIGN KEY (`org_id`) REFERENCES `organizations` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. الجهات الرسمية والاعتبارية
CREATE TABLE IF NOT EXISTS `authorities` (
  `id` VARCHAR(64) NOT NULL,
  `org_id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(255) NOT NULL,
  `authority_type` VARCHAR(100) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_authorities_org_name` (`org_id`, `name`),
  CONSTRAINT `fk_authorities_org` FOREIGN KEY (`org_id`) REFERENCES `organizations` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. المختصون
CREATE TABLE IF NOT EXISTS `specialists` (
  `id` VARCHAR(64) NOT NULL,
  `org_id` VARCHAR(64) NOT NULL,
  `department_id` VARCHAR(64) NULL,
  `department_name` VARCHAR(150) NOT NULL,
  `name` VARCHAR(180) NOT NULL,
  `role_title` VARCHAR(150) NOT NULL,
  `mobile` VARCHAR(32) NOT NULL,
  `email` VARCHAR(190) NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_specialists_org_active` (`org_id`, `is_active`),
  KEY `idx_specialists_name` (`name`),
  CONSTRAINT `fk_specialists_org` FOREIGN KEY (`org_id`) REFERENCES `organizations` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_specialists_dept` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. القضايا
CREATE TABLE IF NOT EXISTS `cases` (
  `id` VARCHAR(64) NOT NULL,
  `org_id` VARCHAR(64) NOT NULL,
  `case_number` VARCHAR(100) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `parties` TEXT NOT NULL,
  `court` VARCHAR(255) NOT NULL,
  `status` ENUM('مفتوحة', 'قيد المرافعة', 'موقوفة', 'مغلقة') NOT NULL DEFAULT 'مفتوحة',
  `lawyer_specialist_id` VARCHAR(64) NULL,
  `notes` TEXT NULL,
  `archived_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cases_org_status` (`org_id`, `status`),
  KEY `idx_cases_lawyer` (`lawyer_specialist_id`),
  KEY `idx_cases_number` (`case_number`),
  CONSTRAINT `fk_cases_org` FOREIGN KEY (`org_id`) REFERENCES `organizations` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_cases_lawyer` FOREIGN KEY (`lawyer_specialist_id`) REFERENCES `specialists` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. الجلسات المرتبطة بالقضايا (توقيت واضح DATETIME)
CREATE TABLE IF NOT EXISTS `case_sessions` (
  `id` VARCHAR(64) NOT NULL,
  `org_id` VARCHAR(64) NOT NULL,
  `case_id` VARCHAR(64) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `scheduled_at` DATETIME NOT NULL,
  `status` ENUM('مجدولة', 'منعقدة', 'مؤجلة', 'ملغاة') NOT NULL DEFAULT 'مجدولة',
  `outcome` TEXT NULL,
  `specialist_id` VARCHAR(64) NULL,
  `location` VARCHAR(255) NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_sessions_case` (`case_id`),
  KEY `idx_sessions_specialist` (`specialist_id`),
  KEY `idx_sessions_scheduled` (`scheduled_at`),
  CONSTRAINT `fk_sessions_org` FOREIGN KEY (`org_id`) REFERENCES `organizations` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_sessions_case` FOREIGN KEY (`case_id`) REFERENCES `cases` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sessions_specialist` FOREIGN KEY (`specialist_id`) REFERENCES `specialists` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. الوكالات والتفويضات (تواريخ بلا وقت DATE)
CREATE TABLE IF NOT EXISTS `poas` (
  `id` VARCHAR(64) NOT NULL,
  `org_id` VARCHAR(64) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `reference_number` VARCHAR(100) NOT NULL,
  `grantor` VARCHAR(255) NOT NULL,
  `agent` VARCHAR(255) NOT NULL,
  `scope` TEXT NOT NULL,
  `specialist_id` VARCHAR(64) NULL,
  `issue_date` DATE NOT NULL,
  `expiry_date` DATE NULL,
  `status_override` ENUM('مفسوخة') NULL,
  `notes` TEXT NULL,
  `archived_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_poas_org_expiry` (`org_id`, `expiry_date`),
  KEY `idx_poas_specialist` (`specialist_id`),
  CONSTRAINT `fk_poas_org` FOREIGN KEY (`org_id`) REFERENCES `organizations` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_poas_specialist` FOREIGN KEY (`specialist_id`) REFERENCES `specialists` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. الوثائق والتراخيص (تواريخ بلا وقت DATE، وتقبل NULL للوثائق بلا تاريخ)
CREATE TABLE IF NOT EXISTS `documents` (
  `id` VARCHAR(64) NOT NULL,
  `org_id` VARCHAR(64) NOT NULL,
  `authority_id` VARCHAR(64) NULL,
  `name` VARCHAR(255) NOT NULL,
  `doc_type` VARCHAR(120) NOT NULL,
  `reference_number` VARCHAR(120) NOT NULL,
  `issuing_authority` VARCHAR(255) NOT NULL,
  `specialist_id` VARCHAR(64) NULL,
  `issue_date` DATE NULL,
  `expiry_date` DATE NULL,
  `notes` TEXT NULL,
  `archived_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_documents_org_expiry` (`org_id`, `expiry_date`),
  KEY `idx_documents_specialist` (`specialist_id`),
  KEY `idx_documents_archived` (`archived_at`),
  KEY `idx_documents_ref` (`reference_number`),
  CONSTRAINT `fk_documents_org` FOREIGN KEY (`org_id`) REFERENCES `organizations` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_documents_authority` FOREIGN KEY (`authority_id`) REFERENCES `authorities` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_documents_specialist` FOREIGN KEY (`specialist_id`) REFERENCES `specialists` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. سجل تجديدات الوثائق (يحفظ التاريخ السابق والجديد دائمًا)
CREATE TABLE IF NOT EXISTS `document_renewals` (
  `id` VARCHAR(64) NOT NULL,
  `document_id` VARCHAR(64) NOT NULL,
  `previous_expiry_date` DATE NULL,
  `new_expiry_date` DATE NOT NULL,
  `notes` TEXT NULL,
  `actor_name` VARCHAR(180) NOT NULL,
  `renewed_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_renewals_doc_date` (`document_id`, `renewed_at`),
  CONSTRAINT `fk_renewals_document` FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. المهام (قضائية، إدارية، تجديد)
CREATE TABLE IF NOT EXISTS `tasks` (
  `id` VARCHAR(64) NOT NULL,
  `org_id` VARCHAR(64) NOT NULL,
  `type` ENUM('قضائية', 'إدارية', 'تجديد') NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `specialist_id` VARCHAR(64) NULL,
  `department_id` VARCHAR(64) NULL,
  `department_name` VARCHAR(150) NOT NULL,
  `priority` ENUM('عاجلة', 'مرتفعة', 'متوسطة', 'منخفضة') NOT NULL DEFAULT 'متوسطة',
  `status` ENUM('جديدة', 'قيد التنفيذ', 'معلقة', 'مكتملة', 'ملغاة') NOT NULL DEFAULT 'جديدة',
  `due_date` DATE NOT NULL,
  `actual_delivery_date` DATE NULL,
  `letter_number` VARCHAR(120) NULL,
  `authority_name` VARCHAR(255) NULL,
  `received_date` DATE NULL,
  `document_id` VARCHAR(64) NULL,
  `case_id` VARCHAR(64) NULL,
  `session_id` VARCHAR(64) NULL,
  `notes` TEXT NULL,
  `archived_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tasks_specialist_status` (`specialist_id`, `status`),
  KEY `idx_tasks_due_date` (`due_date`),
  KEY `idx_tasks_type` (`type`),
  KEY `idx_tasks_document` (`document_id`),
  KEY `idx_tasks_case` (`case_id`),
  CONSTRAINT `fk_tasks_org` FOREIGN KEY (`org_id`) REFERENCES `organizations` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_tasks_specialist` FOREIGN KEY (`specialist_id`) REFERENCES `specialists` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tasks_dept` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tasks_document` FOREIGN KEY (`document_id`) REFERENCES `documents` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tasks_case` FOREIGN KEY (`case_id`) REFERENCES `cases` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_tasks_session` FOREIGN KEY (`session_id`) REFERENCES `case_sessions` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. الأحداث والتذكيرات (مع ارتباط بالمختص والسجل)
CREATE TABLE IF NOT EXISTS `calendar_items` (
  `id` VARCHAR(64) NOT NULL,
  `org_id` VARCHAR(64) NOT NULL,
  `kind` ENUM('حدث', 'تذكير') NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `scheduled_at` DATETIME NOT NULL,
  `is_all_day` TINYINT(1) NOT NULL DEFAULT 0,
  `specialist_id` VARCHAR(64) NULL,
  `linked_record_type` ENUM('task', 'document', 'case', 'session', 'poa') NULL,
  `linked_record_id` VARCHAR(64) NULL,
  `notes` TEXT NULL,
  `is_done` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_cal_scheduled` (`scheduled_at`),
  KEY `idx_cal_specialist` (`specialist_id`),
  KEY `idx_cal_linked` (`linked_record_type`, `linked_record_id`),
  CONSTRAINT `fk_cal_org` FOREIGN KEY (`org_id`) REFERENCES `organizations` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_cal_specialist` FOREIGN KEY (`specialist_id`) REFERENCES `specialists` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. الملصقات الملونة
CREATE TABLE IF NOT EXISTS `labels` (
  `id` VARCHAR(64) NOT NULL,
  `target_type` ENUM('today', 'task', 'case', 'document') NOT NULL,
  `target_id` VARCHAR(64) NULL,
  `text` VARCHAR(255) NOT NULL,
  `bg_color` VARCHAR(16) NOT NULL,
  `text_color` VARCHAR(16) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_labels_target` (`target_type`, `target_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. مسودات نموذج ضريبة القيمة المضافة 3A
CREATE TABLE IF NOT EXISTS `vat_3a_drafts` (
  `id` VARCHAR(64) NOT NULL,
  `org_id` VARCHAR(64) NOT NULL,
  `entity_name` VARCHAR(255) NOT NULL,
  `tax_registration_number` VARCHAR(64) NULL,
  `period_start` DATE NOT NULL,
  `period_end` DATE NOT NULL,
  `status` ENUM('مسودة', 'قيد المراجعة', 'مؤرشفة') NOT NULL DEFAULT 'مسودة',
  `calc_rules_version` VARCHAR(32) NOT NULL,
  `editor_name` VARCHAR(180) NOT NULL,
  `is_test_sample` TINYINT(1) NOT NULL DEFAULT 0,
  `item_14_period_ref` VARCHAR(180) NULL,
  `item_14_reason` TEXT NULL,
  `negative_base_explanation` TEXT NULL,
  `computed_net_halalas` BIGINT NOT NULL DEFAULT 0,
  `archived_at` DATETIME NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_vat3a_org_period` (`org_id`, `period_start`, `period_end`),
  KEY `idx_vat3a_status` (`status`),
  CONSTRAINT `fk_vat3a_org` FOREIGN KEY (`org_id`) REFERENCES `organizations` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. بنود نموذج ضريبة القيمة المضافة 3A (تخزين المبالغ بالهللات الصحيحة BIGINT)
CREATE TABLE IF NOT EXISTS `vat_3a_lines` (
  `id` VARCHAR(64) NOT NULL,
  `draft_id` VARCHAR(64) NOT NULL,
  `line_number` TINYINT UNSIGNED NOT NULL,
  `amount_raw` VARCHAR(64) NOT NULL DEFAULT '',
  `adjustment_raw` VARCHAR(64) NOT NULL DEFAULT '',
  `amount_halalas` BIGINT NOT NULL DEFAULT 0,
  `adjustment_halalas` BIGINT NOT NULL DEFAULT 0,
  `vat_halalas` BIGINT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_vat3a_draft_line` (`draft_id`, `line_number`),
  CONSTRAINT `fk_vat3a_lines_draft` FOREIGN KEY (`draft_id`) REFERENCES `vat_3a_drafts` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. سجل فتح المشاركة اليدوية
CREATE TABLE IF NOT EXISTS `share_logs` (
  `id` VARCHAR(64) NOT NULL,
  `record_type` VARCHAR(40) NOT NULL,
  `record_id` VARCHAR(64) NOT NULL,
  `record_title` VARCHAR(255) NOT NULL,
  `specialist_id` VARCHAR(64) NULL,
  `specialist_name` VARCHAR(180) NOT NULL,
  `channel` ENUM('whatsapp', 'email') NOT NULL,
  `scheduled_info` VARCHAR(120) NULL,
  `message_text` TEXT NOT NULL,
  `status` ENUM('فُتحت المشاركة') NOT NULL DEFAULT 'فُتحت المشاركة',
  `opened_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_share_record` (`record_type`, `record_id`),
  KEY `idx_share_specialist` (`specialist_id`),
  KEY `idx_share_opened_at` (`opened_at`),
  CONSTRAINT `fk_share_specialist` FOREIGN KEY (`specialist_id`) REFERENCES `specialists` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
