INSERT INTO `sys_permissions` (`permission_code`, `description`, `module_name`)
VALUES
  ('GALLERY_VIEW', 'Lihat galeri foto pekerjaan per jobdesc', 'gallery'),
  ('GALLERY_DOWNLOAD', 'Unduh foto pekerjaan dari galeri web', 'gallery'),
  ('GALLERY_PHOTO_MANAGE', 'Tambah, ubah, dan hapus foto pekerjaan dari galeri web', 'gallery')
ON DUPLICATE KEY UPDATE
  `description` = VALUES(`description`),
  `module_name` = VALUES(`module_name`);

INSERT IGNORE INTO `sys_role_permissions` (`role_id`, `permission_id`)
SELECT
  r.id,
  p.id
FROM `sm_role` r
JOIN `sys_permissions` p
  ON p.permission_code IN ('GALLERY_VIEW', 'GALLERY_DOWNLOAD', 'GALLERY_PHOTO_MANAGE')
WHERE r.role_name IN (
  'admin',
  'mis',
  'manager_produksi',
  'manager_operational',
  'advisor',
  'ketua_divisi',
  'kepala_produksi'
);
