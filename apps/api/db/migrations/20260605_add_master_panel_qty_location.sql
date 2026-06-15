SET @has_master_panel_qty := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'master_panels'
    AND column_name = 'qty'
);

SET @add_master_panel_qty_sql := IF(
  @has_master_panel_qty = 0,
  'ALTER TABLE `master_panels` ADD COLUMN `qty` decimal(12,2) NOT NULL DEFAULT 1 COMMENT ''Jumlah default panel/part pada unit'' AFTER `sort_order`',
  'SELECT 1'
);
PREPARE add_master_panel_qty_stmt FROM @add_master_panel_qty_sql;
EXECUTE add_master_panel_qty_stmt;
DEALLOCATE PREPARE add_master_panel_qty_stmt;

SET @has_master_panel_location := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'master_panels'
    AND column_name = 'default_location_type'
);

SET @add_master_panel_location_sql := IF(
  @has_master_panel_location = 0,
  'ALTER TABLE `master_panels` ADD COLUMN `default_location_type` enum(''GUDANG'',''WORKSHOP'',''UNIT'') NOT NULL DEFAULT ''UNIT'' COMMENT ''Default lokasi inventory: sync warehouse wh_storage_locations.location_type'' AFTER `qty`',
  'SELECT 1'
);
PREPARE add_master_panel_location_stmt FROM @add_master_panel_location_sql;
EXECUTE add_master_panel_location_stmt;
DEALLOCATE PREPARE add_master_panel_location_stmt;

SET @has_master_panel_stock_status := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'master_panels'
    AND column_name = 'default_stock_status'
);

SET @add_master_panel_stock_status_sql := IF(
  @has_master_panel_stock_status = 0,
  'ALTER TABLE `master_panels` ADD COLUMN `default_stock_status` enum(''IN_STORAGE'',''RETRIEVED'',''INSTALLED'',''LOST'') NOT NULL DEFAULT ''INSTALLED'' COMMENT ''Default posisi stock card: pendataan awal = UNIT / INSTALLED'' AFTER `default_location_type`',
  'SELECT 1'
);
PREPARE add_master_panel_stock_status_stmt FROM @add_master_panel_stock_status_sql;
EXECUTE add_master_panel_stock_status_stmt;
DEALLOCATE PREPARE add_master_panel_stock_status_stmt;

SET @has_master_panel_condition := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'master_panels'
    AND column_name = 'default_condition_type'
);

SET @add_master_panel_condition_sql := IF(
  @has_master_panel_condition = 0,
  'ALTER TABLE `master_panels` ADD COLUMN `default_condition_type` enum(''BARU'',''RESTORE'',''BEKAS'') NOT NULL DEFAULT ''BEKAS'' COMMENT ''Default kondisi part: sync warehouse wh_stock_card.condition_type'' AFTER `default_stock_status`',
  'SELECT 1'
);
PREPARE add_master_panel_condition_stmt FROM @add_master_panel_condition_sql;
EXECUTE add_master_panel_condition_stmt;
DEALLOCATE PREPARE add_master_panel_condition_stmt;
