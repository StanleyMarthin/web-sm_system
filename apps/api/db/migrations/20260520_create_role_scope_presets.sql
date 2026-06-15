CREATE TABLE IF NOT EXISTS `sys_role_scope_presets` (
  `role_id` int NOT NULL,
  `division_mode` enum('NONE','OWN_DIVISION','ASSIGNED_DIVISIONS','GLOBAL') NOT NULL DEFAULT 'OWN_DIVISION',
  `division_ids_json` json DEFAULT NULL,
  `unit_mode` enum('NONE','ASSIGNED_UNITS','GLOBAL') NOT NULL DEFAULT 'NONE',
  `unit_ids_json` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`role_id`),
  CONSTRAINT `fk_role_scope_presets_role` FOREIGN KEY (`role_id`) REFERENCES `sm_role` (`id`) ON DELETE CASCADE
);
