INSERT INTO `sys_permissions` (`permission_code`, `description`, `module_name`)
VALUES
  ('UNIT_CATALOG_VIEW', 'Lihat Catalog & Pendataan Unit', 'unit_catalog'),
  ('UNIT_CATALOG_SURVEY', 'Isi dan konfirmasi pendataan Unit Catalog', 'unit_catalog'),
  ('UNIT_CATALOG_MANAGE', 'Kelola referensi dan import Unit Catalog', 'unit_catalog'),
  ('UNIT_CATALOG_CREATE_JOBDESC', 'Buat Countdown dari Master Panel hasil pendataan', 'unit_catalog')
ON DUPLICATE KEY UPDATE
  `description` = VALUES(`description`),
  `module_name` = VALUES(`module_name`);

INSERT IGNORE INTO `sys_role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `sm_role` r
JOIN `sys_permissions` p
  ON p.permission_code IN ('UNIT_CATALOG_VIEW', 'UNIT_CATALOG_SURVEY')
WHERE LOWER(TRIM(r.role_name)) IN (
  'team_lapangan',
  'anggota',
  'ketua_divisi',
  'qa',
  'admin',
  'mis',
  'manager_operational',
  'manager_produksi'
);

INSERT IGNORE INTO `sys_role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `sm_role` r
JOIN `sys_permissions` p
  ON p.permission_code = 'UNIT_CATALOG_CREATE_JOBDESC'
WHERE LOWER(TRIM(r.role_name)) IN (
  'ketua_divisi',
  'qa',
  'kepala_produksi',
  'admin',
  'mis',
  'manager_operational',
  'manager_produksi'
);

INSERT IGNORE INTO `sys_role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `sm_role` r
JOIN `sys_permissions` p
  ON p.permission_code = 'UNIT_CATALOG_MANAGE'
WHERE LOWER(TRIM(r.role_name)) IN (
  'kepala_produksi',
  'admin',
  'mis',
  'manager_operational',
  'manager_produksi'
);
