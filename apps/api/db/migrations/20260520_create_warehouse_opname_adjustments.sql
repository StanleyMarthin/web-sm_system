CREATE TABLE IF NOT EXISTS `wh_stock_opname` (
  `id` varchar(64) NOT NULL,
  `opname_no` varchar(64) NOT NULL,
  `stock_card_id` varchar(64) DEFAULT NULL,
  `car_id` varchar(64) DEFAULT NULL,
  `unit_name` varchar(255) DEFAULT NULL,
  `item_name` varchar(255) NOT NULL,
  `part_code` varchar(64) DEFAULT NULL,
  `uom` varchar(20) NOT NULL,
  `storage_location_id` int DEFAULT NULL,
  `expected_qty` decimal(18,2) NOT NULL DEFAULT 0.00,
  `actual_qty` decimal(18,2) NOT NULL DEFAULT 0.00,
  `variance_qty` decimal(18,2) NOT NULL DEFAULT 0.00,
  `finding_status` enum('MATCH','SHORT','OVER','NOT_FOUND') NOT NULL DEFAULT 'MATCH',
  `item_condition` enum('GOOD','DAMAGED','SCRAP') DEFAULT NULL,
  `counted_at` date NOT NULL,
  `counted_by` varchar(64) NOT NULL,
  `counted_by_name` varchar(255) NOT NULL,
  `division_id` int DEFAULT NULL,
  `division_name` varchar(255) DEFAULT NULL,
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_wh_stock_opname_no` (`opname_no`),
  KEY `idx_wh_stock_opname_car_counted` (`car_id`,`counted_at`),
  KEY `idx_wh_stock_opname_division_counted` (`division_id`,`counted_at`),
  KEY `idx_wh_stock_opname_location` (`storage_location_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `wh_stock_adjustments` (
  `id` varchar(64) NOT NULL,
  `adjustment_no` varchar(64) NOT NULL,
  `opname_id` varchar(64) DEFAULT NULL,
  `stock_card_id` varchar(64) DEFAULT NULL,
  `car_id` varchar(64) DEFAULT NULL,
  `unit_name` varchar(255) DEFAULT NULL,
  `item_name` varchar(255) NOT NULL,
  `part_code` varchar(64) DEFAULT NULL,
  `uom` varchar(20) NOT NULL,
  `qty_before` decimal(18,2) NOT NULL DEFAULT 0.00,
  `qty_after` decimal(18,2) NOT NULL DEFAULT 0.00,
  `adjustment_qty` decimal(18,2) NOT NULL DEFAULT 0.00,
  `adjustment_reason` enum('OPNAME_CORRECTION','MANUAL_CORRECTION','TEST_FIT','CROSS_UNIT_BORROW','DAMAGE','LOSS') NOT NULL DEFAULT 'MANUAL_CORRECTION',
  `item_condition` enum('GOOD','DAMAGED','SCRAP') DEFAULT NULL,
  `created_by` varchar(64) NOT NULL,
  `created_by_name` varchar(255) NOT NULL,
  `division_id` int DEFAULT NULL,
  `division_name` varchar(255) DEFAULT NULL,
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_wh_stock_adjustments_no` (`adjustment_no`),
  KEY `idx_wh_stock_adjustments_car_created` (`car_id`,`created_at`),
  KEY `idx_wh_stock_adjustments_division_created` (`division_id`,`created_at`),
  KEY `idx_wh_stock_adjustments_opname` (`opname_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `sys_permissions` (`permission_code`, `description`, `module_name`)
VALUES
  ('WAREHOUSE_STOCK_OPNAME_VIEW', 'Lihat hasil stock opname gudang', 'warehouse'),
  ('WAREHOUSE_STOCK_OPNAME_CREATE', 'Catat hasil stock opname gudang', 'warehouse'),
  ('WAREHOUSE_STOCK_ADJUSTMENT_VIEW', 'Lihat riwayat penyesuaian stok gudang', 'warehouse'),
  ('WAREHOUSE_STOCK_ADJUSTMENT_CREATE', 'Catat penyesuaian stok gudang', 'warehouse')
ON DUPLICATE KEY UPDATE
  `description` = VALUES(`description`),
  `module_name` = VALUES(`module_name`);

INSERT IGNORE INTO `sys_role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `sm_role` r
JOIN `sys_permissions` p
  ON p.permission_code IN (
    'WAREHOUSE_STOCK_OPNAME_VIEW',
    'WAREHOUSE_STOCK_OPNAME_CREATE',
    'WAREHOUSE_STOCK_ADJUSTMENT_VIEW',
    'WAREHOUSE_STOCK_ADJUSTMENT_CREATE'
  )
WHERE LOWER(TRIM(r.role_name)) IN ('mis', 'admin', 'manager_operational', 'kepala_gudang');
