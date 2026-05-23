import nodemailer from "nodemailer";
import { resolveSmtpConfig } from "./smtp-resolver";

export interface MailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Se fornecido, tenta usar SMTP override do tenant; caso contrário, env. */
  tenantId?: string | null;
}

export async function sendEmail(
  payload: MailPayload
): Promise<{ ok: boolean; error?: string; source?: "tenant" | "env" }> {
  const cfg = await resolveSmtpConfig(payload.tenantId);
  if (!cfg.enabled) {
    return {
      ok: false,
      error: "SMTP desabilitado por feature flag (SMTP_ENABLED=false).",
      source: cfg.source,
    };
  }
  if (!cfg.host || !cfg.user || !cfg.pass) {
    return {
      ok: false,
      error:
        cfg.source === "tenant"
          ? "SMTP do tenant incompleto. Defina host/usuário/senha."
          : "SMTP global incompleto. Defina SMTP_HOST/SMTP_USER/SMTP_PASS.",
      source: cfg.source,
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      requireTLS: cfg.requireTls,
      tls: {
        rejectUnauthorized:
          (process.env.SMTP_OPENSSL_VERIFY_MODE ?? "peer") === "peer",
      },
      auth: {
        user: cfg.user,
        pass: cfg.pass,
        method: cfg.authMethod,
      },
    });
    await transporter.sendMail({
      from: cfg.from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      replyTo: cfg.replyTo,
    });
    return { ok: true, source: cfg.source };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      source: cfg.source,
    };
  }
}
