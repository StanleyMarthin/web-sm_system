-- Target DB: sms_warehouse / WAREHOUSE_DB_NAME

SET @has_idx_wh_transactions_scope_request := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'wh_transactions'
    AND index_name = 'idx_wh_transactions_scope_request'
);
SET @idx_wh_transactions_scope_request_sql := IF(
  @has_idx_wh_transactions_scope_request = 0,
  'ALTER TABLE `wh_transactions` ADD INDEX `idx_wh_transactions_scope_request` (`division_id`, `car_id`, `request_date`)',
  'SELECT 1'
);
PREPARE idx_wh_transactions_scope_request_stmt FROM @idx_wh_transactions_scope_request_sql;
EXECUTE idx_wh_transactions_scope_request_stmt;
DEALLOCATE PREPARE idx_wh_transactions_scope_request_stmt;

SET @has_idx_wh_transactions_employee_request := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'wh_transactions'
    AND index_name = 'idx_wh_transactions_employee_request'
);
SET @idx_wh_transactions_employee_request_sql := IF(
  @has_idx_wh_transactions_employee_request = 0,
  'ALTER TABLE `wh_transactions` ADD INDEX `idx_wh_transactions_employee_request` (`employee_id`, `request_date`)',
  'SELECT 1'
);
PREPARE idx_wh_transactions_employee_request_stmt FROM @idx_wh_transactions_employee_request_sql;
EXECUTE idx_wh_transactions_employee_request_stmt;
DEALLOCATE PREPARE idx_wh_transactions_employee_request_stmt;

SET @has_idx_wh_transactions_status_deadline := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'wh_transactions'
    AND index_name = 'idx_wh_transactions_status_deadline'
);
SET @idx_wh_transactions_status_deadline_sql := IF(
  @has_idx_wh_transactions_status_deadline = 0,
  'ALTER TABLE `wh_transactions` ADD INDEX `idx_wh_transactions_status_deadline` (`approval_status`, `item_status`, `deadline_date`)',
  'SELECT 1'
);
PREPARE idx_wh_transactions_status_deadline_stmt FROM @idx_wh_transactions_status_deadline_sql;
EXECUTE idx_wh_transactions_status_deadline_stmt;
DEALLOCATE PREPARE idx_wh_transactions_status_deadline_stmt;

SET @has_idx_wh_stock_card_car_status_datein := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'wh_stock_card'
    AND index_name = 'idx_wh_stock_card_car_status_datein'
);
SET @idx_wh_stock_card_car_status_datein_sql := IF(
  @has_idx_wh_stock_card_car_status_datein = 0,
  'ALTER TABLE `wh_stock_card` ADD INDEX `idx_wh_stock_card_car_status_datein` (`car_id`, `status`, `date_in`)',
  'SELECT 1'
);
PREPARE idx_wh_stock_card_car_status_datein_stmt FROM @idx_wh_stock_card_car_status_datein_sql;
EXECUTE idx_wh_stock_card_car_status_datein_stmt;
DEALLOCATE PREPARE idx_wh_stock_card_car_status_datein_stmt;

SET @has_idx_wh_stock_card_location_status := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'wh_stock_card'
    AND index_name = 'idx_wh_stock_card_location_status'
);
SET @idx_wh_stock_card_location_status_sql := IF(
  @has_idx_wh_stock_card_location_status = 0,
  'ALTER TABLE `wh_stock_card` ADD INDEX `idx_wh_stock_card_location_status` (`storage_location_id`, `status`)',
  'SELECT 1'
);
PREPARE idx_wh_stock_card_location_status_stmt FROM @idx_wh_stock_card_location_status_sql;
EXECUTE idx_wh_stock_card_location_status_stmt;
DEALLOCATE PREPARE idx_wh_stock_card_location_status_stmt;

SET @has_idx_wh_material_usage_division_car_date := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'wh_material_usage'
    AND index_name = 'idx_wh_material_usage_division_car_date'
);
SET @idx_wh_material_usage_division_car_date_sql := IF(
  @has_idx_wh_material_usage_division_car_date = 0,
  'ALTER TABLE `wh_material_usage` ADD INDEX `idx_wh_material_usage_division_car_date` (`division_id`, `car_id`, `usage_date`)',
  'SELECT 1'
);
PREPARE idx_wh_material_usage_division_car_date_stmt FROM @idx_wh_material_usage_division_car_date_sql;
EXECUTE idx_wh_material_usage_division_car_date_stmt;
DEALLOCATE PREPARE idx_wh_material_usage_division_car_date_stmt;

SET @has_idx_wh_locations_active_label := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'wh_storage_locations'
    AND index_name = 'idx_wh_locations_active_label'
);
SET @idx_wh_locations_active_label_sql := IF(
  @has_idx_wh_locations_active_label = 0,
  'ALTER TABLE `wh_storage_locations` ADD INDEX `idx_wh_locations_active_label` (`is_active`, `label`)',
  'SELECT 1'
);
PREPARE idx_wh_locations_active_label_stmt FROM @idx_wh_locations_active_label_sql;
EXECUTE idx_wh_locations_active_label_stmt;
DEALLOCATE PREPARE idx_wh_locations_active_label_stmt;

SET @has_idx_wh_item_master_code_updated := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'wh_item_master'
    AND index_name = 'idx_wh_item_master_code_updated'
);
SET @idx_wh_item_master_code_updated_sql := IF(
  @has_idx_wh_item_master_code_updated = 0,
  'ALTER TABLE `wh_item_master` ADD INDEX `idx_wh_item_master_code_updated` (`item_code`, `updated_at`)',
  'SELECT 1'
);
PREPARE idx_wh_item_master_code_updated_stmt FROM @idx_wh_item_master_code_updated_sql;
EXECUTE idx_wh_item_master_code_updated_stmt;
DEALLOCATE PREPARE idx_wh_item_master_code_updated_stmt;

SET @has_idx_wh_item_master_name_updated := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'wh_item_master'
    AND index_name = 'idx_wh_item_master_name_updated'
);
SET @idx_wh_item_master_name_updated_sql := IF(
  @has_idx_wh_item_master_name_updated = 0,
  'ALTER TABLE `wh_item_master` ADD INDEX `idx_wh_item_master_name_updated` (`item_name`, `updated_at`)',
  'SELECT 1'
);
PREPARE idx_wh_item_master_name_updated_stmt FROM @idx_wh_item_master_name_updated_sql;
EXECUTE idx_wh_item_master_name_updated_stmt;
DEALLOCATE PREPARE idx_wh_item_master_name_updated_stmt;
