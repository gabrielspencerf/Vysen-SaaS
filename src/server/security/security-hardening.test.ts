import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createWebhookSignature,
  verifyWebhookSignature,
} from "@/server/security/webhook-signature";
import { SafeFetchError, safeFetch } from "@/server/security/safe-fetch";
import {
  redactLikelyPhoneSequences,
  redactSensitiveLog,
} from "@/server/security/log-redact";

describe("safeFetch (SSRF)", () => {
  it("rejeita host fora da allowlist", async () => {
    await assert.rejects(
      async () =>
        safeFetch("https://example.com/", {
          method: "GET",
          allowedHosts: ["google.com"],
          timeoutMs: 5000,
          maxRedirects: 0,
        }),
      (e: unknown) => e instanceof SafeFetchError
    );
  });

  it("rejeita loopback mesmo se allowlist incluir o hostname", async () => {
    await assert.rejects(
      async () =>
        safeFetch("http://127.0.0.1:9/", {
          method: "GET",
          allowedHosts: ["127.0.0.1"],
          timeoutMs: 3000,
          maxRedirects: 0,
        }),
      (e: unknown) => e instanceof SafeFetchError
    );
  });
});

describe("logs sem dados sensíveis", () => {
  it("redige sequência parecida com telefone", () => {
    const raw = "contato +55 11 91234-5678 ok";
    const out = redactLikelyPhoneSequences(raw);
    assert.ok(!out.includes("91234"));
    assert.ok(out.includes("[phone]"));
  });

  it("redige e-mails", () => {
    const out = redactSensitiveLog("usuario@empresa.com.br pediu acesso");
    assert.ok(!out.includes("usuario@empresa"));
    assert.ok(out.includes("[email]"));
  });

  it("redige tokens estilo sk-...", () => {
    const out = redactSensitiveLog("OPENAI_API_KEY=sk-abcdef0123456789ABCDEF--");
    assert.ok(!out.includes("sk-abcdef"));
    assert.ok(out.includes("[sk-redacted]"));
  });

  it("redige Authorization: Bearer", () => {
    const out = redactSensitiveLog("authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig");
    assert.ok(!out.includes("eyJhbGc"));
    // Pode ser substituído pelo regex JWT (ordem) ou pelo bearer — ambos são aceitáveis.
    assert.ok(out.includes("[redacted]") || out.includes("[jwt]"));
  });

  it("redige access_token em query string", () => {
    const out = redactSensitiveLog("https://graph.facebook.com/v17/123/events?access_token=EAAB123456abc");
    assert.ok(!out.includes("EAAB123456abc"));
    assert.ok(out.includes("access_token=[redacted]"));
  });
});

describe("webhook HMAC / assinatura", () => {
  it("assinatura inválida é rejeitada", () => {
    const secret = "unit-test-secret";
    const ts = String(Date.now());
    const rawBody = "{}";
    const bad = verifyWebhookSignature({
      timestampHeader: ts,
      signatureHeader: "00".repeat(32),
      rawBody,
      secret,
    });
    assert.equal(bad.ok, false);
  });

  it("assinatura válida é aceita", () => {
    const secret = "unit-test-secret";
    const ts = String(Date.now());
    const rawBody = '{"a":1}';
    const sig = createWebhookSignature(ts, rawBody, secret);
    const ok = verifyWebhookSignature({
      timestampHeader: ts,
      signatureHeader: sig,
      rawBody,
      secret,
    });
    assert.equal(ok.ok, true);
  });
});
