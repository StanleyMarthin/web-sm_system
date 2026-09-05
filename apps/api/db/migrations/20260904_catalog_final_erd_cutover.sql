SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS catalog_components_cutover;
CREATE TABLE catalog_components_cutover (
  id int unsigned NOT NULL,
  code varchar(30) NOT NULL,
  component_name varchar(100) NOT NULL,
  description text DEFAULT NULL,
  is_active tinyint(1) NOT NULL DEFAULT '1',
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY ux_catalog_components_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO catalog_components_cutover (
  id,
  code,
  component_name,
  description,
  is_active,
  created_at,
  updated_at
)
SELECT
  cc.id,
  cc.code,
  cc.component_name,
  cc.description,
  cc.is_active,
  cc.created_at,
  cc.updated_at
FROM catalog_components cc
WHERE cc.code IN ('ENGINE', 'UNDERCARRIAGE', 'ELECTRICAL', 'BODY', 'INTERIOR');

DROP TABLE IF EXISTS catalog_panels_cutover;
CREATE TABLE catalog_panels_cutover (
  id int unsigned NOT NULL,
  component_id int unsigned NOT NULL,
  panel_name varchar(150) NOT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY ux_catalog_panels_component_name (component_id, panel_name),
  KEY idx_catalog_panels_component (component_id),
  CONSTRAINT fk_catalog_panels_cutover_component
    FOREIGN KEY (component_id) REFERENCES catalog_components_cutover (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO catalog_panels_cutover (
  id,
  component_id,
  panel_name,
  created_at,
  updated_at
)
SELECT DISTINCT
  cp.id,
  cp.component_id,
  cp.panel_name,
  COALESCE(cp.created_at, CURRENT_TIMESTAMP),
  COALESCE(cp.updated_at, CURRENT_TIMESTAMP)
FROM catalog_panels cp
JOIN catalog_components_cutover cc ON cc.id = cp.component_id
WHERE EXISTS (
  SELECT 1
  FROM unit_catalog_references ucr
  WHERE ucr.panel_id = cp.id
)
OR EXISTS (
  SELECT 1
  FROM catalog_panel_images cpi
  WHERE cpi.panel_id = cp.id
);

DROP TABLE IF EXISTS catalog_panel_images_cutover;
CREATE TABLE catalog_panel_images_cutover (
  id bigint unsigned NOT NULL AUTO_INCREMENT,
  panel_id int unsigned NOT NULL,
  url_image text NOT NULL,
  caption varchar(255) DEFAULT NULL,
  sort_order int NOT NULL DEFAULT '0',
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_catalog_panel_images_panel (panel_id, sort_order, id),
  CONSTRAINT fk_catalog_panel_images_cutover_panel
    FOREIGN KEY (panel_id) REFERENCES catalog_panels_cutover (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO catalog_panel_images_cutover (
  id,
  panel_id,
  url_image,
  caption,
  sort_order,
  created_at
)
SELECT
  cpi.id,
  cpi.panel_id,
  cpi.url_image,
  cpi.caption,
  COALESCE(cpi.sort_order, 0),
  COALESCE(cpi.created_at, CURRENT_TIMESTAMP)
FROM catalog_panel_images cpi
JOIN catalog_panels_cutover cp ON cp.id = cpi.panel_id;

DROP TABLE IF EXISTS unit_catalog_cutover;
CREATE TABLE unit_catalog_cutover (
  id bigint unsigned NOT NULL AUTO_INCREMENT,
  car_id varchar(36) NOT NULL,
  panel_id int unsigned NOT NULL,
  item_name varchar(150) DEFAULT NULL,
  part_number varchar(100) DEFAULT NULL,
  code varchar(50) DEFAULT NULL,
  position varchar(50) DEFAULT NULL,
  qty_normal decimal(12,2) DEFAULT NULL,
  is_restoration tinyint(1) NOT NULL DEFAULT '0',
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_unit_catalog_car_panel (car_id, panel_id, id),
  KEY idx_unit_catalog_panel (panel_id, id),
  KEY idx_unit_catalog_part_number (part_number),
  KEY idx_unit_catalog_code (code),
  FULLTEXT KEY ft_unit_catalog_search (item_name, part_number, code),
  CONSTRAINT fk_unit_catalog_cutover_car
    FOREIGN KEY (car_id) REFERENCES cars (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_unit_catalog_cutover_panel
    FOREIGN KEY (panel_id) REFERENCES catalog_panels_cutover (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO unit_catalog_cutover (
  id,
  car_id,
  panel_id,
  item_name,
  part_number,
  code,
  position,
  qty_normal,
  is_restoration,
  created_at,
  updated_at
)
SELECT
  uci.id,
  ucr.car_id,
  ucr.panel_id,
  NULLIF(TRIM(uci.item_name), ''),
  NULLIF(TRIM(uci.part_number), ''),
  NULLIF(TRIM(uci.code), ''),
  NULLIF(TRIM(uci.position_code), ''),
  uci.qty_normal,
  CASE
    WHEN uci.promoted_panel_id IS NOT NULL THEN 1
    WHEN uci.survey_status = 'CONFIRMED' THEN 1
    WHEN EXISTS (
      SELECT 1
      FROM master_panels mp
      WHERE mp.source_type = 'CATALOG'
        AND mp.source_id = uci.id
        AND mp.car_id = ucr.car_id
    ) THEN 1
    ELSE 0
  END,
  COALESCE(uci.created_at, CURRENT_TIMESTAMP),
  COALESCE(uci.updated_at, CURRENT_TIMESTAMP)
FROM unit_catalog_items uci
JOIN unit_catalog_references ucr ON ucr.id = uci.catalog_reference_id
JOIN cars c ON c.id = ucr.car_id
JOIN catalog_panels_cutover cp ON cp.id = ucr.panel_id;

DROP TABLE IF EXISTS unit_additional_items_cutover;
CREATE TABLE unit_additional_items_cutover (
  id bigint unsigned NOT NULL,
  car_id varchar(36) NOT NULL,
  component_name varchar(100) DEFAULT NULL,
  panel_name varchar(150) DEFAULT NULL,
  item_name varchar(150) NOT NULL,
  part_number varchar(100) DEFAULT NULL,
  deskription text DEFAULT NULL,
  created_by varchar(50) DEFAULT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_unit_additional_items_car (car_id),
  CONSTRAINT fk_unit_additional_items_cutover_car
    FOREIGN KEY (car_id) REFERENCES cars (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO unit_additional_items_cutover (
  id,
  car_id,
  component_name,
  panel_name,
  item_name,
  part_number,
  deskription,
  created_by,
  created_at,
  updated_at
)
SELECT
  uai.id,
  uai.car_id,
  cc.component_name,
  cp.panel_name,
  uai.item_name,
  uai.part_number,
  uai.description,
  uai.created_by,
  COALESCE(uai.created_at, CURRENT_TIMESTAMP),
  COALESCE(uai.updated_at, CURRENT_TIMESTAMP)
FROM unit_additional_items uai
JOIN cars c ON c.id = uai.car_id
LEFT JOIN catalog_components cc ON cc.id = uai.component_id
LEFT JOIN catalog_panels cp ON cp.id = uai.panel_id;

DROP TABLE IF EXISTS master_panels_cutover;
CREATE TABLE master_panels_cutover (
  id int NOT NULL,
  car_id varchar(36) NOT NULL,
  part_id bigint unsigned DEFAULT NULL,
  source_part varchar(30) DEFAULT NULL,
  component_id int unsigned DEFAULT NULL,
  panel_id int unsigned DEFAULT NULL,
  component_name varchar(100) DEFAULT NULL,
  panel_name varchar(150) DEFAULT NULL,
  name_part varchar(150) DEFAULT NULL,
  alias_name varchar(150) DEFAULT NULL,
  part_number varchar(100) DEFAULT NULL,
  qty decimal(12,2) DEFAULT NULL,
  initial_condition varchar(50) DEFAULT NULL,
  current_status varchar(50) DEFAULT NULL,
  location varchar(100) DEFAULT 'UNIT',
  notes text DEFAULT NULL,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  created_by varchar(50) DEFAULT NULL,
  updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_by varchar(50) DEFAULT NULL,
  section varchar(50) DEFAULT NULL,
  name varchar(100) DEFAULT NULL,
  category varchar(100) DEFAULT NULL,
  is_active tinyint(1) DEFAULT '1',
  parent_id int DEFAULT NULL,
  position_code varchar(50) DEFAULT NULL,
  sort_order int DEFAULT '0',
  qty_normal decimal(12,2) DEFAULT NULL,
  default_location_type varchar(50) DEFAULT 'UNIT',
  default_stock_status varchar(50) DEFAULT 'INSTALLED',
  default_condition_type varchar(50) DEFAULT 'BEKAS',
  default_division_id int DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY ux_master_panels_car_source_part (car_id, source_part, part_id),
  KEY idx_master_panels_car (car_id),
  KEY idx_master_panels_part (part_id),
  KEY idx_master_panels_component (component_id),
  KEY idx_master_panels_panel (panel_id),
  KEY idx_master_panels_parent (parent_id),
  CONSTRAINT fk_master_panels_cutover_car
    FOREIGN KEY (car_id) REFERENCES cars (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_master_panels_cutover_component
    FOREIGN KEY (component_id) REFERENCES catalog_components_cutover (id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_master_panels_cutover_panel
    FOREIGN KEY (panel_id) REFERENCES catalog_panels_cutover (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO master_panels_cutover (
  id,
  car_id,
  part_id,
  source_part,
  component_id,
  panel_id,
  component_name,
  panel_name,
  name_part,
  alias_name,
  part_number,
  qty,
  initial_condition,
  current_status,
  location,
  notes,
  created_at,
  created_by,
  updated_at,
  updated_by,
  section,
  name,
  category,
  is_active,
  parent_id,
  position_code,
  sort_order,
  qty_normal,
  default_location_type,
  default_stock_status,
  default_condition_type,
  default_division_id
)
SELECT
  mp.id,
  mp.car_id,
  CASE
    WHEN mp.source_type = 'CATALOG' AND uc.id IS NOT NULL THEN uc.id
    WHEN mp.source_type = 'ADDITIONAL' AND uai.id IS NOT NULL THEN uai.id
    ELSE NULL
  END AS part_id,
  CASE
    WHEN mp.source_type = 'CATALOG' AND uc.id IS NOT NULL THEN 'CATALOG'
    WHEN mp.source_type = 'ADDITIONAL' AND uai.id IS NOT NULL THEN 'ADDITIONAL'
    ELSE NULL
  END AS source_part,
  CASE WHEN cc.id IS NOT NULL THEN mp.component_id ELSE NULL END AS component_id,
  CASE WHEN cp.id IS NOT NULL THEN mp.panel_id ELSE NULL END AS panel_id,
  NULLIF(TRIM(COALESCE(mp.component_name, cc.component_name)), '') AS component_name,
  NULLIF(TRIM(COALESCE(mp.panel_name, cp.panel_name, mp.name)), '') AS panel_name,
  NULLIF(TRIM(COALESCE(mp.name_part, mp.name)), '') AS name_part,
  NULLIF(TRIM(mp.alias_name), '') AS alias_name,
  NULLIF(TRIM(mp.part_number), '') AS part_number,
  CAST(COALESCE(mp.qty, 1) AS DECIMAL(12,2)) AS qty,
  NULLIF(TRIM(mp.initial_condition), '') AS initial_condition,
  NULLIF(TRIM(mp.current_status), '') AS current_status,
  NULLIF(TRIM(COALESCE(mp.location, mp.default_location_type, 'UNIT')), '') AS location,
  mp.notes,
  mp.created_at,
  mp.created_by,
  mp.updated_at,
  mp.updated_by,
  NULLIF(TRIM(mp.section), '') AS section,
  NULLIF(TRIM(mp.name), '') AS name,
  NULLIF(TRIM(mp.category), '') AS category,
  COALESCE(mp.is_active, 1) AS is_active,
  mp.parent_id,
  NULLIF(TRIM(mp.position_code), '') AS position_code,
  COALESCE(mp.sort_order, 0) AS sort_order,
  mp.qty_normal,
  NULLIF(TRIM(COALESCE(mp.default_location_type, 'UNIT')), '') AS default_location_type,
  NULLIF(TRIM(COALESCE(mp.default_stock_status, 'INSTALLED')), '') AS default_stock_status,
  NULLIF(TRIM(COALESCE(mp.default_condition_type, 'BEKAS')), '') AS default_condition_type,
  mp.default_division_id
FROM master_panels mp
JOIN cars c ON c.id = mp.car_id
LEFT JOIN catalog_components_cutover cc ON cc.id = mp.component_id
LEFT JOIN catalog_panels_cutover cp ON cp.id = mp.panel_id
LEFT JOIN unit_catalog_cutover uc
  ON mp.source_type = 'CATALOG'
 AND mp.source_id = uc.id
LEFT JOIN unit_additional_items_cutover uai
  ON mp.source_type = 'ADDITIONAL'
 AND mp.source_id = uai.id;

ALTER TABLE master_panels_cutover
  ADD CONSTRAINT fk_master_panels_cutover_parent
  FOREIGN KEY (parent_id) REFERENCES master_panels_cutover (id)
  ON DELETE CASCADE ON UPDATE CASCADE;

DROP TABLE IF EXISTS masterpanel_images_cutover;
CREATE TABLE masterpanel_images_cutover (
  id bigint unsigned NOT NULL,
  part_id int NOT NULL,
  url_image text NOT NULL,
  caption varchar(255) DEFAULT NULL,
  sort_order int NOT NULL DEFAULT '0',
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_masterpanel_images_part (part_id, sort_order, id),
  CONSTRAINT fk_masterpanel_images_cutover_part
    FOREIGN KEY (part_id) REFERENCES master_panels_cutover (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO masterpanel_images_cutover (
  id,
  part_id,
  url_image,
  caption,
  sort_order,
  created_at
)
SELECT
  mpi.id,
  mpi.master_panel_id,
  mpi.url_image,
  mpi.caption,
  ROW_NUMBER() OVER (
    PARTITION BY mpi.master_panel_id
    ORDER BY mpi.created_at, mpi.id
  ) - 1 AS sort_order,
  COALESCE(mpi.created_at, CURRENT_TIMESTAMP)
FROM master_panel_images mpi
JOIN master_panels_cutover mp ON mp.id = mpi.master_panel_id;

DROP TABLE IF EXISTS unit_catalog_item_mappings;
DROP TABLE IF EXISTS unit_catalog_item_media;
DROP TABLE IF EXISTS unit_catalog_reference_media;
DROP TABLE IF EXISTS unit_catalog_items;
DROP TABLE IF EXISTS unit_catalog_references;
DROP TABLE IF EXISTS unit_additional_items;
DROP TABLE IF EXISTS master_panel_images;
DROP TABLE IF EXISTS master_panels_general;
DROP TABLE IF EXISTS catalog_items;
DROP TABLE IF EXISTS master_panels;
DROP TABLE IF EXISTS catalog_panel_images;
DROP TABLE IF EXISTS catalog_panels;
DROP TABLE IF EXISTS catalog_components;
DROP TABLE IF EXISTS masterpanel_images;
DROP TABLE IF EXISTS unit_catalog;

RENAME TABLE
  catalog_components_cutover TO catalog_components,
  catalog_panels_cutover TO catalog_panels,
  catalog_panel_images_cutover TO catalog_panel_images,
  unit_catalog_cutover TO unit_catalog,
  unit_additional_items_cutover TO unit_additional_items,
  master_panels_cutover TO master_panels,
  masterpanel_images_cutover TO masterpanel_images;

SET FOREIGN_KEY_CHECKS = 1;
