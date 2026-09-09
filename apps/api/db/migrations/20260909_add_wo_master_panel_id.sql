ALTER TABLE sm_jobdesc_wo
  ADD COLUMN master_panel_id INT NULL AFTER car_id,
  ADD INDEX idx_sm_jobdesc_wo_master_panel_id (master_panel_id),
  ADD CONSTRAINT fk_sm_jobdesc_wo_master_panel
    FOREIGN KEY (master_panel_id) REFERENCES master_panels (id)
    ON UPDATE CASCADE
    ON DELETE SET NULL;
