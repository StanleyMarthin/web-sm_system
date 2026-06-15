ALTER TABLE `sms_db`.`sm_qc_inspections`
  MODIFY COLUMN `issue_type` varchar(50) NULL COMMENT 'Teknis | Non Teknis',
  MODIFY COLUMN `issue_area` varchar(100) NULL COMMENT 'Langkah Kerja, Struktur, dll',
  MODIFY COLUMN `issue_cause` text NULL COMMENT 'Penyebab Masalah (Keterangan Detail)',
  MODIFY COLUMN `priority_level` enum('LOW','MEDIUM','HIGH') NULL COMMENT 'Prioritas Rework',
  MODIFY COLUMN `recommendation` text NULL COMMENT 'Rekomendasi Perbaikan dari QA',
  MODIFY COLUMN `followup_status` enum('OPEN','CLOSED') NULL DEFAULT 'CLOSED' COMMENT 'Status penyelesaian masalah';
