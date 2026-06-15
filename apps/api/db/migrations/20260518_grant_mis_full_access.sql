INSERT INTO sys_role_profiles (
  role_id,
  role_level,
  scope_basis,
  web_enabled,
  mobile_enabled,
  approval_rank,
  notes,
  created_at,
  updated_at
)
SELECT
  r.id,
  900,
  'GLOBAL',
  1,
  1,
  9,
  'Role MIS selalu memegang seluruh akses lintas web dan mobile.',
  NOW(),
  NOW()
FROM sm_role r
WHERE LOWER(TRIM(r.role_name)) = 'mis'
ON DUPLICATE KEY UPDATE
  role_level = VALUES(role_level),
  scope_basis = VALUES(scope_basis),
  web_enabled = VALUES(web_enabled),
  mobile_enabled = VALUES(mobile_enabled),
  approval_rank = VALUES(approval_rank),
  notes = VALUES(notes),
  updated_at = NOW();

DELETE srp
FROM sys_role_permissions srp
JOIN sm_role r ON r.id = srp.role_id
WHERE LOWER(TRIM(r.role_name)) = 'mis';

INSERT INTO sys_role_permissions (role_id, permission_id)
SELECT
  r.id,
  sp.id
FROM sm_role r
JOIN sys_permissions sp
WHERE LOWER(TRIM(r.role_name)) = 'mis';
