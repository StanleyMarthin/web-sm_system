ALTER TABLE cars
  MODIFY COLUMN vin_number VARCHAR(100) NULL,
  ADD COLUMN police_number VARCHAR(50) NULL AFTER vin_number,
  ADD COLUMN vehicle_year SMALLINT UNSIGNED NULL AFTER customer_name,
  ADD COLUMN engine_number VARCHAR(255) NULL AFTER vehicle_year,
  ADD COLUMN vehicle_color VARCHAR(255) NULL AFTER engine_number,
  ADD COLUMN has_bpkb TINYINT(1) NULL AFTER vehicle_notes,
  ADD COLUMN has_stnk TINYINT(1) NULL AFTER has_bpkb,
  ADD COLUMN stnk_tax_due_date DATE NULL AFTER has_stnk,
  ADD COLUMN bpkb_tax_due_date DATE NULL AFTER stnk_tax_due_date;
