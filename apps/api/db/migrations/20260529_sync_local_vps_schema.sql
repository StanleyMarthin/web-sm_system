-- Non-destructive schema sync between local dev DB and VPS tunnel DB.
-- Safe operations only: create missing tables, add missing columns, widen enum/string types.

CREATE DATABASE IF NOT EXISTS `sms_log`;

SET @has_sm_employee_photo_url := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = 'sms_db'
    AND table_name = 'sm_employee'
    AND column_name = 'photo_url'
);
SET @sync_sql := IF(
  @has_sm_employee_photo_url = 0,
  'ALTER TABLE `sms_db`.`sm_employee` ADD COLUMN `photo_url` varchar(255) NULL',
  'SELECT ''skip sm_employee.photo_url'' AS sync_status'
);
PREPARE sync_stmt FROM @sync_sql;
EXECUTE sync_stmt;
DEALLOCATE PREPARE sync_stmt;

CREATE TABLE IF NOT EXISTS `sms_db`.`sm_qc_final_approvals` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `car_id` varchar(36) NOT NULL,
  `approved_by` varchar(50) DEFAULT NULL,
  `approved_by_name` varchar(100) DEFAULT NULL,
  `notes` text,
  `approved_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sm_qc_final_approvals_car` (`car_id`),
  KEY `idx_sm_qc_final_approvals_actor` (`approved_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `sms_db`.`sm_weekly_plan_division_inputs` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `plan_id` varchar(36) NOT NULL,
  `division_id` int NOT NULL,
  `member_count` int NOT NULL DEFAULT '0' COMMENT 'Jumlah anggota yang dipakai minggu ini sebelum potongan absensi',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_wpdi_plan_div` (`plan_id`,`division_id`),
  KEY `idx_wpdi_plan` (`plan_id`),
  KEY `idx_wpdi_div` (`division_id`),
  CONSTRAINT `fk_wpdi_div` FOREIGN KEY (`division_id`) REFERENCES `sms_db`.`sm_divisi` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wpdi_plan` FOREIGN KEY (`plan_id`) REFERENCES `sms_db`.`sm_weekly_plan` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Input jumlah anggota per divisi untuk engine planning mingguan.';

CREATE TABLE IF NOT EXISTS `sms_db`.`sm_attendance_logs` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `employee_id` varchar(50) NOT NULL,
  `work_date` date NOT NULL,
  `clock_in_at` timestamp NULL DEFAULT NULL,
  `clock_in_selfie_url` text,
  `clock_in_lat` decimal(10,7) DEFAULT NULL,
  `clock_in_lng` decimal(10,7) DEFAULT NULL,
  `clock_in_qr_value` varchar(100) DEFAULT NULL,
  `clock_out_at` timestamp NULL DEFAULT NULL,
  `clock_out_selfie_url` text,
  `clock_out_lat` decimal(10,7) DEFAULT NULL,
  `clock_out_lng` decimal(10,7) DEFAULT NULL,
  `total_work_minutes` int DEFAULT NULL,
  `late_minutes` int DEFAULT '0',
  `overtime_minutes` int DEFAULT '0',
  `overtime_status` enum('NONE','LEAKAGE','OVERTIME') DEFAULT 'NONE',
  `status` enum('HADIR','TERLAMBAT','TIDAK_HADIR','CUTI','IZIN','SAKIT') DEFAULT 'HADIR',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_att_per_day` (`employee_id`,`work_date`),
  KEY `idx_att_date` (`work_date`),
  CONSTRAINT `fk_att_employee` FOREIGN KEY (`employee_id`) REFERENCES `sms_db`.`sm_employee` (`employee_id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `sms_db`.`sm_attendance_corrections` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `employee_id` varchar(50) NOT NULL,
  `attendance_log_id` varchar(36) DEFAULT NULL,
  `work_date` date NOT NULL,
  `correction_type` enum('CLOCK_IN','CLOCK_OUT','KEDUANYA') NOT NULL,
  `requested_clock_in` timestamp NULL DEFAULT NULL,
  `requested_clock_out` timestamp NULL DEFAULT NULL,
  `reason` text NOT NULL,
  `evidence_url` text,
  `status` enum('PENDING','APPROVED','REJECTED') DEFAULT 'PENDING',
  `reviewed_by` varchar(50) DEFAULT NULL,
  `reject_reason` varchar(255) DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_corr_employee` (`employee_id`,`work_date`),
  KEY `fk_corr_log` (`attendance_log_id`),
  KEY `fk_corr_reviewer` (`reviewed_by`),
  CONSTRAINT `fk_corr_employee` FOREIGN KEY (`employee_id`) REFERENCES `sms_db`.`sm_employee` (`employee_id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_corr_log` FOREIGN KEY (`attendance_log_id`) REFERENCES `sms_db`.`sm_attendance_logs` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_corr_reviewer` FOREIGN KEY (`reviewed_by`) REFERENCES `sms_db`.`sm_employee` (`employee_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `sms_db`.`sm_leave_requests` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `employee_id` varchar(50) NOT NULL,
  `type` enum('CUTI','IZIN','SAKIT') NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `total_days` int NOT NULL DEFAULT '1',
  `reason` text NOT NULL,
  `evidence_url` text,
  `status` enum('PENDING','APPROVED','REJECTED') DEFAULT 'PENDING',
  `reviewed_by_kd` varchar(50) DEFAULT NULL,
  `reviewed_by_mgr` varchar(50) DEFAULT NULL,
  `reject_reason` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_leave_employee` (`employee_id`,`start_date`),
  KEY `fk_leave_kd` (`reviewed_by_kd`),
  KEY `fk_leave_mgr` (`reviewed_by_mgr`),
  CONSTRAINT `fk_leave_employee` FOREIGN KEY (`employee_id`) REFERENCES `sms_db`.`sm_employee` (`employee_id`) ON DELETE RESTRICT,
  CONSTRAINT `fk_leave_kd` FOREIGN KEY (`reviewed_by_kd`) REFERENCES `sms_db`.`sm_employee` (`employee_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_leave_mgr` FOREIGN KEY (`reviewed_by_mgr`) REFERENCES `sms_db`.`sm_employee` (`employee_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `sms_db`.`sm_audit_log` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `actor_id` varchar(50) DEFAULT NULL,
  `actor_name` varchar(255) NOT NULL,
  `action` varchar(100) NOT NULL,
  `module` varchar(50) NOT NULL,
  `record_id` varchar(36) DEFAULT NULL,
  `old_value` json DEFAULT NULL,
  `new_value` json DEFAULT NULL,
  `ip_address` varchar(50) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_actor` (`actor_id`),
  KEY `idx_audit_module` (`module`,`created_at` DESC),
  KEY `idx_audit_record` (`record_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `sms_log`.`log_audit_trails` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `source_db` enum('sms_db','sms_warehouse','sms_purchase','sm_system') NOT NULL DEFAULT 'sm_system',
  `table_name` varchar(100) NOT NULL,
  `record_id` varchar(36) NOT NULL,
  `action` enum('INSERT','UPDATE','DELETE') NOT NULL,
  `performed_by` varchar(36) DEFAULT NULL,
  `performed_name` varchar(255) DEFAULT NULL,
  `performed_role` varchar(50) DEFAULT NULL,
  `old_data` json DEFAULT NULL,
  `new_data` json DEFAULT NULL,
  `change_reason` text,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(500) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_lat_source` (`source_db`,`table_name`),
  KEY `idx_lat_record` (`table_name`,`record_id`),
  KEY `idx_lat_by` (`performed_by`),
  KEY `idx_lat_time` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci ROW_FORMAT=COMPRESSED;

CREATE TABLE IF NOT EXISTS `sms_log`.`sm_audit_log` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `actor_id` varchar(50) DEFAULT NULL,
  `actor_name` varchar(255) NOT NULL,
  `action` varchar(100) NOT NULL,
  `module` varchar(50) NOT NULL,
  `record_id` varchar(36) DEFAULT NULL,
  `old_value` json DEFAULT NULL,
  `new_value` json DEFAULT NULL,
  `ip_address` varchar(50) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_actor` (`actor_id`),
  KEY `idx_audit_module` (`module`,`created_at` DESC),
  KEY `idx_audit_record` (`record_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `sms_log`.`sm_notification_log` (
  `id` varchar(36) NOT NULL DEFAULT (uuid()),
  `target_type` enum('employee','role','division','all') NOT NULL,
  `target_value` json DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `body` text,
  `data_payload` json DEFAULT NULL,
  `sent_count` int NOT NULL DEFAULT '0',
  `failed_count` int NOT NULL DEFAULT '0',
  `source_service` varchar(50) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_snl_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Simplified log untuk semua FCM broadcast';

SET @has_qc_issue_type := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = 'sms_db'
    AND table_name = 'sm_qc_inspections'
    AND column_name = 'issue_type'
);
SET @sync_sql := IF(
  @has_qc_issue_type = 0,
  'ALTER TABLE `sms_db`.`sm_qc_inspections`
    ADD COLUMN `issue_type` varchar(50) NULL,
    ADD COLUMN `issue_area` varchar(100) NULL,
    ADD COLUMN `issue_cause` text NULL,
    ADD COLUMN `priority_level` enum(''LOW'',''MEDIUM'',''HIGH'') NULL,
    ADD COLUMN `recommendation` text NULL,
    ADD COLUMN `followup_status` enum(''OPEN'',''CLOSED'') NULL DEFAULT ''CLOSED''',
  'SELECT ''skip sm_qc_inspections issue columns'' AS sync_status'
);
PREPARE sync_stmt FROM @sync_sql;
EXECUTE sync_stmt;
DEALLOCATE PREPARE sync_stmt;

ALTER TABLE `sms_purchase`.`pur_pr_header`
  MODIFY COLUMN `priority` varchar(20) DEFAULT 'NORMAL';

SET @has_wh_source_car_id := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = 'sms_warehouse'
    AND table_name = 'wh_transactions'
    AND column_name = 'source_car_id'
);
SET @sync_sql := IF(
  @has_wh_source_car_id = 0,
  'ALTER TABLE `sms_warehouse`.`wh_transactions`
    ADD COLUMN `source_car_id` varchar(64) NULL COMMENT ''ref: donor/source cars.id'' AFTER `stock_card_id`,
    ADD COLUMN `source_car_name` varchar(255) NULL COMMENT ''Snapshot donor/source unit name'' AFTER `source_car_id`,
    ADD INDEX `idx_wh_transactions_source_car` (`source_car_id`)',
  'SELECT ''skip wh_transactions source car columns'' AS sync_status'
);
PREPARE sync_stmt FROM @sync_sql;
EXECUTE sync_stmt;
DEALLOCATE PREPARE sync_stmt;

ALTER TABLE `sms_warehouse`.`wh_transactions`
  MODIFY COLUMN `transaction_type` enum('PEMINJAMAN','PENGAMBILAN','TRANSFER_PART','PENGEMBALIAN','PENYIMPANAN') NOT NULL,
  MODIFY COLUMN `item_status` enum('OPEN','READY','RELEASED','INSTALLED','RETURNED','STORED','LOST') NOT NULL DEFAULT 'OPEN';
