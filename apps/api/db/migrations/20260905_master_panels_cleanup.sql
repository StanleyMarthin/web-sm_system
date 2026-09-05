USE sms_db;
SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS master_panels_backup_20260905 AS
SELECT * FROM master_panels;

CREATE TABLE IF NOT EXISTS sms_client.sm_progress_items_backup_20260905 AS
SELECT * FROM sms_client.sm_progress_items;

CREATE TABLE IF NOT EXISTS sms_purchase.pur_pr_header_backup_20260905 AS
SELECT * FROM sms_purchase.pur_pr_header;

CREATE TABLE IF NOT EXISTS sms_warehouse.wh_stock_card_backup_20260905 AS
SELECT * FROM sms_warehouse.wh_stock_card;

SET @sql := IF(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'sms_client' AND table_name = 'sm_progress_items' AND column_name = 'master_panel_id'),
  'SELECT 1',
  'ALTER TABLE `sms_client`.`sm_progress_items` ADD COLUMN `master_panel_id` INT NULL AFTER `source_id`'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE sms_client.sm_progress_items i
JOIN master_panels mp ON mp.id = COALESCE(i.master_panel_id, i.panel_id)
SET i.master_panel_id = mp.id
WHERE COALESCE(i.master_panel_id, i.panel_id) IS NOT NULL;

SET @sql := IF(
  EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = 'sms_client' AND table_name = 'sm_progress_items' AND index_name = 'idx_sm_progress_items_master_panel_id'),
  'SELECT 1',
  'ALTER TABLE `sms_client`.`sm_progress_items` ADD INDEX `idx_sm_progress_items_master_panel_id` (`master_panel_id`)'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'sms_client' AND table_name = 'sm_progress_items' AND column_name = 'component_id'),
  'ALTER TABLE `sms_client`.`sm_progress_items` DROP COLUMN `component_id`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'sms_purchase' AND table_name = 'pur_pr_header' AND column_name = 'master_panel_id'),
  'SELECT 1',
  'ALTER TABLE `sms_purchase`.`pur_pr_header` ADD COLUMN `master_panel_id` INT NULL AFTER `car_id`'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE sms_purchase.pur_pr_header h
JOIN master_panels mp ON mp.id = COALESCE(h.master_panel_id, h.panel_id)
SET h.master_panel_id = mp.id
WHERE COALESCE(h.master_panel_id, h.panel_id) IS NOT NULL;

SET @sql := IF(
  EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = 'sms_purchase' AND table_name = 'pur_pr_header' AND index_name = 'idx_pur_pr_header_master_panel_id'),
  'SELECT 1',
  'ALTER TABLE `sms_purchase`.`pur_pr_header` ADD INDEX `idx_pur_pr_header_master_panel_id` (`master_panel_id`)'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'sms_purchase' AND table_name = 'pur_pr_header' AND column_name = 'component_id'),
  'ALTER TABLE `sms_purchase`.`pur_pr_header` DROP COLUMN `component_id`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'sms_warehouse' AND table_name = 'wh_stock_card' AND column_name = 'master_panel_id'),
  'SELECT 1',
  'ALTER TABLE `sms_warehouse`.`wh_stock_card` ADD COLUMN `master_panel_id` INT NULL AFTER `car_name`'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE sms_warehouse.wh_stock_card sc
JOIN master_panels mp
  ON mp.id = COALESCE(
    sc.master_panel_id,
    CASE
      WHEN sc.part_code REGEXP '^MP-[0-9]+$' THEN CAST(SUBSTRING(sc.part_code, 4) AS UNSIGNED)
      ELSE NULL
    END
  )
SET sc.master_panel_id = mp.id;

SET @sql := IF(
  EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = 'sms_warehouse' AND table_name = 'wh_stock_card' AND index_name = 'idx_wh_stock_card_master_panel_id'),
  'SELECT 1',
  'ALTER TABLE `sms_warehouse`.`wh_stock_card` ADD INDEX `idx_wh_stock_card_master_panel_id` (`master_panel_id`)'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'sms_warehouse' AND table_name = 'wh_stock_card' AND column_name = 'component_id'),
  'ALTER TABLE `sms_warehouse`.`wh_stock_card` DROP COLUMN `component_id`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'sms_warehouse' AND table_name = 'wh_stock_card' AND column_name = 'panel_id'),
  'ALTER TABLE `sms_warehouse`.`wh_stock_card` DROP COLUMN `panel_id`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @parent_fk := (
  SELECT constraint_name
  FROM information_schema.key_column_usage
  WHERE table_schema = DATABASE()
    AND table_name = 'master_panels'
    AND column_name = 'parent_id'
    AND referenced_table_name = 'master_panels'
  LIMIT 1
);
SET @sql := IF(
  @parent_fk IS NULL,
  'SELECT 1',
  CONCAT('ALTER TABLE `master_panels` DROP FOREIGN KEY `', @parent_fk, '`')
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  EXISTS (SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'master_panels' AND index_name = 'idx_master_panels_parent'),
  'ALTER TABLE `master_panels` DROP INDEX `idx_master_panels_parent`',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @drop_columns := (
  SELECT GROUP_CONCAT(CONCAT('DROP COLUMN `', column_name, '`') ORDER BY FIELD(
    column_name,
    'section',
    'name',
    'category',
    'is_active',
    'parent_id',
    'position_code',
    'sort_order',
    'qty_normal',
    'default_location_type',
    'default_stock_status',
    'default_condition_type',
    'default_division_id',
    'source_type',
    'source_id'
  ) SEPARATOR ', ')
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'master_panels'
    AND column_name IN (
      'section',
      'name',
      'category',
      'is_active',
      'parent_id',
      'position_code',
      'sort_order',
      'qty_normal',
      'default_location_type',
      'default_stock_status',
      'default_condition_type',
      'default_division_id',
      'source_type',
      'source_id'
    )
);
SET @sql := IF(@drop_columns IS NULL, 'SELECT 1', CONCAT('ALTER TABLE `master_panels` ', @drop_columns));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
