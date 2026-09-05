USE sms_db;

ALTER TABLE unit_catalog
  MODIFY id bigint unsigned NOT NULL AUTO_INCREMENT;

ALTER TABLE catalog_panel_images
  MODIFY id bigint unsigned NOT NULL AUTO_INCREMENT;
