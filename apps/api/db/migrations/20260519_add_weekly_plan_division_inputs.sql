CREATE TABLE IF NOT EXISTS `sm_weekly_plan_division_inputs` (
  `id`            VARCHAR(36) NOT NULL DEFAULT (uuid()),
  `plan_id`       VARCHAR(36) NOT NULL,
  `division_id`   INT         NOT NULL,
  `member_count`  INT         NOT NULL DEFAULT 0 COMMENT 'Jumlah anggota yang dipakai minggu ini sebelum potongan absensi',
  `created_at`    TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    TIMESTAMP   NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_wpdi_plan_div` (`plan_id`, `division_id`),
  KEY `idx_wpdi_plan` (`plan_id`),
  KEY `idx_wpdi_div` (`division_id`),
  CONSTRAINT `fk_wpdi_plan`
    FOREIGN KEY (`plan_id`) REFERENCES `sm_weekly_plan` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wpdi_div`
    FOREIGN KEY (`division_id`) REFERENCES `sm_divisi` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Input jumlah anggota per divisi untuk engine planning mingguan.';
