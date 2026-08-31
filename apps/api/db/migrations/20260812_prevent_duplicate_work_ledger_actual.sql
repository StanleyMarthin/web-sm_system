-- One actual may produce exactly one immutable work-ledger snapshot.
DROP PROCEDURE IF EXISTS assert_no_duplicate_work_ledger_actual;

DELIMITER //
CREATE PROCEDURE assert_no_duplicate_work_ledger_actual()
BEGIN
  IF EXISTS (
    SELECT 1
    FROM sm_work_ledger
    WHERE actual_id IS NOT NULL
    GROUP BY actual_id
    HAVING COUNT(*) > 1
  ) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Duplicate sm_work_ledger.actual_id found; resolve duplicates before this migration';
  END IF;
END//
DELIMITER ;

CALL assert_no_duplicate_work_ledger_actual();
DROP PROCEDURE assert_no_duplicate_work_ledger_actual;

ALTER TABLE sm_work_ledger
  ADD UNIQUE KEY uq_work_ledger_actual (actual_id);

CREATE INDEX idx_actual_ledger_queue
  ON sm_jobdesc_actual (submitted_to_ledger, finish_time, created_at);
