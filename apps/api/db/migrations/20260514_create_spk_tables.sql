CREATE TABLE IF NOT EXISTS sm_spk_header (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  spk_number VARCHAR(50) NOT NULL UNIQUE,
  spk_date DATE NOT NULL,
  status ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'ACTIVE', 'DONE') NOT NULL DEFAULT 'DRAFT',
  total_units INT NOT NULL DEFAULT 0,
  total_hours FLOAT NOT NULL DEFAULT 0,
  created_by_employee_id VARCHAR(50) DEFAULT NULL,
  created_by_name VARCHAR(255) NOT NULL,
  approved_by_employee_id VARCHAR(50) DEFAULT NULL,
  approved_by_name VARCHAR(255) DEFAULT NULL,
  reject_reason TEXT DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  submitted_at TIMESTAMP NULL DEFAULT NULL,
  approved_at TIMESTAMP NULL DEFAULT NULL,
  activated_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_spkh_date (spk_date),
  KEY idx_spkh_status (status)
);

CREATE TABLE IF NOT EXISTS sm_spk_detail (
  id VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  spk_id VARCHAR(36) NOT NULL,
  plan_id VARCHAR(36) DEFAULT NULL,
  unit_name_snapshot VARCHAR(255) NOT NULL,
  division_name_snapshot VARCHAR(100) NOT NULL,
  job_name_snapshot VARCHAR(255) NOT NULL,
  pic_name_snapshot VARCHAR(255) NOT NULL,
  target_hours_snapshot FLOAT NOT NULL,
  target_date_snapshot DATE NOT NULL,
  approval_state ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  approval_note TEXT DEFAULT NULL,
  approved_by_employee_id VARCHAR(50) DEFAULT NULL,
  approved_by_name VARCHAR(255) DEFAULT NULL,
  approved_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_spkd_spk (spk_id),
  KEY idx_spkd_plan (plan_id),
  KEY idx_spkd_date (target_date_snapshot),
  CONSTRAINT fk_sm_spk_detail_header
    FOREIGN KEY (spk_id) REFERENCES sm_spk_header(id)
    ON DELETE CASCADE
);
