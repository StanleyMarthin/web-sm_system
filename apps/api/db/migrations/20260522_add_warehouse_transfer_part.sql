ALTER TABLE `wh_transactions`
  MODIFY COLUMN `transaction_type` ENUM(
    'PEMINJAMAN',
    'PENGAMBILAN',
    'TRANSFER_PART',
    'PENGEMBALIAN',
    'PENYIMPANAN'
  ) NOT NULL;

SET @has_source_car_id := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'wh_transactions'
    AND column_name = 'source_car_id'
);

SET @warehouse_transfer_source_car_id_sql := IF(
  @has_source_car_id = 0,
  'ALTER TABLE `wh_transactions` ADD COLUMN `source_car_id` varchar(64) DEFAULT NULL COMMENT ''ref: donor/source cars.id'' AFTER `stock_card_id`',
  'SELECT 1'
);

PREPARE warehouse_transfer_source_car_id_stmt FROM @warehouse_transfer_source_car_id_sql;
EXECUTE warehouse_transfer_source_car_id_stmt;
DEALLOCATE PREPARE warehouse_transfer_source_car_id_stmt;

SET @has_source_car_name := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'wh_transactions'
    AND column_name = 'source_car_name'
);

SET @warehouse_transfer_source_car_name_sql := IF(
  @has_source_car_name = 0,
  'ALTER TABLE `wh_transactions` ADD COLUMN `source_car_name` varchar(255) DEFAULT NULL COMMENT ''Snapshot donor/source unit name'' AFTER `source_car_id`',
  'SELECT 1'
);

PREPARE warehouse_transfer_source_car_name_stmt FROM @warehouse_transfer_source_car_name_sql;
EXECUTE warehouse_transfer_source_car_name_stmt;
DEALLOCATE PREPARE warehouse_transfer_source_car_name_stmt;

SET @has_source_car_index := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'wh_transactions'
    AND index_name = 'idx_wh_transactions_source_car'
);

SET @warehouse_transfer_index_sql := IF(
  @has_source_car_index = 0,
  'ALTER TABLE `wh_transactions` ADD INDEX `idx_wh_transactions_source_car` (`source_car_id`)',
  'SELECT 1'
);

PREPARE warehouse_transfer_index_stmt FROM @warehouse_transfer_index_sql;
EXECUTE warehouse_transfer_index_stmt;
DEALLOCATE PREPARE warehouse_transfer_index_stmt;
