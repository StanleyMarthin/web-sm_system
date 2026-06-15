CREATE TABLE IF NOT EXISTS sms_log.sm_audit_log (
  id          VARCHAR(36) PRIMARY KEY DEFAULT (UUID()),
  actor_id    VARCHAR(50) DEFAULT NULL,
  actor_name  VARCHAR(255) NOT NULL,
  action      VARCHAR(100) NOT NULL,
  module      VARCHAR(50) NOT NULL,
  record_id   VARCHAR(36) DEFAULT NULL,
  old_value   JSON DEFAULT NULL,
  new_value   JSON DEFAULT NULL,
  ip_address  VARCHAR(50) DEFAULT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_actor  (actor_id),
  KEY idx_audit_module (module, created_at DESC),
  KEY idx_audit_record (record_id)
);
