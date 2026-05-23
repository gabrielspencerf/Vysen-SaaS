-- Per-tenant SMTP override. Fallback to env vars when not present.
CREATE TABLE IF NOT EXISTS "tenant_smtp_configs" (
  "tenant_id" uuid PRIMARY KEY REFERENCES "tenants"("id") ON DELETE CASCADE,
  "host" varchar(255) NOT NULL,
  "port" integer NOT NULL DEFAULT 587,
  "username" varchar(255),
  "password_encrypted" text,
  "from_email" varchar(255) NOT NULL,
  "from_name" varchar(255),
  "reply_to" varchar(255),
  "secure" boolean NOT NULL DEFAULT false,
  "require_tls" boolean NOT NULL DEFAULT true,
  "enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamp (6) with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp (6) with time zone NOT NULL DEFAULT now()
);
