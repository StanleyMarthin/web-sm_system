-- Target DB: sms_db / CORE_DB_NAME

SET @has_idx_cpa_car_ended_kp := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'car_project_assignment'
    AND index_name = 'idx_cpa_car_ended_kp'
);
SET @idx_cpa_car_ended_kp_sql := IF(
  @has_idx_cpa_car_ended_kp = 0,
  'ALTER TABLE `car_project_assignment` ADD INDEX `idx_cpa_car_ended_kp` (`car_id`, `ended_at`, `kp_id`)',
  'SELECT 1'
);
PREPARE idx_cpa_car_ended_kp_stmt FROM @idx_cpa_car_ended_kp_sql;
EXECUTE idx_cpa_car_ended_kp_stmt;
DEALLOCATE PREPARE idx_cpa_car_ended_kp_stmt;

SET @has_idx_cpa_car_ended_advisor := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'car_project_assignment'
    AND index_name = 'idx_cpa_car_ended_advisor'
);
SET @idx_cpa_car_ended_advisor_sql := IF(
  @has_idx_cpa_car_ended_advisor = 0,
  'ALTER TABLE `car_project_assignment` ADD INDEX `idx_cpa_car_ended_advisor` (`car_id`, `ended_at`, `advisor_id`)',
  'SELECT 1'
);
PREPARE idx_cpa_car_ended_advisor_stmt FROM @idx_cpa_car_ended_advisor_sql;
EXECUTE idx_cpa_car_ended_advisor_stmt;
DEALLOCATE PREPARE idx_cpa_car_ended_advisor_stmt;

SET @has_idx_cpa_car_ended_kd := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'car_project_assignment'
    AND index_name = 'idx_cpa_car_ended_kd'
);
SET @idx_cpa_car_ended_kd_sql := IF(
  @has_idx_cpa_car_ended_kd = 0,
  'ALTER TABLE `car_project_assignment` ADD INDEX `idx_cpa_car_ended_kd` (`car_id`, `ended_at`, `kd_id`)',
  'SELECT 1'
);
PREPARE idx_cpa_car_ended_kd_stmt FROM @idx_cpa_car_ended_kd_sql;
EXECUTE idx_cpa_car_ended_kd_stmt;
DEALLOCATE PREPARE idx_cpa_car_ended_kd_stmt;

SET @has_idx_countdown_division_status_deadline := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'sm_jobdesc_countdown'
    AND index_name = 'idx_countdown_division_status_deadline'
);
SET @idx_countdown_division_status_deadline_sql := IF(
  @has_idx_countdown_division_status_deadline = 0,
  'ALTER TABLE `sm_jobdesc_countdown` ADD INDEX `idx_countdown_division_status_deadline` (`division_id`, `status`, `deadline_date`)',
  'SELECT 1'
);
PREPARE idx_countdown_division_status_deadline_stmt FROM @idx_countdown_division_status_deadline_sql;
EXECUTE idx_countdown_division_status_deadline_stmt;
DEALLOCATE PREPARE idx_countdown_division_status_deadline_stmt;

SET @has_idx_countdown_car_division := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'sm_jobdesc_countdown'
    AND index_name = 'idx_countdown_car_division'
);
SET @idx_countdown_car_division_sql := IF(
  @has_idx_countdown_car_division = 0,
  'ALTER TABLE `sm_jobdesc_countdown` ADD INDEX `idx_countdown_car_division` (`car_id`, `division_id`)',
  'SELECT 1'
);
PREPARE idx_countdown_car_division_stmt FROM @idx_countdown_car_division_sql;
EXECUTE idx_countdown_car_division_stmt;
DEALLOCATE PREPARE idx_countdown_car_division_stmt;

SET @has_idx_plan_task_status_assignee := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'sm_jobdesc_plan'
    AND index_name = 'idx_plan_task_status_assignee'
);
SET @idx_plan_task_status_assignee_sql := IF(
  @has_idx_plan_task_status_assignee = 0,
  'ALTER TABLE `sm_jobdesc_plan` ADD INDEX `idx_plan_task_status_assignee` (`task_date`, `status`, `assigned_user_id`)',
  'SELECT 1'
);
PREPARE idx_plan_task_status_assignee_stmt FROM @idx_plan_task_status_assignee_sql;
EXECUTE idx_plan_task_status_assignee_stmt;
DEALLOCATE PREPARE idx_plan_task_status_assignee_stmt;

SET @has_idx_plan_core_task := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'sm_jobdesc_plan'
    AND index_name = 'idx_plan_core_task'
);
SET @idx_plan_core_task_sql := IF(
  @has_idx_plan_core_task = 0,
  'ALTER TABLE `sm_jobdesc_plan` ADD INDEX `idx_plan_core_task` (`core_id`, `task_date`)',
  'SELECT 1'
);
PREPARE idx_plan_core_task_stmt FROM @idx_plan_core_task_sql;
EXECUTE idx_plan_core_task_stmt;
DEALLOCATE PREPARE idx_plan_core_task_stmt;

SET @has_idx_actual_plan_created := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'sm_jobdesc_actual'
    AND index_name = 'idx_actual_plan_created'
);
SET @idx_actual_plan_created_sql := IF(
  @has_idx_actual_plan_created = 0,
  'ALTER TABLE `sm_jobdesc_actual` ADD INDEX `idx_actual_plan_created` (`plandaily_id`, `created_at`)',
  'SELECT 1'
);
PREPARE idx_actual_plan_created_stmt FROM @idx_actual_plan_created_sql;
EXECUTE idx_actual_plan_created_stmt;
DEALLOCATE PREPARE idx_actual_plan_created_stmt;

SET @has_idx_wo_car_status_request := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'sm_jobdesc_wo'
    AND index_name = 'idx_wo_car_status_request'
);
SET @idx_wo_car_status_request_sql := IF(
  @has_idx_wo_car_status_request = 0,
  'ALTER TABLE `sm_jobdesc_wo` ADD INDEX `idx_wo_car_status_request` (`car_id`, `status`, `request_date`)',
  'SELECT 1'
);
PREPARE idx_wo_car_status_request_stmt FROM @idx_wo_car_status_request_sql;
EXECUTE idx_wo_car_status_request_stmt;
DEALLOCATE PREPARE idx_wo_car_status_request_stmt;

SET @has_idx_wo_division_status := (
  SELECT COUNT(*)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'sm_jobdesc_wo'
    AND index_name = 'idx_wo_division_status'
);
SET @idx_wo_division_status_sql := IF(
  @has_idx_wo_division_status = 0,
  'ALTER TABLE `sm_jobdesc_wo` ADD INDEX `idx_wo_division_status` (`from_div_id`, `to_div_id`, `status`)',
  'SELECT 1'
);
PREPARE idx_wo_division_status_stmt FROM @idx_wo_division_status_sql;
EXECUTE idx_wo_division_status_stmt;
DEALLOCATE PREPARE idx_wo_division_status_stmt;
