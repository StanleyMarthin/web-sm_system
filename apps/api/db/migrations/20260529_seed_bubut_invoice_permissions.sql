INSERT INTO `sys_permissions` (`permission_code`, `description`, `module_name`)
VALUES
  ('bubut_invoice.view', 'Lihat daftar dan preview invoice WO Bubut', 'bubut_invoice'),
  ('bubut_invoice.release', 'Rilis invoice WO Bubut direksi/customer', 'bubut_invoice'),
  ('bubut_invoice.print', 'Buka dan print invoice WO Bubut', 'bubut_invoice'),
  ('bubut_invoice.cancel', 'Batalkan invoice WO Bubut yang sudah dirilis', 'bubut_invoice')
ON DUPLICATE KEY UPDATE
  `description` = VALUES(`description`),
  `module_name` = VALUES(`module_name`);

INSERT IGNORE INTO `sys_role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `sm_role` r
JOIN `sys_permissions` p
  ON p.permission_code IN (
    'bubut_invoice.view',
    'bubut_invoice.release',
    'bubut_invoice.print',
    'bubut_invoice.cancel'
  )
WHERE LOWER(TRIM(r.role_name)) IN (
  'mis',
  'admin',
  'direksi',
  'manager_operational',
  'manager_produksi',
  'kepala_produksi'
);
