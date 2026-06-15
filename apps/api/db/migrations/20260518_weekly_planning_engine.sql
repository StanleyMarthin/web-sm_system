-- =============================================================
-- Migration: Weekly Planning Engine
-- Target DB : sms_db
-- Tanggal   : 2026-05-18
-- Phase     : 12A — Weekly Planning Engine
--
-- Catatan:
--   - cars.is_margin SUDAH ADA (tinyint) → tidak perlu kolom baru
--   - sm_unit_budgets SUDAH ADA → weekly plan units EXTEND, tidak replace
--   - sm_leave_requests SUDAH ADA → sumber absensi snapshot
--   - sm_attendance_logs SUDAH ADA → sumber overtime aktual
--   - sm_divisi.isteknis SUDAH ADA → filter divisi produktif
-- =============================================================

-- -------------------------------------------------------------
-- 1. sm_weekly_plan
--    Header rencana PM per minggu. Satu record per week_start_date.
--    status DRAFT = PM masih menyusun, PUBLISHED = dikunci & dipakai engine
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sm_weekly_plan` (
  `id`                VARCHAR(36)   NOT NULL DEFAULT (uuid()),
  `week_start_date`   DATE          NOT NULL COMMENT 'Selalu Senin',
  `target_hours`      FLOAT         NOT NULL COMMENT 'Target jam dari direksi minggu ini',
  `target_income`     DECIMAL(14,2) DEFAULT NULL COMMENT 'Derivasi: target_hours × labour_rate, diisi otomatis',
  `labour_rate`       DECIMAL(14,2) DEFAULT NULL COMMENT 'Rate per jam minggu ini (bisa beda tiap minggu)',
  `created_by`        VARCHAR(50)   NOT NULL COMMENT 'ref: sm_employee.employee_id (PM)',
  `notes`             TEXT          DEFAULT NULL,
  `status`            ENUM('DRAFT','PUBLISHED','CLOSED') NOT NULL DEFAULT 'DRAFT',
  `created_at`        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`        TIMESTAMP     NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_wplan_week` (`week_start_date`),
  KEY `idx_wplan_status` (`status`),
  KEY `idx_wplan_created_by` (`created_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Header rencana mingguan PM. Satu record per minggu.';


-- -------------------------------------------------------------
-- 2. sm_weekly_plan_overtime
--    Rencana lembur per divisi per hari.
--    PM input: divisi mana, tanggal berapa, berapa orang, berapa jam.
--    include_head = KD ikut lembur (jam-nya ikut dihitung kapasitas).
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sm_weekly_plan_overtime` (
  `id`              VARCHAR(36) NOT NULL DEFAULT (uuid()),
  `plan_id`         VARCHAR(36) NOT NULL COMMENT 'ref: sm_weekly_plan.id',
  `division_id`     INT         NOT NULL COMMENT 'ref: sm_divisi.id',
  `overtime_date`   DATE        NOT NULL COMMENT 'Tanggal lembur spesifik',
  `day_type`        ENUM('WEEKDAY','SATURDAY','SUNDAY') NOT NULL,
  `overtime_hours`  FLOAT       NOT NULL COMMENT 'Jam lembur per orang hari itu (contoh: 5)',
  `member_count`    INT         NOT NULL COMMENT 'Berapa anggota teknis yang lembur',
  `include_head`    TINYINT(1)  NOT NULL DEFAULT 0 COMMENT 'KD ikut lembur? 1=ya',
  `notes`           TEXT        DEFAULT NULL,
  `created_at`      TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      TIMESTAMP   NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_wpo_div_date` (`plan_id`, `division_id`, `overtime_date`),
  KEY `idx_wpo_plan` (`plan_id`),
  KEY `idx_wpo_div`  (`division_id`),
  CONSTRAINT `fk_wpo_plan`
    FOREIGN KEY (`plan_id`) REFERENCES `sm_weekly_plan` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wpo_div`
    FOREIGN KEY (`division_id`) REFERENCES `sm_divisi` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Rencana lembur per divisi per hari dalam minggu plan.';


-- -------------------------------------------------------------
-- 3. sm_weekly_plan_units
--    Alokasi jam per unit per divisi dalam minggu plan.
--    PM assign berapa jam divisi X akan habiskan untuk unit Y minggu ini.
--    priority_rank = urutan PM: 1 = paling prioritas.
--    Catatan: is_margin dibaca live dari cars.is_margin, tidak disimpan ulang.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sm_weekly_plan_units` (
  `id`               VARCHAR(36) NOT NULL DEFAULT (uuid()),
  `plan_id`          VARCHAR(36) NOT NULL COMMENT 'ref: sm_weekly_plan.id',
  `car_id`           VARCHAR(36) NOT NULL COMMENT 'ref: cars.id',
  `division_id`      INT         NOT NULL COMMENT 'ref: sm_divisi.id',
  `allocated_hours`  FLOAT       NOT NULL DEFAULT 0 COMMENT 'Jam yang dialokasikan minggu ini untuk unit ini',
  `priority_rank`    INT         DEFAULT NULL COMMENT 'Urutan prioritas PM, 1 = tertinggi',
  `notes`            TEXT        DEFAULT NULL,
  `created_at`       TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       TIMESTAMP   NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_wpu_plan_car_div` (`plan_id`, `car_id`, `division_id`),
  KEY `idx_wpu_plan` (`plan_id`),
  KEY `idx_wpu_car`  (`car_id`),
  KEY `idx_wpu_div`  (`division_id`),
  CONSTRAINT `fk_wpu_plan`
    FOREIGN KEY (`plan_id`) REFERENCES `sm_weekly_plan` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wpu_car`
    FOREIGN KEY (`car_id`) REFERENCES `cars` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wpu_div`
    FOREIGN KEY (`division_id`) REFERENCES `sm_divisi` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Alokasi jam per unit per divisi dalam satu minggu plan.';


-- -------------------------------------------------------------
-- 4. sm_weekly_plan_absence_snapshot
--    Snapshot absensi yang mempengaruhi kapasitas minggu plan.
--    Dibaca dari sm_leave_requests (APPROVED) + sm_attendance_logs
--    saat plan di-PUBLISH atau di-refresh manual oleh PM.
--    lost_hours = jam yang hilang hari itu akibat absensi.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sm_weekly_plan_absence_snapshot` (
  `id`            VARCHAR(36)  NOT NULL DEFAULT (uuid()),
  `plan_id`       VARCHAR(36)  NOT NULL COMMENT 'ref: sm_weekly_plan.id',
  `employee_id`   VARCHAR(50)  NOT NULL COMMENT 'ref: sm_employee.employee_id',
  `division_id`   INT          NOT NULL COMMENT 'ref: sm_divisi.id (denormalisasi)',
  `absence_date`  DATE         NOT NULL,
  `absence_type`  ENUM('SAKIT','IZIN','CUTI') NOT NULL,
  `lost_hours`    FLOAT        NOT NULL COMMENT 'Jam reguler yang hilang hari itu',
  `source`        ENUM('LEAVE_REQUEST','ATTENDANCE_LOG','MANUAL') NOT NULL DEFAULT 'LEAVE_REQUEST',
  `ref_id`        VARCHAR(36)  DEFAULT NULL COMMENT 'ID source (leave_request.id atau attendance_log.id)',
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_wpas_emp_date` (`plan_id`, `employee_id`, `absence_date`),
  KEY `idx_wpas_plan` (`plan_id`),
  KEY `idx_wpas_div`  (`division_id`),
  CONSTRAINT `fk_wpas_plan`
    FOREIGN KEY (`plan_id`) REFERENCES `sm_weekly_plan` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Snapshot absensi yang mengurangi kapasitas dalam minggu plan.';


-- -------------------------------------------------------------
-- 5. sm_weekly_plan_capacity_cache
--    Cache hasil kalkulasi kapasitas per divisi per minggu.
--    Di-recompute setiap plan diupdate atau ada absensi baru.
--    Ini yang ditampilkan di UI tanpa hitung ulang tiap request.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sm_weekly_plan_capacity_cache` (
  `id`                        VARCHAR(36)   NOT NULL DEFAULT (uuid()),
  `plan_id`                   VARCHAR(36)   NOT NULL COMMENT 'ref: sm_weekly_plan.id',
  `division_id`               INT           NOT NULL COMMENT 'ref: sm_divisi.id',
  `member_count_active`       INT           NOT NULL DEFAULT 0 COMMENT 'Anggota teknis aktif minggu ini',
  `normal_capacity_hours`     FLOAT         NOT NULL DEFAULT 0 COMMENT 'Kapasitas reguler total (tanpa lembur)',
  `overtime_capacity_hours`   FLOAT         NOT NULL DEFAULT 0 COMMENT 'Tambahan dari lembur terencana',
  `absence_lost_hours`        FLOAT         NOT NULL DEFAULT 0 COMMENT 'Jam hilang dari absensi',
  `net_capacity_hours`        FLOAT         NOT NULL DEFAULT 0 COMMENT 'normal + overtime - absence',
  `allocated_hours`           FLOAT         NOT NULL DEFAULT 0 COMMENT 'Total jam dialokasikan ke unit minggu ini',
  `computed_at`               TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_wpcc_plan_div` (`plan_id`, `division_id`),
  KEY `idx_wpcc_plan` (`plan_id`),
  CONSTRAINT `fk_wpcc_plan`
    FOREIGN KEY (`plan_id`) REFERENCES `sm_weekly_plan` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wpcc_div`
    FOREIGN KEY (`division_id`) REFERENCES `sm_divisi` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Cache kapasitas bersih per divisi per minggu. Di-recompute saat plan berubah.';