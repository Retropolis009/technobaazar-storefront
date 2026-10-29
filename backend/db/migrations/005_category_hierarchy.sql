-- 005: parent/child categories (mirrors Alembic a71d4f2c9e30).
ALTER TABLE category ADD COLUMN IF NOT EXISTS parent_id integer REFERENCES category(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS ix_category_parent_id ON category (parent_id);
UPDATE category AS child SET parent_id = parent.id
FROM category AS parent
WHERE (child.name = 'Used Laptops' AND parent.name = 'Laptops')
   OR (child.name = 'Used Graphics Cards' AND parent.name = 'Graphics Cards');
