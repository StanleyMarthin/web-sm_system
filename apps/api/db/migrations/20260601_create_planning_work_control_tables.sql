-- description: Tabel baru untuk fitur Work Control Planning

CREATE TABLE IF NOT EXISTS `planning_targets` (
  `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
  `period_start` DATE NOT NULL,
  `period_end` DATE NOT NULL,
  `unit_id` VARCHAR(36) DEFAULT NULL,
  `target_output` TEXT DEFAULT NULL,
  `target_hours` FLOAT NOT NULL DEFAULT 0,
  `target_finish_date` DATE DEFAULT NULL,
  `priority` ENUM('NORMAL','IMPORTANT','URGENT') NOT NULL DEFAULT 'NORMAL',
  `risk_level` ENUM('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL DEFAULT 'LOW',
  `status` ENUM('DRAFT','REVIEW','RELEASED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `created_by` VARCHAR(50) DEFAULT NULL,
  `released_by` VARCHAR(50) DEFAULT NULL,
  `released_at` TIMESTAMP NULL DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_planning_targets_period` (`period_start`, `period_end`),
  KEY `idx_planning_targets_unit` (`unit_id`),
  KEY `idx_planning_targets_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Header draft target Work Control Planning.';

CREATE TABLE IF NOT EXISTS `planning_target_divisions` (
  `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
  `planning_target_id` VARCHAR(36) NOT NULL,
  `car_id` VARCHAR(36) NOT NULL,
  `division_id` INT NOT NULL,
  `target_output` TEXT NOT NULL,
  `target_hours` FLOAT NOT NULL DEFAULT 0,
  `target_finish_date` DATE NOT NULL,
  `priority` ENUM('NORMAL','IMPORTANT','URGENT') NOT NULL DEFAULT 'NORMAL',
  `risk_level` ENUM('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL DEFAULT 'LOW',
  `available_capacity_hours` FLOAT NOT NULL DEFAULT 0,
  `shortage_hours` FLOAT NOT NULL DEFAULT 0,
  `recommendation` ENUM('SPK','SPK_WITH_SPL','HOLD','REVISE_TARGET') NOT NULL DEFAULT 'SPK',
  `notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ptd_target` (`planning_target_id`),
  KEY `idx_ptd_car` (`car_id`),
  KEY `idx_ptd_division` (`division_id`),
  CONSTRAINT `fk_ptd_target`
    FOREIGN KEY (`planning_target_id`) REFERENCES `planning_targets` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Target kerja per unit dan divisi untuk Work Control Planning.';

CREATE TABLE IF NOT EXISTS `overtime_recommendations` (
  `id` VARCHAR(36) NOT NULL DEFAULT (UUID()),
  `planning_target_id` VARCHAR(36) NOT NULL,
  `unit_id` VARCHAR(36) DEFAULT NULL,
  `division_id` INT NOT NULL,
  `shortage_hours` FLOAT NOT NULL DEFAULT 0,
  `recommended_overtime_hours` FLOAT NOT NULL DEFAULT 0,
  `reason` TEXT NOT NULL,
  `status` ENUM('RECOMMENDED','APPROVED','REJECTED','CONVERTED_TO_SPL') NOT NULL DEFAULT 'RECOMMENDED',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_or_target` (`planning_target_id`),
  KEY `idx_or_unit` (`unit_id`),
  KEY `idx_or_division` (`division_id`),
  KEY `idx_or_status` (`status`),
  CONSTRAINT `fk_or_target`
    FOREIGN KEY (`planning_target_id`) REFERENCES `planning_targets` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Rekomendasi lembur dari Work Control Planning.';
