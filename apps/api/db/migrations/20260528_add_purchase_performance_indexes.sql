-- Target DB: sms_purchase / PURCHASE_DB_NAME

SET @has_idx_pr_header_car_tracking_status := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'pur_pr_header'
    AND index_name = 'idx_pr_header_car_tracking_status'
);
SET @idx_pr_header_car_tracking_status_sql := IF(
  @has_idx_pr_header_car_tracking_status = 0,
  'ALTER TABLE `pur_pr_header` ADD INDEX `idx_pr_header_car_tracking_status` (`car_id`, `acc_tracking`, `status`, `created_at`)',
  'SELECT 1'
);
PREPARE idx_pr_header_car_tracking_status_stmt FROM @idx_pr_header_car_tracking_status_sql;
EXECUTE idx_pr_header_car_tracking_status_stmt;
DEALLOCATE PREPARE idx_pr_header_car_tracking_status_stmt;

SET @has_idx_pr_header_requester_created := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'pur_pr_header'
    AND index_name = 'idx_pr_header_requester_created'
);
SET @idx_pr_header_requester_created_sql := IF(
  @has_idx_pr_header_requester_created = 0,
  'ALTER TABLE `pur_pr_header` ADD INDEX `idx_pr_header_requester_created` (`requested_by`, `created_at`)',
  'SELECT 1'
);
PREPARE idx_pr_header_requester_created_stmt FROM @idx_pr_header_requester_created_sql;
EXECUTE idx_pr_header_requester_created_stmt;
DEALLOCATE PREPARE idx_pr_header_requester_created_stmt;

SET @has_idx_pr_items_pr_status_vendor := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'pur_pr_items'
    AND index_name = 'idx_pr_items_pr_status_vendor'
);
SET @idx_pr_items_pr_status_vendor_sql := IF(
  @has_idx_pr_items_pr_status_vendor = 0,
  'ALTER TABLE `pur_pr_items` ADD INDEX `idx_pr_items_pr_status_vendor` (`pr_id`, `status`, `vendor_id`, `arrival_date`)',
  'SELECT 1'
);
PREPARE idx_pr_items_pr_status_vendor_stmt FROM @idx_pr_items_pr_status_vendor_sql;
EXECUTE idx_pr_items_pr_status_vendor_stmt;
DEALLOCATE PREPARE idx_pr_items_pr_status_vendor_stmt;

SET @has_idx_wov_car_tracking_status := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'vnd_wo_vendor'
    AND index_name = 'idx_wov_car_tracking_status'
);
SET @idx_wov_car_tracking_status_sql := IF(
  @has_idx_wov_car_tracking_status = 0,
  'ALTER TABLE `vnd_wo_vendor` ADD INDEX `idx_wov_car_tracking_status` (`car_id`, `acc_tracking`, `status`, `date_out`, `target_date_return`)',
  'SELECT 1'
);
PREPARE idx_wov_car_tracking_status_stmt FROM @idx_wov_car_tracking_status_sql;
EXECUTE idx_wov_car_tracking_status_stmt;
DEALLOCATE PREPARE idx_wov_car_tracking_status_stmt;

SET @has_idx_wov_requester_created := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'vnd_wo_vendor'
    AND index_name = 'idx_wov_requester_created'
);
SET @idx_wov_requester_created_sql := IF(
  @has_idx_wov_requester_created = 0,
  'ALTER TABLE `vnd_wo_vendor` ADD INDEX `idx_wov_requester_created` (`requested_by`, `created_at`)',
  'SELECT 1'
);
PREPARE idx_wov_requester_created_stmt FROM @idx_wov_requester_created_sql;
EXECUTE idx_wov_requester_created_stmt;
DEALLOCATE PREPARE idx_wov_requester_created_stmt;

SET @has_idx_vendors_active_name := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'pur_vendors'
    AND index_name = 'idx_vendors_active_name'
);
SET @idx_vendors_active_name_sql := IF(
  @has_idx_vendors_active_name = 0,
  'ALTER TABLE `pur_vendors` ADD INDEX `idx_vendors_active_name` (`is_active`, `vendor_name`)',
  'SELECT 1'
);
PREPARE idx_vendors_active_name_stmt FROM @idx_vendors_active_name_sql;
EXECUTE idx_vendors_active_name_stmt;
DEALLOCATE PREPARE idx_vendors_active_name_stmt;
