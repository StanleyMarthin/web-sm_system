CREATE TABLE IF NOT EXISTS sm_qc_final_approvals (
  id varchar(36) NOT NULL DEFAULT (uuid()),
  car_id varchar(36) NOT NULL,
  approved_by varchar(50) DEFAULT NULL,
  approved_by_name varchar(100) DEFAULT NULL,
  notes text DEFAULT NULL,
  approved_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sm_qc_final_approvals_car (car_id),
  KEY idx_sm_qc_final_approvals_actor (approved_by)
);
