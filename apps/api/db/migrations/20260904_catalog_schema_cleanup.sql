CREATE TABLE IF NOT EXISTS `catalog_components` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(30) NOT NULL,
  `component_name` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_catalog_components_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `catalog_components` (`code`, `component_name`, `description`, `is_active`)
VALUES
  ('ENGINE', 'ENGINE', 'System master component', 1),
  ('UNDERCARRIAGE', 'UNDERCARRIAGE', 'System master component', 1),
  ('ELECTRICAL', 'ELECTRICAL', 'System master component', 1),
  ('BODY', 'BODY', 'System master component', 1),
  ('INTERIOR', 'INTERIOR', 'System master component', 1)
ON DUPLICATE KEY UPDATE
  `component_name` = VALUES(`component_name`),
  `description` = VALUES(`description`),
  `is_active` = VALUES(`is_active`);

CREATE TABLE IF NOT EXISTS `catalog_panels` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `component_id` INT UNSIGNED NOT NULL,
  `panel_name` VARCHAR(150) NOT NULL,
  `description` TEXT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `ux_catalog_panels_component_name` (`component_id`, `panel_name`),
  KEY `idx_catalog_panels_component` (`component_id`),
  CONSTRAINT `fk_catalog_panels_component`
    FOREIGN KEY (`component_id`) REFERENCES `catalog_components` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `catalog_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `panel_id` INT UNSIGNED NOT NULL,
  `code` VARCHAR(50) NULL,
  `part_number` VARCHAR(100) NULL,
  `item_name` VARCHAR(150) NULL,
  `position_code` VARCHAR(50) NULL,
  `qty_normal` DECIMAL(12,2) NULL,
  `notes` TEXT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_catalog_items_panel_sort` (`panel_id`, `sort_order`, `id`),
  KEY `idx_catalog_items_part_number` (`part_number`),
  KEY `idx_catalog_items_code` (`code`),
  FULLTEXT KEY `ft_catalog_items_search` (`item_name`, `part_number`, `code`),
  CONSTRAINT `fk_catalog_items_panel`
    FOREIGN KEY (`panel_id`) REFERENCES `catalog_panels` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `catalog_panel_images` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `panel_id` INT UNSIGNED NOT NULL,
  `url_image` TEXT NOT NULL,
  `caption` VARCHAR(255) NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_by` VARCHAR(50) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_catalog_panel_images_panel` (`panel_id`, `sort_order`, `id`),
  CONSTRAINT `fk_catalog_panel_images_panel`
    FOREIGN KEY (`panel_id`) REFERENCES `catalog_panels` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `unit_additional_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `car_id` VARCHAR(36) NOT NULL,
  `component_id` INT UNSIGNED NOT NULL,
  `panel_id` INT UNSIGNED NULL,
  `item_name` VARCHAR(150) NOT NULL,
  `part_number` VARCHAR(100) NULL,
  `description` TEXT NULL,
  `created_by` VARCHAR(50) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_unit_additional_items_car` (`car_id`),
  KEY `idx_unit_additional_items_component` (`component_id`),
  KEY `idx_unit_additional_items_panel` (`panel_id`),
  CONSTRAINT `fk_unit_additional_items_car`
    FOREIGN KEY (`car_id`) REFERENCES `cars` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_unit_additional_items_component`
    FOREIGN KEY (`component_id`) REFERENCES `catalog_components` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_unit_additional_items_panel`
    FOREIGN KEY (`panel_id`) REFERENCES `catalog_panels` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TEMPORARY TABLE IF EXISTS `tmp_catalog_panel_seed`;
CREATE TEMPORARY TABLE `tmp_catalog_panel_seed` (
  `component_code` VARCHAR(30) NOT NULL,
  `panel_name` VARCHAR(150) NOT NULL,
  UNIQUE KEY `ux_tmp_catalog_panel_seed` (`component_code`, `panel_name`)
) ENGINE=Memory;

INSERT IGNORE INTO `tmp_catalog_panel_seed` (`component_code`, `panel_name`)
SELECT
  candidate.component_code,
  candidate.panel_name
FROM (
  SELECT
    CASE
      WHEN source.search_blob REGEXP '(^|[^A-Z])(DASH|DASHBOARD|INTERIOR|TRIM|SEAT|JOK|CARPET|HEADLINER|CONSOLE|KABIN|CABIN)([^A-Z]|$)' THEN 'INTERIOR'
      WHEN source.search_blob REGEXP '(^|[^A-Z])(LIGHT|LAMP|LAMPU|WIRING|ELECTRIC|ELECTRICAL|KELISTRIKAN|INSTRUMENT|METER|SPEEDOMETER|ECU|SWITCH|FUSE|KLAKSON|HORN)([^A-Z]|$)' THEN 'ELECTRICAL'
      WHEN source.search_blob REGEXP '(^|[^A-Z])(CHASSIS|CHASIS|KAKI|SUSPEN|SPRING|BRAKE|REM|STEERING|GARDAN|AXLE|DIFFERENTIAL|WHEEL|RODA|TRANSMISSION|TRANSMISSION|GEARBOX|PROPELLER)([^A-Z]|$)' THEN 'UNDERCARRIAGE'
      WHEN source.search_blob REGEXP '(^|[^A-Z])(ENGINE|MESIN|COOLING|RADIATOR|FUEL|BENSIN|EXHAUST|KNALPOT|LUBRICATION|OIL|OLI|FILTER UDARA|FILTER BENSIN|TURBO|INTAKE)([^A-Z]|$)' THEN 'ENGINE'
      WHEN source.search_blob REGEXP '(^|[^A-Z])(BODY|FENDER|DOOR|PINTU|BUMPER|GRILL|GRILLE|HOOD|KAP|TRUNK|BAGASI|KACA|WINDSHIELD|ROOF|PILLAR|FRAME|APRON|BULKHEAD|COWL|HARDTOP|SPION|MIRROR|CHROME)([^A-Z]|$)' THEN 'BODY'
      ELSE NULL
    END AS component_code,
    source.panel_name
  FROM (
    SELECT
      UPPER(TRIM(COALESCE(`panel_name`, ''))) AS panel_name,
      UPPER(TRIM(CONCAT_WS(' ', `component_name`, `panel_name`))) AS search_blob
    FROM `unit_catalog_references`
    WHERE TRIM(COALESCE(`panel_name`, '')) <> ''

    UNION ALL

    SELECT
      UPPER(TRIM(`name`)) AS panel_name,
      UPPER(TRIM(CONCAT_WS(' ', `section`, `category`, `name`))) AS search_blob
    FROM `master_panels_general`
    WHERE `parent_id` IS NULL
      AND TRIM(COALESCE(`name`, '')) <> ''

    UNION ALL

    SELECT
      UPPER(TRIM(`name`)) AS panel_name,
      UPPER(TRIM(CONCAT_WS(' ', `component_name`, `section`, `category`, `name`))) AS search_blob
    FROM `master_panels`
    WHERE `parent_id` IS NULL
      AND TRIM(COALESCE(`name`, '')) <> ''
  ) source
) candidate
WHERE candidate.component_code IS NOT NULL
  AND candidate.panel_name <> ''
  AND candidate.panel_name NOT IN (
    'ALL PART',
    'ALL PANEL',
    'ALL PANEL BODY',
    'UNIT',
    'KONTROL',
    'ANGGOTA',
    'AREA KERJA',
    'LAPORAN MINGGUAN',
    'SERVICE PERFORMANCE',
    'PR'
  );

INSERT IGNORE INTO `catalog_panels` (`component_id`, `panel_name`, `description`, `is_active`)
SELECT
  c.id,
  seed.panel_name,
  NULL,
  1
FROM `tmp_catalog_panel_seed` seed
JOIN `catalog_components` c
  ON c.`code` = seed.`component_code`;

DROP TABLE IF EXISTS `unit_catalog_item_mappings_new`;
CREATE TABLE `unit_catalog_item_mappings_new` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `catalog_item_id` BIGINT UNSIGNED NOT NULL,
  `catalog_reference_media_id` BIGINT UNSIGNED NOT NULL,
  `x_percent` DECIMAL(7,4) NOT NULL,
  `y_percent` DECIMAL(7,4) NOT NULL,
  `created_by` VARCHAR(50) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_unit_catalog_item_mappings_item` (`catalog_item_id`, `id`),
  KEY `idx_unit_catalog_item_mappings_media` (`catalog_reference_media_id`),
  CONSTRAINT `chk_unit_catalog_item_mappings_new_x` CHECK (`x_percent` >= 0 AND `x_percent` <= 100),
  CONSTRAINT `chk_unit_catalog_item_mappings_new_y` CHECK (`y_percent` >= 0 AND `y_percent` <= 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `unit_catalog_item_media_new`;
CREATE TABLE `unit_catalog_item_media_new` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `catalog_item_id` BIGINT UNSIGNED NOT NULL,
  `file_url` TEXT NOT NULL,
  `caption` VARCHAR(255) NULL,
  `created_by` VARCHAR(50) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_unit_catalog_item_media_item` (`catalog_item_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `unit_catalog_references_new`;
CREATE TABLE `unit_catalog_references_new` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `car_id` VARCHAR(36) NOT NULL,
  `panel_id` INT UNSIGNED NOT NULL,
  `reference_url` TEXT NULL,
  `notes` TEXT NULL,
  `created_by` VARCHAR(50) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_unit_catalog_references_car_panel` (`car_id`, `panel_id`),
  UNIQUE KEY `ux_unit_catalog_references_car_panel` (`car_id`, `panel_id`),
  CONSTRAINT `fk_unit_catalog_references_new_car`
    FOREIGN KEY (`car_id`) REFERENCES `cars` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT `fk_unit_catalog_references_new_panel`
    FOREIGN KEY (`panel_id`) REFERENCES `catalog_panels` (`id`)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TEMPORARY TABLE IF EXISTS `tmp_unit_catalog_reference_map`;
CREATE TEMPORARY TABLE `tmp_unit_catalog_reference_map` (
  `legacy_reference_id` BIGINT UNSIGNED NOT NULL,
  `new_reference_id` BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (`legacy_reference_id`),
  KEY `idx_tmp_unit_catalog_reference_map_new` (`new_reference_id`)
) ENGINE=Memory;

INSERT INTO `unit_catalog_references_new` (
  `id`, `car_id`, `panel_id`, `reference_url`, `notes`, `created_by`, `created_at`, `updated_at`
)
SELECT
  ranked.keep_id,
  ranked.car_id,
  ranked.panel_id,
  ranked.reference_url,
  ranked.notes,
  ranked.created_by,
  ranked.created_at,
  ranked.updated_at
FROM (
  SELECT
    r.id AS keep_id,
    r.car_id,
    cp.id AS panel_id,
    r.reference_url,
    r.notes,
    r.created_by,
    r.created_at,
    r.updated_at,
    ROW_NUMBER() OVER (
      PARTITION BY r.car_id, cp.id
      ORDER BY r.updated_at DESC, r.id DESC
    ) AS row_no
  FROM `unit_catalog_references` r
  JOIN `tmp_catalog_panel_seed` seed
    ON seed.panel_name = UPPER(TRIM(r.panel_name))
  JOIN `catalog_components` c
    ON c.code = seed.component_code
  JOIN `catalog_panels` cp
    ON cp.component_id = c.id
   AND cp.panel_name = seed.panel_name
) ranked
WHERE ranked.row_no = 1;

INSERT INTO `tmp_unit_catalog_reference_map` (`legacy_reference_id`, `new_reference_id`)
SELECT
  legacy.id,
  winner.new_reference_id
FROM `unit_catalog_references` legacy
JOIN (
  SELECT
    r.id AS legacy_reference_id,
    first_ref.id AS new_reference_id,
    ROW_NUMBER() OVER (
      PARTITION BY r.id
      ORDER BY first_ref.updated_at DESC, first_ref.id DESC
    ) AS row_no
  FROM `unit_catalog_references` r
  JOIN `tmp_catalog_panel_seed` seed
    ON seed.panel_name = UPPER(TRIM(r.panel_name))
  JOIN `catalog_components` c
    ON c.code = seed.component_code
  JOIN `catalog_panels` cp
    ON cp.component_id = c.id
   AND cp.panel_name = seed.panel_name
  JOIN `unit_catalog_references_new` first_ref
    ON first_ref.car_id = r.car_id
   AND first_ref.panel_id = cp.id
) winner
  ON winner.legacy_reference_id = legacy.id
 AND winner.row_no = 1;

DROP TABLE IF EXISTS `unit_catalog_reference_media_new`;
CREATE TABLE `unit_catalog_reference_media_new` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `catalog_reference_id` BIGINT UNSIGNED NOT NULL,
  `url_image` TEXT NOT NULL,
  `caption` VARCHAR(255) NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_by` VARCHAR(50) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_unit_catalog_reference_media_reference` (`catalog_reference_id`, `sort_order`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `unit_catalog_reference_media_new` (
  `id`, `catalog_reference_id`, `url_image`, `caption`, `sort_order`, `created_by`, `created_at`
)
SELECT
  m.id,
  map.new_reference_id,
  m.file_url,
  m.caption,
  m.sort_order,
  m.created_by,
  m.created_at
FROM `unit_catalog_reference_media` m
JOIN `tmp_unit_catalog_reference_map` map
  ON map.legacy_reference_id = m.catalog_reference_id;

DROP TABLE IF EXISTS `unit_catalog_items_new`;
CREATE TABLE `unit_catalog_items_new` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `catalog_reference_id` BIGINT UNSIGNED NOT NULL,
  `code` VARCHAR(50) NULL,
  `part_number` VARCHAR(100) NULL,
  `item_name` VARCHAR(150) NULL,
  `position_code` VARCHAR(50) NULL,
  `qty_normal` DECIMAL(12,2) NULL,
  `qty_opname` DECIMAL(12,2) NULL,
  `actual_name` VARCHAR(255) NULL,
  `availability_status` ENUM('UNKNOWN','AVAILABLE','NOT_AVAILABLE') NOT NULL DEFAULT 'UNKNOWN',
  `condition_status` ENUM('UNKNOWN','GOOD','RESTORE','NOT_USABLE') NOT NULL DEFAULT 'UNKNOWN',
  `action_type` ENUM('UNDECIDED','NO_ACTION','JOBDESC','JOBDESC_ORDER') NOT NULL DEFAULT 'UNDECIDED',
  `survey_status` ENUM('NOT_STARTED','DRAFT','CONFIRMED') NOT NULL DEFAULT 'NOT_STARTED',
  `location` VARCHAR(255) NULL,
  `notes` TEXT NULL,
  `promoted_panel_id` INT NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `surveyed_by` VARCHAR(50) NULL,
  `surveyed_at` DATETIME NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_unit_catalog_items_reference_sort` (`catalog_reference_id`, `sort_order`, `id`),
  KEY `idx_unit_catalog_items_promoted_panel` (`promoted_panel_id`),
  KEY `idx_unit_catalog_items_part_number` (`part_number`),
  KEY `idx_unit_catalog_items_code` (`code`),
  FULLTEXT KEY `ft_unit_catalog_items_search` (`item_name`, `part_number`, `code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `unit_catalog_items_new` (
  `id`, `catalog_reference_id`, `code`, `part_number`, `item_name`, `position_code`,
  `qty_normal`, `qty_opname`, `actual_name`, `availability_status`, `condition_status`,
  `action_type`, `survey_status`, `location`, `notes`, `promoted_panel_id`, `sort_order`,
  `surveyed_by`, `surveyed_at`, `created_at`, `updated_at`
)
SELECT
  i.id,
  map.new_reference_id,
  NULL,
  i.part_number,
  NULLIF(TRIM(COALESCE(i.part_name, '')), ''),
  i.position_code,
  i.qty_normal,
  i.qty_opname,
  i.actual_name,
  i.availability_status,
  i.condition_status,
  i.action_type,
  i.survey_status,
  i.location,
  i.notes,
  i.promoted_panel_id,
  i.sort_order,
  i.surveyed_by,
  i.surveyed_at,
  i.created_at,
  i.updated_at
FROM `unit_catalog_items` i
JOIN `tmp_unit_catalog_reference_map` map
  ON map.legacy_reference_id = i.catalog_reference_id;

INSERT INTO `unit_catalog_item_media_new` (
  `id`, `catalog_item_id`, `file_url`, `caption`, `created_by`, `created_at`
)
SELECT
  m.id,
  m.catalog_item_id,
  m.file_url,
  m.caption,
  m.created_by,
  m.created_at
FROM `unit_catalog_item_media` m
JOIN `unit_catalog_items_new` i
  ON i.id = m.catalog_item_id;

INSERT INTO `unit_catalog_item_mappings_new` (
  `id`, `catalog_item_id`, `catalog_reference_media_id`, `x_percent`, `y_percent`,
  `created_by`, `created_at`, `updated_at`
)
SELECT
  m.id,
  m.catalog_item_id,
  m.catalog_reference_media_id,
  m.x_percent,
  m.y_percent,
  m.created_by,
  m.created_at,
  m.updated_at
FROM `unit_catalog_item_mappings` m
JOIN `unit_catalog_items_new` i
  ON i.id = m.catalog_item_id
JOIN `unit_catalog_reference_media_new` rm
  ON rm.id = m.catalog_reference_media_id;

DROP TABLE IF EXISTS `master_panel_images`;
CREATE TABLE `master_panel_images` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `master_panel_id` INT NOT NULL,
  `image_type` ENUM('REFERENCE','ACTUAL','INITIAL','PROGRESS','FINAL','QC') NOT NULL DEFAULT 'ACTUAL',
  `url_image` TEXT NOT NULL,
  `caption` VARCHAR(255) NULL,
  `source_catalog_media_id` BIGINT UNSIGNED NULL,
  `source_catalog_reference_media_id` BIGINT UNSIGNED NULL,
  `created_by` VARCHAR(50) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_master_panel_images_panel` (`master_panel_id`, `created_at`),
  KEY `idx_master_panel_images_source_catalog` (`source_catalog_media_id`),
  KEY `idx_master_panel_images_source_reference` (`source_catalog_reference_media_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `master_panel_images` (
  `id`, `master_panel_id`, `image_type`, `url_image`, `caption`,
  `source_catalog_media_id`, `source_catalog_reference_media_id`, `created_by`, `created_at`
)
SELECT
  legacy.id,
  legacy.panel_id,
  legacy.media_type,
  legacy.file_url,
  legacy.caption,
  legacy.source_catalog_media_id,
  legacy.source_catalog_reference_media_id,
  legacy.created_by,
  legacy.created_at
FROM `master_panel_media` legacy;

ALTER TABLE `master_panels`
  ADD COLUMN `source_type` VARCHAR(30) NULL AFTER `car_id`,
  ADD COLUMN `source_id` BIGINT UNSIGNED NULL AFTER `source_type`,
  ADD COLUMN `component_id` INT UNSIGNED NULL AFTER `updated_by`,
  ADD COLUMN `panel_id` INT UNSIGNED NULL AFTER `component_id`,
  ADD COLUMN `panel_name` VARCHAR(150) NULL AFTER `panel_id`,
  ADD COLUMN `name_part` VARCHAR(150) NULL AFTER `panel_name`,
  ADD COLUMN `alias_name` VARCHAR(150) NULL AFTER `name_part`,
  ADD COLUMN `current_status` VARCHAR(50) NULL AFTER `alias_name`,
  ADD COLUMN `location` VARCHAR(100) NULL DEFAULT 'UNIT' AFTER `current_status`;

UPDATE `master_panels` child
LEFT JOIN `master_panels` parent
  ON parent.id = child.parent_id
LEFT JOIN `catalog_components` component_map
  ON component_map.code = CASE
    WHEN UPPER(TRIM(CONCAT_WS(' ', child.component_name, child.section, child.category, child.name))) REGEXP '(^|[^A-Z])(DASH|DASHBOARD|INTERIOR|TRIM|SEAT|JOK|CARPET|HEADLINER|CONSOLE|KABIN|CABIN)([^A-Z]|$)' THEN 'INTERIOR'
    WHEN UPPER(TRIM(CONCAT_WS(' ', child.component_name, child.section, child.category, child.name))) REGEXP '(^|[^A-Z])(LIGHT|LAMP|LAMPU|WIRING|ELECTRIC|ELECTRICAL|KELISTRIKAN|INSTRUMENT|METER|SPEEDOMETER|ECU|SWITCH|FUSE|KLAKSON|HORN)([^A-Z]|$)' THEN 'ELECTRICAL'
    WHEN UPPER(TRIM(CONCAT_WS(' ', child.component_name, child.section, child.category, child.name))) REGEXP '(^|[^A-Z])(CHASSIS|CHASIS|KAKI|SUSPEN|SPRING|BRAKE|REM|STEERING|GARDAN|AXLE|DIFFERENTIAL|WHEEL|RODA|TRANSMISSION|TRANSMISSION|GEARBOX|PROPELLER)([^A-Z]|$)' THEN 'UNDERCARRIAGE'
    WHEN UPPER(TRIM(CONCAT_WS(' ', child.component_name, child.section, child.category, child.name))) REGEXP '(^|[^A-Z])(ENGINE|MESIN|COOLING|RADIATOR|FUEL|BENSIN|EXHAUST|KNALPOT|LUBRICATION|OIL|OLI|FILTER UDARA|FILTER BENSIN|TURBO|INTAKE)([^A-Z]|$)' THEN 'ENGINE'
    WHEN UPPER(TRIM(CONCAT_WS(' ', child.component_name, child.section, child.category, child.name))) REGEXP '(^|[^A-Z])(BODY|FENDER|DOOR|PINTU|BUMPER|GRILL|GRILLE|HOOD|KAP|TRUNK|BAGASI|KACA|WINDSHIELD|ROOF|PILLAR|FRAME|APRON|BULKHEAD|COWL|HARDTOP|SPION|MIRROR|CHROME)([^A-Z]|$)' THEN 'BODY'
    ELSE NULL
  END
LEFT JOIN `catalog_panels` panel_map
  ON panel_map.component_id = component_map.id
 AND panel_map.panel_name = UPPER(TRIM(COALESCE(parent.name, child.name)))
SET
  child.component_id = COALESCE(child.component_id, component_map.id),
  child.panel_id = COALESCE(child.panel_id, panel_map.id),
  child.panel_name = COALESCE(child.panel_name, UPPER(TRIM(COALESCE(parent.name, child.name)))),
  child.name_part = COALESCE(child.name_part, child.name),
  child.alias_name = COALESCE(child.alias_name, NULL),
  child.current_status = COALESCE(child.current_status, child.default_stock_status),
  child.location = COALESCE(NULLIF(child.location, ''), child.default_location_type, 'UNIT')
WHERE child.id IS NOT NULL;

CREATE UNIQUE INDEX `ux_master_panels_car_source`
  ON `master_panels` (`car_id`, `source_type`, `source_id`);

ALTER TABLE `unit_catalog_reference_media_new`
  ADD CONSTRAINT `fk_unit_catalog_reference_media_reference_new`
    FOREIGN KEY (`catalog_reference_id`) REFERENCES `unit_catalog_references_new` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE `unit_catalog_items_new`
  ADD CONSTRAINT `fk_unit_catalog_items_reference_new`
    FOREIGN KEY (`catalog_reference_id`) REFERENCES `unit_catalog_references_new` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  ADD CONSTRAINT `fk_unit_catalog_items_promoted_panel_new`
    FOREIGN KEY (`promoted_panel_id`) REFERENCES `master_panels` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE `unit_catalog_item_media_new`
  ADD CONSTRAINT `fk_unit_catalog_item_media_item_new`
    FOREIGN KEY (`catalog_item_id`) REFERENCES `unit_catalog_items_new` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE `unit_catalog_item_mappings_new`
  ADD CONSTRAINT `fk_unit_catalog_item_mappings_item_new`
    FOREIGN KEY (`catalog_item_id`) REFERENCES `unit_catalog_items_new` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  ADD CONSTRAINT `fk_unit_catalog_item_mappings_media_new`
    FOREIGN KEY (`catalog_reference_media_id`) REFERENCES `unit_catalog_reference_media_new` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE `master_panel_images`
  ADD CONSTRAINT `fk_master_panel_images_panel`
    FOREIGN KEY (`master_panel_id`) REFERENCES `master_panels` (`id`)
    ON UPDATE CASCADE ON DELETE CASCADE,
  ADD CONSTRAINT `fk_master_panel_images_source_catalog`
    FOREIGN KEY (`source_catalog_media_id`) REFERENCES `unit_catalog_item_media_new` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL,
  ADD CONSTRAINT `fk_master_panel_images_source_reference`
    FOREIGN KEY (`source_catalog_reference_media_id`) REFERENCES `unit_catalog_reference_media_new` (`id`)
    ON UPDATE CASCADE ON DELETE SET NULL;

DROP TABLE IF EXISTS `master_panel_media`;
DROP TABLE IF EXISTS `unit_catalog_item_mappings`;
DROP TABLE IF EXISTS `unit_catalog_item_media`;
DROP TABLE IF EXISTS `unit_catalog_reference_media`;
DROP TABLE IF EXISTS `unit_catalog_items`;
DROP TABLE IF EXISTS `unit_catalog_references`;

RENAME TABLE
  `unit_catalog_references_new` TO `unit_catalog_references`,
  `unit_catalog_items_new` TO `unit_catalog_items`,
  `unit_catalog_reference_media_new` TO `unit_catalog_reference_media`,
  `unit_catalog_item_media_new` TO `unit_catalog_item_media`,
  `unit_catalog_item_mappings_new` TO `unit_catalog_item_mappings`;
