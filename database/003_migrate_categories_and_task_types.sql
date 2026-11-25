-- ============================================================================
-- حقيبة المهام — ترقية وتحديث قاعدة MySQL 8+ الحالية دون فقد السجلات
-- الملف: 003_migrate_categories_and_task_types.sql
-- الوظيفة:
--   1) إنشاء جدولي document_categories و task_types وتعبئة القيم الأولية.
--   2) إضافة category_id إلى documents وترحيل الأنواع النصية القديمة doc_type مع حفظ الأسماء.
--   3) استبدال ENUM الجامد لنوع المهمة في tasks بربط ديناميكي عبر type_id مع حفظ document_id.
--   4) إضافة إحداثيات السحب وخيار لفت الانتباه إلى جدول labels.
-- ============================================================================

SET NAMES utf8mb4;

-- 1. إنشاء جدول تصنيفات الوثائق
CREATE TABLE IF NOT EXISTS `document_categories` (
  `id` VARCHAR(64) NOT NULL,
  `org_id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_doc_categories_org_name` (`org_id`, `name`),
  CONSTRAINT `fk_doc_categories_org` FOREIGN KEY (`org_id`) REFERENCES `organizations` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `document_categories` (`id`, `org_id`, `name`)
SELECT 'cat-health', `id`, 'تأمين صحي' FROM `organizations`;
INSERT IGNORE INTO `document_categories` (`id`, `org_id`, `name`)
SELECT 'cat-vehicles', `id`, 'تأمين مركبات' FROM `organizations`;
INSERT IGNORE INTO `document_categories` (`id`, `org_id`, `name`)
SELECT 'cat-municipal', `id`, 'رخص بلدية' FROM `organizations`;
INSERT IGNORE INTO `document_categories` (`id`, `org_id`, `name`)
SELECT 'cat-records', `id`, 'سجلات' FROM `organizations`;
INSERT IGNORE INTO `document_categories` (`id`, `org_id`, `name`)
SELECT 'cat-certs', `id`, 'شهادات' FROM `organizations`;
INSERT IGNORE INTO `document_categories` (`id`, `org_id`, `name`)
SELECT 'cat-iqamas', `id`, 'إقامات' FROM `organizations`;
INSERT IGNORE INTO `document_categories` (`id`, `org_id`, `name`)
SELECT 'cat-contracts', `id`, 'عقود' FROM `organizations`;

-- حفظ أي أسماء أنواع نصية قديمة غير موجودة في القائمة الأولية كتصنيفات مستقلة
INSERT IGNORE INTO `document_categories` (`id`, `org_id`, `name`)
SELECT
  CONCAT('cat-mig-', SUBSTRING(MD5(CONCAT(d.`org_id`, ':', TRIM(d.`doc_type`))), 1, 10)),
  d.`org_id`,
  TRIM(d.`doc_type`)
FROM `documents` d
WHERE TRIM(COALESCE(d.`doc_type`, '')) <> ''
  AND TRIM(d.`doc_type`) <> 'غير مصنفة'
  AND NOT EXISTS (
    SELECT 1 FROM `document_categories` c
    WHERE c.`org_id` = d.`org_id` AND c.`name` = TRIM(d.`doc_type`)
  );

ALTER TABLE `documents`
  ADD COLUMN IF NOT EXISTS `category_id` VARCHAR(64) NULL AFTER `authority_id`;

UPDATE `documents` d
JOIN `document_categories` c
  ON c.`org_id` = d.`org_id` AND c.`name` = TRIM(d.`doc_type`)
SET d.`category_id` = c.`id`
WHERE d.`category_id` IS NULL;

-- إضافة القيد المرجعي بحيث يؤدي حذف التصنيف إلى تحويل الوثائق لـ NULL (غير مصنفة) أو نقلها قبل الحذف
ALTER TABLE `documents`
  ADD KEY `idx_documents_category` (`category_id`),
  ADD CONSTRAINT `fk_documents_category`
    FOREIGN KEY (`category_id`) REFERENCES `document_categories` (`id`) ON DELETE SET NULL;

-- 2. إنشاء جدول أنواع المهام الديناميكي
CREATE TABLE IF NOT EXISTS `task_types` (
  `id` VARCHAR(64) NOT NULL,
  `org_id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `is_admin_kind` TINYINT(1) NOT NULL DEFAULT 0,
  `is_renewal_kind` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_task_types_org_name` (`org_id`, `name`),
  CONSTRAINT `fk_task_types_org` FOREIGN KEY (`org_id`) REFERENCES `organizations` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `task_types` (`id`, `org_id`, `name`, `is_admin_kind`, `is_renewal_kind`)
SELECT 'ttype-judicial', `id`, 'قضائية', 0, 0 FROM `organizations`;
INSERT IGNORE INTO `task_types` (`id`, `org_id`, `name`, `is_admin_kind`, `is_renewal_kind`)
SELECT 'ttype-admin', `id`, 'إدارية', 1, 0 FROM `organizations`;
INSERT IGNORE INTO `task_types` (`id`, `org_id`, `name`, `is_admin_kind`, `is_renewal_kind`)
SELECT 'ttype-renewal', `id`, 'تجديد', 0, 1 FROM `organizations`;

ALTER TABLE `tasks`
  MODIFY COLUMN `type` VARCHAR(120) NOT NULL,
  ADD COLUMN IF NOT EXISTS `type_id` VARCHAR(64) NULL AFTER `org_id`;

UPDATE `tasks` t
JOIN `task_types` tt
  ON tt.`org_id` = t.`org_id` AND tt.`name` = t.`type`
SET t.`type_id` = tt.`id`
WHERE t.`type_id` IS NULL;

ALTER TABLE `tasks`
  MODIFY COLUMN `type_id` VARCHAR(64) NOT NULL,
  ADD KEY `idx_tasks_type_id` (`type_id`),
  ADD CONSTRAINT `fk_tasks_type`
    FOREIGN KEY (`type_id`) REFERENCES `task_types` (`id`) ON DELETE RESTRICT;

-- 3. تحديث جدول الملصقات لدعم التموضع ولفت الانتباه
ALTER TABLE `labels`
  ADD COLUMN IF NOT EXISTS `pos_x` INT NULL AFTER `text_color`,
  ADD COLUMN IF NOT EXISTS `pos_y` INT NULL AFTER `pos_x`,
  ADD COLUMN IF NOT EXISTS `attention_pulse` TINYINT(1) NOT NULL DEFAULT 0 AFTER `pos_y`;
