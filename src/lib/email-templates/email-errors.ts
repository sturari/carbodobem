/**
 * Erro do provedor de e-mail (Resend), já traduzido para os códigos que o
 * restante do app usa. Fica separado de `send-email.ts` para que os testes
 * possam simular o envio sem perder a classe de erro.
 */
export type EmailErrorCode =
  | "emails_disabled"
  | "domain_not_verified"
  | "rate_limited"
  | "provider_error";

export class EmailSendError extends Error {
  readonly code: EmailErrorCode;
  readonly status: number | null;
  readonly retryAfterSeconds: number | null;

  constructor(
    code: EmailErrorCode,
    message: string,
    opts: { status?: number | null; retryAfterSeconds?: number | null } = {},
  ) {
    super(message);
    this.name = "EmailSendError";
    this.code = code;
    this.status = opts.status ?? null;
    this.retryAfterSeconds = opts.retryAfterSeconds ?? null;
  }
}

/** Converte a resposta de erro do Resend em `EmailSendError`. */
export function traduzirErroResend(
  error: { name: string; message: string; statusCode: number | null },
  headers: Record<string, string> | null,
): EmailSendError {
  const status = error.statusCode;
  if (
    error.name === "rate_limit_exceeded" ||
    error.name === "daily_quota_exceeded" ||
    error.name === "monthly_quota_exceeded" ||
    status === 429
  ) {
    const retry = Number(headers?.["retry-after"]);
    return new EmailSendError("rate_limited", error.message, {
      status: 429,
      retryAfterSeconds: Number.isFinite(retry) && retry > 0 ? retry : null,
    });
  }
  if (error.name === "invalid_from_address" || /domain.*not verified/i.test(error.message)) {
    return new EmailSendError("domain_not_verified", error.message, { status });
  }
  if (
    error.name === "missing_api_key" ||
    error.name === "invalid_api_key" ||
    error.name === "restricted_api_key"
  ) {
    return new EmailSendError("emails_disabled", error.message, { status });
  }
  return new EmailSendError("provider_error", error.message, { status });
}
