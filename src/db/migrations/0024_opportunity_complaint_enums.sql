-- Converte opportunities.stage e complaints.status de varchar para pgEnum.
--
-- Motivação: consistência com leadStatusEnum / conversationStatusEnum (a base já
-- usa pgEnum para todos os outros campos de status/estágio). varchar livre
-- permite digitação inconsistente e valores fora do conjunto esperado.
--
-- Ordem das operações (importante):
-- 1. Criar os tipos enum
-- 2. Normalizar valores fora do conjunto para o default ("open")
-- 3. Remover o DEFAULT antigo (DEFAULT varchar não casa com novo tipo)
-- 4. ALTER COLUMN ... TYPE ... USING ::enum
-- 5. Restabelecer DEFAULT com cast explícito

-- 1. Enums (DO block para idempotência: cria só se ainda não existir)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'opportunity_stage_enum') THEN
    CREATE TYPE "opportunity_stage_enum" AS ENUM ('open', 'qualified', 'negotiating', 'won', 'lost');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'complaint_status_enum') THEN
    CREATE TYPE "complaint_status_enum" AS ENUM ('open', 'in_progress', 'closed');
  END IF;
END $$;

-- 2. Normalizar opportunities.stage
UPDATE "opportunities"
SET "stage" = 'open'
WHERE "stage" NOT IN ('open', 'qualified', 'negotiating', 'won', 'lost');

-- 3+4+5. Drop default, ALTER COLUMN, restabelece default — só se a coluna ainda for varchar.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'opportunities'
      AND column_name = 'stage'
      AND data_type IN ('character varying', 'text')
  ) THEN
    ALTER TABLE "opportunities" ALTER COLUMN "stage" DROP DEFAULT;
    ALTER TABLE "opportunities"
      ALTER COLUMN "stage" TYPE "opportunity_stage_enum"
      USING "stage"::"opportunity_stage_enum";
    ALTER TABLE "opportunities" ALTER COLUMN "stage" SET DEFAULT 'open'::"opportunity_stage_enum";
  END IF;
END $$;

-- 2. Normalizar complaints.status
UPDATE "complaints"
SET "status" = 'open'
WHERE "status" NOT IN ('open', 'in_progress', 'closed');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'complaints'
      AND column_name = 'status'
      AND data_type IN ('character varying', 'text')
  ) THEN
    ALTER TABLE "complaints" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "complaints"
      ALTER COLUMN "status" TYPE "complaint_status_enum"
      USING "status"::"complaint_status_enum";
    ALTER TABLE "complaints" ALTER COLUMN "status" SET DEFAULT 'open'::"complaint_status_enum";
  END IF;
END $$;
