INSERT IGNORE INTO `sys_role_permissions` (`role_id`, `permission_id`)
SELECT r.id, p.id
FROM `sm_role` r
JOIN `sys_permissions` p
  ON (
    r.role_name = 'ketua_divisi'
    AND p.permission_code IN ('WOV_CREATE', 'VENDOR_VIEW')
  )
  OR (
    r.role_name IN ('advisor', 'kepala_produksi')
    AND p.permission_code IN ('VENDOR_VIEW', 'VENDOR_APPROVE')
  )
  OR (
    r.role_name IN ('manager_produksi', 'manager_operational', 'admin')
    AND p.permission_code IN (
      'VENDOR_VIEW',
      'VENDOR_APPROVE',
      'VENDOR_UPDATE_STATUS',
      'VENDOR_RECEIVE',
      'WOV_UPDATE'
    )
  );
