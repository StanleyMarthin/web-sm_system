CREATE TABLE IF NOT EXISTS `unit_catalog_references` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `car_id` VARCHAR(36) NOT NULL,
  `component_name` VARCHAR(100) NOT NULL,
  `panel_name` VARCHAR(150) NOT NULL,
  `diagram_image_url` TEXT NULL,
  `reference_url` TEXT NULL,
  `notes` TEXT NULL,
  `created_by` VARCHAR(50) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_unit_catalog_references_car_component` (`car_id`, `component_name`),
  CONSTRAINT `fk_unit_catalog_references_car`
    FOREIGN KEY (`car_id`) REFERENCES `cars` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `unit_catalog_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `catalog_reference_id` BIGINT UNSIGNED NOT NULL,
  `position_code` VARCHAR(50) NULL,
  `part_number` VARCHAR(100) NULL,
  `part_name` VARCHAR(255) NULL,
  `qty_normal` DECIMAL(12,2) NULL,
  `qty_opname` DECIMAL(12,2) NULL,
  `actual_name` VARCHAR(255) NULL,
  `availability_status` ENUM('UNKNOWN','AVAILABLE','NOT_AVAILABLE') NOT NULL DEFAULT 'UNKNOWN',
  `condition_status` ENUM('UNKNOWN','GOOD','RESTORE','NOT_USABLE') NOT NULL DEFAULT 'UNKNOWN',
  `action_type` ENUM('UNDECIDED','NO_ACTION','JOBDESC','JOBDESC_ORDER') NOT NULL DEFAULT 'UNDECIDED',
  `survey_status` ENUM('NOT_STARTED','DRAFT','CONFIRMED') NOT NULL DEFAULT 'NOT_STARTED',
  `location` VARCHAR(255) NULL,
  `notes` TEXT NULL,
  `promoted_panel_id` INT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `surveyed_by` VARCHAR(50) NULL,
  `surveyed_at` DATETIME NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_unit_catalog_items_reference_sort` (`catalog_reference_id`, `sort_order`, `id`),
  KEY `idx_unit_catalog_items_promoted_panel` (`promoted_panel_id`),
  CONSTRAINT `fk_unit_catalog_items_reference`
    FOREIGN KEY (`catalog_reference_id`) REFERENCES `unit_catalog_references` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_unit_catalog_items_promoted_panel`
    FOREIGN KEY (`promoted_panel_id`) REFERENCES `master_panels` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `unit_catalog_reference_media` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `catalog_reference_id` BIGINT UNSIGNED NOT NULL,
  `file_url` TEXT NOT NULL,
  `caption` VARCHAR(255) NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_by` VARCHAR(50) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_unit_catalog_reference_media_reference` (`catalog_reference_id`, `sort_order`, `id`),
  CONSTRAINT `fk_unit_catalog_reference_media_reference`
    FOREIGN KEY (`catalog_reference_id`) REFERENCES `unit_catalog_references` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `unit_catalog_item_media` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `catalog_item_id` BIGINT UNSIGNED NOT NULL,
  `file_url` TEXT NOT NULL,
  `caption` VARCHAR(255) NULL,
  `created_by` VARCHAR(50) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_unit_catalog_item_media_item` (`catalog_item_id`, `created_at`),
  CONSTRAINT `fk_unit_catalog_item_media_item`
    FOREIGN KEY (`catalog_item_id`) REFERENCES `unit_catalog_items` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `unit_catalog_item_mappings` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `catalog_item_id` BIGINT UNSIGNED NOT NULL,
  `catalog_reference_media_id` BIGINT UNSIGNED NOT NULL,
  `x_percent` DECIMAL(7,4) NOT NULL,
  `y_percent` DECIMAL(7,4) NOT NULL,
  `created_by` VARCHAR(50) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_unit_catalog_item_mappings_item` (`catalog_item_id`, `id`),
  KEY `idx_unit_catalog_item_mappings_media` (`catalog_reference_media_id`),
  CONSTRAINT `fk_unit_catalog_item_mappings_item`
    FOREIGN KEY (`catalog_item_id`) REFERENCES `unit_catalog_items` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_unit_catalog_item_mappings_media`
    FOREIGN KEY (`catalog_reference_media_id`) REFERENCES `unit_catalog_reference_media` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `chk_unit_catalog_item_mappings_x` CHECK (`x_percent` >= 0 AND `x_percent` <= 100),
  CONSTRAINT `chk_unit_catalog_item_mappings_y` CHECK (`y_percent` >= 0 AND `y_percent` <= 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `master_panel_media` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `panel_id` INT NOT NULL,
  `file_url` TEXT NOT NULL,
  `media_type` ENUM('REFERENCE','ACTUAL') NOT NULL DEFAULT 'ACTUAL',
  `caption` VARCHAR(255) NULL,
  `source_catalog_media_id` BIGINT UNSIGNED NULL,
  `source_catalog_reference_media_id` BIGINT UNSIGNED NULL,
  `created_by` VARCHAR(50) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_master_panel_media_panel` (`panel_id`, `created_at`),
  KEY `idx_master_panel_media_source_catalog` (`source_catalog_media_id`),
  CONSTRAINT `fk_master_panel_media_panel`
    FOREIGN KEY (`panel_id`) REFERENCES `master_panels` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_master_panel_media_source_catalog`
    FOREIGN KEY (`source_catalog_media_id`) REFERENCES `unit_catalog_item_media` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL,
  CONSTRAINT `fk_master_panel_media_source_reference`
    FOREIGN KEY (`source_catalog_reference_media_id`) REFERENCES `unit_catalog_reference_media` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `unit_catalog_reference_media` (
  `catalog_reference_id`, `file_url`, `caption`, `sort_order`, `created_by`, `created_at`
)
SELECT r.id, r.diagram_image_url, r.reference_url, 0, r.created_by, r.created_at
FROM `unit_catalog_references` r
WHERE r.diagram_image_url IS NOT NULL
  AND r.diagram_image_url <> ''
  AND NOT EXISTS (
    SELECT 1 FROM `unit_catalog_reference_media` m
    WHERE m.catalog_reference_id = r.id AND m.file_url = r.diagram_image_url
  );

SET @has_component_name := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'master_panels'
    AND column_name = 'component_name'
);
SET @add_component_name_sql := IF(
  @has_component_name = 0,
  'ALTER TABLE `master_panels` ADD COLUMN `component_name` VARCHAR(100) NULL AFTER `car_id`',
  'SELECT 1'
);
PREPARE add_component_name_stmt FROM @add_component_name_sql;
EXECUTE add_component_name_stmt;
DEALLOCATE PREPARE add_component_name_stmt;

SET @has_qty_normal := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'master_panels'
    AND column_name = 'qty_normal'
);
SET @add_qty_normal_sql := IF(
  @has_qty_normal = 0,
  'ALTER TABLE `master_panels` ADD COLUMN `qty_normal` DECIMAL(12,2) NULL AFTER `sort_order`',
  'SELECT 1'
);
PREPARE add_qty_normal_stmt FROM @add_qty_normal_sql;
EXECUTE add_qty_normal_stmt;
DEALLOCATE PREPARE add_qty_normal_stmt;

SET @has_part_number := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'master_panels'
    AND column_name = 'part_number'
);
SET @add_part_number_sql := IF(
  @has_part_number = 0,
  'ALTER TABLE `master_panels` ADD COLUMN `part_number` VARCHAR(100) NULL AFTER `parent_id`',
  'SELECT 1'
);
PREPARE add_part_number_stmt FROM @add_part_number_sql;
EXECUTE add_part_number_stmt;
DEALLOCATE PREPARE add_part_number_stmt;

SET @has_position_code := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'master_panels'
    AND column_name = 'position_code'
);
SET @add_position_code_sql := IF(
  @has_position_code = 0,
  'ALTER TABLE `master_panels` ADD COLUMN `position_code` VARCHAR(50) NULL AFTER `part_number`',
  'SELECT 1'
);
PREPARE add_position_code_stmt FROM @add_position_code_sql;
EXECUTE add_position_code_stmt;
DEALLOCATE PREPARE add_position_code_stmt;

SET @has_initial_condition := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'master_panels'
    AND column_name = 'initial_condition'
);
SET @add_initial_condition_sql := IF(
  @has_initial_condition = 0,
  'ALTER TABLE `master_panels` ADD COLUMN `initial_condition` VARCHAR(50) NULL AFTER `qty_normal`',
  'SELECT 1'
);
PREPARE add_initial_condition_stmt FROM @add_initial_condition_sql;
EXECUTE add_initial_condition_stmt;
DEALLOCATE PREPARE add_initial_condition_stmt;

SET @has_notes := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'master_panels'
    AND column_name = 'notes'
);
SET @add_notes_sql := IF(
  @has_notes = 0,
  'ALTER TABLE `master_panels` ADD COLUMN `notes` TEXT NULL AFTER `initial_condition`',
  'SELECT 1'
);
PREPARE add_notes_stmt FROM @add_notes_sql;
EXECUTE add_notes_stmt;
DEALLOCATE PREPARE add_notes_stmt;

UPDATE `master_panels`
SET `component_name` = COALESCE(NULLIF(`component_name`, ''), `section`)
WHERE `component_name` IS NULL OR `component_name` = '';

UPDATE `master_panels`
SET `qty_normal` = COALESCE(`qty_normal`, `qty`)
WHERE `qty_normal` IS NULL;

UPDATE `master_panels`
SET `initial_condition` = COALESCE(NULLIF(`initial_condition`, ''), `default_condition_type`)
WHERE `initial_condition` IS NULL OR `initial_condition` = '';

SET @has_pr_panel_id := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = 'sms_purchase'
    AND table_name = 'pur_pr_header'
    AND column_name = 'panel_id'
);
SET @add_pr_panel_id_sql := IF(
  @has_pr_panel_id = 0,
  'ALTER TABLE `sms_purchase`.`pur_pr_header` ADD COLUMN `panel_id` INT NULL AFTER `car_id`, ADD INDEX `idx_pur_pr_header_panel_id` (`panel_id`)',
  'SELECT 1'
);
PREPARE add_pr_panel_id_stmt FROM @add_pr_panel_id_sql;
EXECUTE add_pr_panel_id_stmt;
DEALLOCATE PREPARE add_pr_panel_id_stmt;

SET @has_countdown_pic_plan := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'sm_jobdesc_countdown'
    AND column_name = 'pic_plan'
);
SET @add_countdown_pic_plan_sql := IF(
  @has_countdown_pic_plan = 0,
  'ALTER TABLE `sm_jobdesc_countdown` ADD COLUMN `pic_plan` VARCHAR(50) NULL AFTER `division_id`',
  'SELECT 1'
);
PREPARE add_countdown_pic_plan_stmt FROM @add_countdown_pic_plan_sql;
EXECUTE add_countdown_pic_plan_stmt;
DEALLOCATE PREPARE add_countdown_pic_plan_stmt;

SET @has_countdown_required_grade := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'sm_jobdesc_countdown'
    AND column_name = 'required_grade'
);
SET @add_countdown_required_grade_sql := IF(
  @has_countdown_required_grade = 0,
  'ALTER TABLE `sm_jobdesc_countdown` ADD COLUMN `required_grade` VARCHAR(50) NULL AFTER `pic_plan`',
  'SELECT 1'
);
PREPARE add_countdown_required_grade_stmt FROM @add_countdown_required_grade_sql;
EXECUTE add_countdown_required_grade_stmt;
DEALLOCATE PREPARE add_countdown_required_grade_stmt;

SET @has_countdown_standard_hours := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'sm_jobdesc_countdown'
    AND column_name = 'standard_hours'
);
SET @add_countdown_standard_hours_sql := IF(
  @has_countdown_standard_hours = 0,
  'ALTER TABLE `sm_jobdesc_countdown` ADD COLUMN `standard_hours` DECIMAL(12,2) NULL AFTER `required_grade`',
  'SELECT 1'
);
PREPARE add_countdown_standard_hours_stmt FROM @add_countdown_standard_hours_sql;
EXECUTE add_countdown_standard_hours_stmt;
DEALLOCATE PREPARE add_countdown_standard_hours_stmt;

SET @has_countdown_target_hours := (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'sm_jobdesc_countdown'
    AND column_name = 'target_hours'
);
SET @add_countdown_target_hours_sql := IF(
  @has_countdown_target_hours = 0,
  'ALTER TABLE `sm_jobdesc_countdown` ADD COLUMN `target_hours` DECIMAL(12,2) NULL AFTER `standard_hours`',
  'SELECT 1'
);
PREPARE add_countdown_target_hours_stmt FROM @add_countdown_target_hours_sql;
EXECUTE add_countdown_target_hours_stmt;
DEALLOCATE PREPARE add_countdown_target_hours_stmt;

UPDATE `sm_jobdesc_countdown`
SET `target_hours` = COALESCE(`target_hours`, `target_hours_revised`, `target_hours_initial`)
WHERE `target_hours` IS NULL;

CREATE TABLE IF NOT EXISTS `sm_jobdesc_countdown_revisions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `countdown_id` VARCHAR(36) NOT NULL,
  `revision_type` ENUM('EXTENSION','REDUCTION','CORRECTION') NOT NULL,
  `reason_code` VARCHAR(100) NOT NULL,
  `old_target_hours` DECIMAL(12,2) NULL,
  `new_target_hours` DECIMAL(12,2) NULL,
  `delta_hours` DECIMAL(12,2) NULL,
  `old_deadline_date` DATE NULL,
  `new_deadline_date` DATE NULL,
  `old_pic_plan` VARCHAR(50) NULL,
  `new_pic_plan` VARCHAR(50) NULL,
  `old_required_grade` VARCHAR(50) NULL,
  `new_required_grade` VARCHAR(50) NULL,
  `reference_type` VARCHAR(50) NULL,
  `reference_id` VARCHAR(64) NULL,
  `reason_detail` TEXT NULL,
  `changed_by` VARCHAR(50) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_countdown_revisions_countdown` (`countdown_id`, `created_at`),
  CONSTRAINT `fk_countdown_revisions_countdown`
    FOREIGN KEY (`countdown_id`) REFERENCES `sm_jobdesc_countdown` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
