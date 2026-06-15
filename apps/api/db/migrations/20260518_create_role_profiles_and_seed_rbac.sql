CREATE TABLE IF NOT EXISTS `sys_role_profiles` (
  `role_id` int NOT NULL,
  `role_level` int NOT NULL DEFAULT 100,
  `scope_basis` enum('GLOBAL','ASSIGNED_DIVISIONS','ASSIGNED_UNITS','OWN_DIVISION','SELF_ONLY') NOT NULL DEFAULT 'OWN_DIVISION',
  `web_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `mobile_enabled` tinyint(1) NOT NULL DEFAULT 1,
  `approval_rank` int DEFAULT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`role_id`),
  CONSTRAINT `fk_sys_role_profiles_role` FOREIGN KEY (`role_id`) REFERENCES `sm_role` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `sys_permissions` (`permission_code`, `description`, `module_name`)
VALUES
  ('PROFILE_VIEW', 'Lihat profil sendiri', 'shared'),
  ('LIST_NOTIFICATIONS', 'Lihat daftar notifikasi', 'shared'),
  ('view_all_units', 'Lihat seluruh unit tanpa pembatasan scope', 'rbac'),
  ('view_assigned_units', 'Lihat unit sesuai assignment aktif', 'rbac'),
  ('VIEW_UNITS', 'Lihat daftar unit', 'monitoring'),
  ('LIST_CAR_PROGRESS', 'Lihat monitoring progres unit', 'monitoring'),
  ('CAR_PROGRESS_DETAIL', 'Lihat detail progres unit', 'monitoring'),
  ('VIEW_COUNTDOWN', 'Lihat countdown unit', 'countdown'),
  ('VIEW_COUNTDOWN_DETAIL', 'Lihat detail countdown unit', 'countdown'),
  ('COUNTDOWN_SUBMIT_APPROVAL', 'Kirim approval revisi countdown', 'countdown'),
  ('COUNTDOWN_MARK_QC_READY', 'Tandai countdown siap QC', 'countdown'),
  ('COUNTDOWN_REQUEST_REVISION', 'Ajukan revisi countdown', 'countdown'),
  ('UPDATE_PLAN', 'Ubah job plan', 'job_plan'),
  ('CREATE_TASK', 'Buat job plan / task', 'job_plan'),
  ('REVIEW_TASK', 'Review job plan / task', 'job_plan'),
  ('TASK_ASSIGN', 'Assign task operasional', 'tasks'),
  ('TASK_VIEW', 'Lihat daftar task', 'tasks'),
  ('TASK_SUBMIT', 'Submit hasil eksekusi task', 'tasks'),
  ('TASK_CHECKPOINT', 'Isi checkpoint task', 'tasks'),
  ('TASK_PENDING', 'Tandai task pending', 'tasks'),
  ('TASK_BREAK', 'Tandai jeda task', 'tasks'),
  ('TASK_EXECUTE', 'Jalankan task eksekusi', 'tasks'),
  ('UPLOAD_TICKET', 'Upload tiket / bukti kerja mobile', 'tasks'),
  ('WO_CREATE', 'Buat work order internal', 'wo'),
  ('WO_APPROVE', 'Approve work order internal', 'wo'),
  ('APPROVE_WO_ADVISOR', 'Approve work order sebagai advisor', 'wo'),
  ('APPROVE_WO_PM', 'Approve work order sebagai penanggung jawab akhir', 'wo'),
  ('WO_EXTENSION_REQUEST', 'Ajukan perpanjangan work order', 'wo'),
  ('WO_EXTENSION_APPROVE', 'Setujui perpanjangan work order', 'wo'),
  ('WO_VIEW', 'Lihat daftar work order internal', 'wo'),
  ('WO_REJECT', 'Tolak work order internal', 'wo'),
  ('QC_VIEW', 'Lihat antrean QC', 'qc'),
  ('QC_SUBMIT', 'Submit hasil QC', 'qc'),
  ('QC_VALIDATE', 'Validasi hasil QC', 'qc'),
  ('PR_VIEW', 'Lihat purchase request', 'pr'),
  ('PR_CREATE', 'Buat purchase request', 'pr'),
  ('PR_APPROVE', 'Approve purchase request', 'pr'),
  ('WOV_CREATE', 'Buat work order vendor dari mobile', 'vendor'),
  ('WOV_UPDATE', 'Perbarui work order vendor dari mobile', 'vendor'),
  ('user.manage', 'Kelola user dan role dari panel admin', 'rbac'),
  ('REPORT_VIEW', 'Lihat laporan dan dashboard ringkasan', 'reports'),
  ('REPORT_EXPORT', 'Export laporan ke file', 'reports'),
  ('PR_ORDER', 'Proses order pembelian', 'pr'),
  ('PR_RECEIVE', 'Terima barang dari purchase request', 'pr'),
  ('VENDOR_VIEW', 'Lihat work order vendor', 'vendor'),
  ('VENDOR_CREATE', 'Buat work order vendor', 'vendor'),
  ('VENDOR_APPROVE', 'Approve work order vendor', 'vendor'),
  ('VENDOR_UPDATE_STATUS', 'Ubah status work order vendor', 'vendor'),
  ('VENDOR_RECEIVE', 'Terima hasil work order vendor', 'vendor'),
  ('WAREHOUSE_VIEW', 'Lihat ringkasan gudang', 'warehouse'),
  ('WAREHOUSE_REQUEST', 'Ajukan kebutuhan gudang dari mobile', 'warehouse'),
  ('WAREHOUSE_APPROVE', 'Approve pengajuan gudang', 'warehouse'),
  ('WAREHOUSE_READY', 'Tandai material siap diproses', 'warehouse'),
  ('WAREHOUSE_ISSUE', 'Keluarkan material dari gudang', 'warehouse'),
  ('WAREHOUSE_RETURN', 'Proses pengembalian material', 'warehouse'),
  ('WAREHOUSE_STOCK_CARD_VIEW', 'Lihat kartu stok gudang', 'warehouse')
ON DUPLICATE KEY UPDATE
  `description` = VALUES(`description`),
  `module_name` = VALUES(`module_name`);

INSERT INTO `sys_role_profiles` (
  `role_id`,
  `role_level`,
  `scope_basis`,
  `web_enabled`,
  `mobile_enabled`,
  `approval_rank`,
  `notes`
)
SELECT
  r.id,
  CASE
    WHEN r.role_name IN ('admin', 'mis', 'manager_produksi', 'manager_operational') THEN 900
    WHEN r.role_name = 'kepala_produksi' THEN 300
    WHEN r.role_name = 'advisor' THEN 220
    WHEN r.role_name = 'ketua_divisi' THEN 180
    WHEN r.role_name IN ('kepala_gudang', 'ppic') THEN 170
    WHEN r.role_name IN ('gudang_tools', 'gudang_sparepart', 'gudang_bahan') THEN 140
    WHEN r.role_name = 'team_lapangan' THEN 80
    ELSE 100
  END AS role_level,
  CASE
    WHEN r.role_name IN ('admin', 'mis', 'manager_produksi', 'manager_operational') THEN 'GLOBAL'
    WHEN r.role_name IN ('advisor', 'ketua_divisi') THEN 'ASSIGNED_DIVISIONS'
    WHEN r.role_name = 'kepala_produksi' THEN 'ASSIGNED_UNITS'
    WHEN r.role_name = 'team_lapangan' THEN 'SELF_ONLY'
    ELSE 'OWN_DIVISION'
  END AS scope_basis,
  1 AS web_enabled,
  CASE
    WHEN r.role_name IN ('finance_admin', 'hr_ga') THEN 0
    ELSE 1
  END AS mobile_enabled,
  CASE
    WHEN r.role_name = 'ketua_divisi' THEN 1
    WHEN r.role_name = 'advisor' THEN 2
    WHEN r.role_name = 'kepala_produksi' THEN 3
    WHEN r.role_name IN ('admin', 'mis', 'manager_produksi', 'manager_operational') THEN 9
    ELSE NULL
  END AS approval_rank,
  CASE
    WHEN r.role_name = 'advisor' THEN 'Pegangan utama berupa divisi. Akses unit mengikuti assignment aktif.'
    WHEN r.role_name = 'kepala_produksi' THEN 'Pegangan utama berupa unit aktif pada assignment operasional.'
    WHEN r.role_name = 'ketua_divisi' THEN 'Pegangan utama berupa divisi kerja dan approval tahap awal.'
    WHEN r.role_name = 'team_lapangan' THEN 'Role eksekusi lapangan, mobile-only features seperti task execution tetap bisa dipisah dari web.'
    ELSE 'Profile awal hasil migrasi RBAC pusat.'
  END AS notes
FROM `sm_role` r
ON DUPLICATE KEY UPDATE
  `role_level` = VALUES(`role_level`),
  `scope_basis` = VALUES(`scope_basis`),
  `web_enabled` = VALUES(`web_enabled`),
  `mobile_enabled` = VALUES(`mobile_enabled`),
  `approval_rank` = VALUES(`approval_rank`),
  `notes` = VALUES(`notes`);
