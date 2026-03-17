-- Seed etapas padrão do onboarding (só insere se não existir por slug)
INSERT INTO "onboarding_steps" ("id", "slug", "name", "description", "sort_order")
VALUES
  (gen_random_uuid(), 'conectar-google-ads', 'Conectar Google Ads', 'Vincule sua conta Google Ads para acompanhar campanhas e conversões.', 10),
  (gen_random_uuid(), 'cadastrar-primeiro-lead', 'Cadastrar primeiro lead', 'Importe ou capture seu primeiro lead para começar o funil.', 20),
  (gen_random_uuid(), 'configurar-perfil', 'Configurar perfil', 'Preencha dados da empresa e do seu perfil em Configurações.', 30),
  (gen_random_uuid(), 'configurar-funil', 'Configurar funil', 'Defina as etapas do seu funil de vendas.', 40),
  (gen_random_uuid(), 'revisar-produtos', 'Revisar produtos', 'Cadastre produtos e defina se são pagamento único ou recorrente (MRR).', 50)
ON CONFLICT ("slug") DO NOTHING;
