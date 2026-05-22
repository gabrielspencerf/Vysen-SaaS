-- Adiciona DEFAULT 'new' em leads.status para inserts que não especificam status.
-- Antes, INSERT INTO leads sem status falhava com "null value in column status".
ALTER TABLE "leads"
  ALTER COLUMN "status" SET DEFAULT 'new';
