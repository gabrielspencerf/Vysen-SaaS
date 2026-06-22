-- Migration 0028: dois objetivos.
-- 1. RLS nas tabelas criadas após o rollout do 0016 que ficaram sem policy:
--    chatwoot_accounts, whatsapp_cloud_numbers, chatwoot_webhook_events,
--    whatsapp_cloud_webhook_events, tenant_smtp_configs, vysen_chat_threads.
-- 2. Índice único parcial em conversation_messages(conversation_id, external_id)
--    para tornar o dedup de mensagens atômico e seguro sob at-least-once delivery.

-- Template de policy igual ao usado em 0016 e 0018.

-- chatwoot_accounts
ALTER TABLE chatwoot_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatwoot_accounts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_rls_policy ON chatwoot_accounts;
CREATE POLICY tenant_rls_policy ON chatwoot_accounts
  FOR ALL
  USING (
    coalesce(current_setting('app.enforce_rls', true), 'off') <> 'on'
    OR coalesce(current_setting('app.bypass_rls', true), 'off') = 'on'
    OR tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    coalesce(current_setting('app.enforce_rls', true), 'off') <> 'on'
    OR coalesce(current_setting('app.bypass_rls', true), 'off') = 'on'
    OR tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- whatsapp_cloud_numbers
ALTER TABLE whatsapp_cloud_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_cloud_numbers FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_rls_policy ON whatsapp_cloud_numbers;
CREATE POLICY tenant_rls_policy ON whatsapp_cloud_numbers
  FOR ALL
  USING (
    coalesce(current_setting('app.enforce_rls', true), 'off') <> 'on'
    OR coalesce(current_setting('app.bypass_rls', true), 'off') = 'on'
    OR tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    coalesce(current_setting('app.enforce_rls', true), 'off') <> 'on'
    OR coalesce(current_setting('app.bypass_rls', true), 'off') = 'on'
    OR tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- chatwoot_webhook_events
ALTER TABLE chatwoot_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatwoot_webhook_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_rls_policy ON chatwoot_webhook_events;
CREATE POLICY tenant_rls_policy ON chatwoot_webhook_events
  FOR ALL
  USING (
    coalesce(current_setting('app.enforce_rls', true), 'off') <> 'on'
    OR coalesce(current_setting('app.bypass_rls', true), 'off') = 'on'
    OR tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    coalesce(current_setting('app.enforce_rls', true), 'off') <> 'on'
    OR coalesce(current_setting('app.bypass_rls', true), 'off') = 'on'
    OR tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- whatsapp_cloud_webhook_events
ALTER TABLE whatsapp_cloud_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_cloud_webhook_events FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_rls_policy ON whatsapp_cloud_webhook_events;
CREATE POLICY tenant_rls_policy ON whatsapp_cloud_webhook_events
  FOR ALL
  USING (
    coalesce(current_setting('app.enforce_rls', true), 'off') <> 'on'
    OR coalesce(current_setting('app.bypass_rls', true), 'off') = 'on'
    OR tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    coalesce(current_setting('app.enforce_rls', true), 'off') <> 'on'
    OR coalesce(current_setting('app.bypass_rls', true), 'off') = 'on'
    OR tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- tenant_smtp_configs (tenant_id é PK, coluna existe)
ALTER TABLE tenant_smtp_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_smtp_configs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_rls_policy ON tenant_smtp_configs;
CREATE POLICY tenant_rls_policy ON tenant_smtp_configs
  FOR ALL
  USING (
    coalesce(current_setting('app.enforce_rls', true), 'off') <> 'on'
    OR coalesce(current_setting('app.bypass_rls', true), 'off') = 'on'
    OR tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    coalesce(current_setting('app.enforce_rls', true), 'off') <> 'on'
    OR coalesce(current_setting('app.bypass_rls', true), 'off') = 'on'
    OR tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- vysen_chat_threads
ALTER TABLE vysen_chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE vysen_chat_threads FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_rls_policy ON vysen_chat_threads;
CREATE POLICY tenant_rls_policy ON vysen_chat_threads
  FOR ALL
  USING (
    coalesce(current_setting('app.enforce_rls', true), 'off') <> 'on'
    OR coalesce(current_setting('app.bypass_rls', true), 'off') = 'on'
    OR tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid
  )
  WITH CHECK (
    coalesce(current_setting('app.enforce_rls', true), 'off') <> 'on'
    OR coalesce(current_setting('app.bypass_rls', true), 'off') = 'on'
    OR tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid
  );

-- Índice único parcial para dedup atômico de mensagens.
-- WHERE external_id IS NOT NULL para não criar conflito entre linhas sem id externo.
CREATE UNIQUE INDEX IF NOT EXISTS conversation_messages_dedup_idx
  ON conversation_messages (conversation_id, external_id)
  WHERE external_id IS NOT NULL;
