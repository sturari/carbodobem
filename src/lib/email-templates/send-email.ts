import * as React from "react";
import { render } from "@react-email/render";
import { Resend } from "resend";
import { TEMPLATES } from "./registry";
import { EmailSendError, traduzirErroResend } from "./email-errors";

// Server-only: lê RESEND_API_KEY. Nunca importe em componentes do cliente.

const SITE_NAME = "Carbo do Bem";
// Domínio remetente verificado no Resend (registros DNS na GoDaddy).
// Pode ser sobrescrito por EMAIL_FROM_DOMAIN sem mexer no código.
const FROM_DOMAIN = process.env.EMAIL_FROM_DOMAIN || "notify.carbodobem.com.br";
// Endereço que os clientes veem como remetente e para onde as respostas vão.
const FROM_LOCAL = "atendimento";
const DEFAULT_REPLY_TO = "atendimento@carbodobem.com.br";

export type SendTemplateEmailResult =
  | { sent: true; id?: string }
  | { sent: false; reason: "recipient_suppressed" };

export interface SendTemplateEmailOptions {
  templateData?: Record<string, any>;
  /** Evita envio duplicado em novas tentativas; padrão: UUID aleatório (sem dedupe). */
  idempotencyKey?: string;
  replyTo?: string;
}

let cliente: Resend | null = null;
function getResend(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new EmailSendError("emails_disabled", "RESEND_API_KEY não configurada");
  }
  cliente ??= new Resend(apiKey);
  return cliente;
}

/**
 * Renderiza um template registrado e envia pelo Resend. Qualquer falha
 * lança `EmailSendError` (ver `.code`). Destinatários bloqueados pelo
 * Resend (devolução/reclamação anterior) aparecem depois como evento
 * `suppressed` no status do envio.
 */
export async function sendTemplateEmail(
  templateName: string,
  to: string,
  options: SendTemplateEmailOptions = {},
): Promise<SendTemplateEmailResult> {
  const resend = getResend();

  const template = TEMPLATES[templateName];
  if (!template) {
    throw new Error(
      `Template '${templateName}' not found. Available: ${Object.keys(TEMPLATES).join(", ")}`,
    );
  }

  // O `to` do template tem prioridade — notificações internas vão sempre
  // para o endereço fixo.
  const recipient = template.to || to;
  if (!recipient) {
    throw new Error("Recipient is required (the template defines no fixed recipient)");
  }

  const templateData = options.templateData ?? {};
  const element = React.createElement(template.component, templateData);
  const html = await render(element);
  const text = await render(element, { plainText: true });
  const subject =
    typeof template.subject === "function" ? template.subject(templateData) : template.subject;

  const { data, error, headers } = await resend.emails.send(
    {
      from: `${SITE_NAME} <${FROM_LOCAL}@${FROM_DOMAIN}>`,
      to: recipient,
      subject,
      html,
      text,
      replyTo: options.replyTo ?? DEFAULT_REPLY_TO,
      tags: [{ name: "template", value: templateName }],
    },
    { idempotencyKey: options.idempotencyKey || crypto.randomUUID() },
  );

  if (error) throw traduzirErroResend(error, headers);
  return { sent: true, id: data?.id };
}
