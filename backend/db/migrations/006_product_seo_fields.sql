-- 006: product-level SEO fields (mirrors Alembic e4f1a9c2b7d3).
-- Meta title/description/keywords plus Open Graph overrides and a canonical URL
-- per product. Safe to rerun.

ALTER TABLE product ADD COLUMN IF NOT EXISTS seo_title varchar(200) NOT NULL DEFAULT '';
ALTER TABLE product ADD COLUMN IF NOT EXISTS seo_description varchar(500) NOT NULL DEFAULT '';
ALTER TABLE product ADD COLUMN IF NOT EXISTS seo_keywords varchar(500) NOT NULL DEFAULT '';
ALTER TABLE product ADD COLUMN IF NOT EXISTS og_title varchar(200) NOT NULL DEFAULT '';
ALTER TABLE product ADD COLUMN IF NOT EXISTS og_description varchar(500) NOT NULL DEFAULT '';
ALTER TABLE product ADD COLUMN IF NOT EXISTS og_image text NOT NULL DEFAULT '';
ALTER TABLE product ADD COLUMN IF NOT EXISTS canonical_url varchar(1000) NOT NULL DEFAULT '';
