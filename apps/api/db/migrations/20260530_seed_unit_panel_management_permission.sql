INSERT INTO `sys_permissions` (`permission_code`, `description`, `module_name`)
VALUES
  ('unit_panel.manage', 'Kelola master panel dan part per unit', 'unit_panel')
ON DUPLICATE KEY UPDATE
  `description` = VALUES(`description`),
  `module_name` = VALUES(`module_name`);

INSERT IGNORE INTO `sys_role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `sm_role` r
JOIN `sys_permissions` p
  ON p.permission_code = 'unit_panel.manage'
WHERE LOWER(TRIM(r.role_name)) IN (
  'mis',
  'admin',
  'direksi',
  'manager_operational',
  'manager_produksi',
  'kepala_produksi'
);
