-- Target DB: sms_db / CORE_DB_NAME

SET @has_countdown_temuan_awal := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'sm_jobdesc_countdown'
    AND column_name = 'temuan_awal'
);
SET @add_countdown_temuan_awal_sql := IF(
  @has_countdown_temuan_awal = 0,
  'ALTER TABLE `sm_jobdesc_countdown` ADD COLUMN `temuan_awal` TEXT NULL AFTER `revision_reason`',
  'SELECT 1'
);
PREPARE add_countdown_temuan_awal_stmt FROM @add_countdown_temuan_awal_sql;
EXECUTE add_countdown_temuan_awal_stmt;
DEALLOCATE PREPARE add_countdown_temuan_awal_stmt;

SET @has_countdown_keterangan := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'sm_jobdesc_countdown'
    AND column_name = 'keterangan'
);
SET @add_countdown_keterangan_sql := IF(
  @has_countdown_keterangan = 0,
  'ALTER TABLE `sm_jobdesc_countdown` ADD COLUMN `keterangan` TEXT NULL AFTER `temuan_awal`',
  'SELECT 1'
);
PREPARE add_countdown_keterangan_stmt FROM @add_countdown_keterangan_sql;
EXECUTE add_countdown_keterangan_stmt;
DEALLOCATE PREPARE add_countdown_keterangan_stmt;
