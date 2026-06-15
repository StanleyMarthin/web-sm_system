INSERT INTO `sys_permissions` (`permission_code`, `description`, `module_name`)
VALUES
  ('WAREHOUSE_STOCK_CARD_MANAGE', 'Kelola foto pada stock card gudang', 'warehouse'),
  ('WAREHOUSE_LOCATION_MANAGE', 'Tambah, ubah, dan nonaktifkan lokasi gudang', 'warehouse')
ON DUPLICATE KEY UPDATE
  `description` = VALUES(`description`),
  `module_name` = VALUES(`module_name`);

INSERT IGNORE INTO `sys_role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `sm_role` r
JOIN `sys_permissions` p
  ON p.permission_code IN (
    'WAREHOUSE_STOCK_CARD_MANAGE',
    'WAREHOUSE_LOCATION_MANAGE'
  )
WHERE LOWER(TRIM(r.role_name)) IN (
  'mis',
  'admin',
  'manager_operational',
  'kepala_gudang',
  'gudang_bahan',
  'gudang_sparepart'
);
