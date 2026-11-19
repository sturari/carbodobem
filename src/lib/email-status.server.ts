/**
 * Consulta o status do último envio de e-mail de um pedido de convidado
 * usando a lista de envios do Resend (envio real, não stub).
 */
import { Resend } from "resend";

export type StatusEnvio =
  | "enviado"
  | "rejeitado"
  | "devolvido"
  | "reclamacao"
  | "descadastrado"
  | "bloqueado"
  | "limitado"
  | "sem_registro"
  | "indisponivel";

export type StatusEnvioEmail = {
  /** E-mail do pedido, mascarado (nunca exposto por inteiro). */
  email_mascarado: string;
  status: StatusEnvio;
  detalhe: string | null;
  em: string | null;
  /** Reenvios ainda disponíveis na janela atual. */
  tentativas_restantes: number;
  tentativas_limite: number;
  /** Segundos até a janela de tentativas reiniciar (0 quando não há janela ativa). */
  janela_reset_segundos: number;
};

// Último evento do Resend -> status exibido ao cliente.
const EVENTOS: Record<string, StatusEnvio> = {
  queued: "enviado",
  scheduled: "enviado",
  sent: "enviado",
  delivered: "enviado",
  delivery_delayed: "enviado",
  opened: "enviado",
  clicked: "enviado",
  failed: "rejeitado",
  canceled: "rejeitado",
  bounced: "devolvido",
  complained: "reclamacao",
  suppressed: "bloqueado",
};

export function mascararEmail(email: string): string {
  const [local, dominio] = email.split("@");
  if (!local || !dominio) return "e-mail do pedido";
  const visivel = local.slice(0, Math.min(2, local.length));
  return `${visivel}${"*".repeat(Math.max(2, local.length - visivel.length))}@${dominio}`;
}

/**
 * Traduz o último evento de entrega para o status exibido ao cliente.
 * A API do Resend não filtra por destinatário, então olhamos os envios
 * mais recentes da conta (até 100) e ficamos com o último para o e-mail.
 */
export async function consultarUltimoEnvio(
  email: string,
): Promise<{ status: StatusEnvio; detalhe: string | null; em: string | null }> {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) return { status: "indisponivel", detalhe: null, em: null };

  try {
    const { data, error } = await new Resend(apiKey).emails.list({ limit: 100 });
    if (error) return { status: "indisponivel", detalhe: error.name, em: null };
    const alvo = email.trim().toLowerCase();
    const ultimo = (data?.data ?? [])
      .filter((e) => e.to?.some((t) => t.trim().toLowerCase() === alvo))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    if (!ultimo) return { status: "sem_registro", detalhe: null, em: null };
    return {
      status: EVENTOS[ultimo.last_event] ?? "indisponivel",
      detalhe: ultimo.last_event ?? null,
      em: ultimo.created_at,
    };
  } catch {
    return { status: "indisponivel", detalhe: null, em: null };
  }
}

/**
 * Junta o status do último envio com o saldo de reenvios do IP atual.
 * Só responde para pedidos de convidado (`user_id` NULL).
 */
export async function statusEnvioPedido(params: {
  pedidoId: string;
  ip: string;
  limite: number;
  janelaSegundos: number;
}): Promise<StatusEnvioEmail | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: pedido, error } = await supabaseAdmin
    .from("pedidos")
    .select("id, user_id, clientes:cliente_id ( email )")
    .eq("id", params.pedidoId)
    .is("user_id", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const cliente = pedido?.clientes as unknown as { email: string } | null;
  if (!pedido || !cliente?.email) return null;

  const { peekRateLimit } = await import("@/lib/rate-limit.server");
  const [envio, saldo] = await Promise.all([
    consultarUltimoEnvio(cliente.email),
    peekRateLimit({
      key: `reenvio-confirmacao:${params.ip}`,
      limit: params.limite,
      windowSeconds: params.janelaSegundos,
    }),
  ]);

  return {
    email_mascarado: mascararEmail(cliente.email),
    status: envio.status,
    detalhe: envio.detalhe,
    em: envio.em,
    tentativas_restantes: saldo.restantes,
    tentativas_limite: params.limite,
    janela_reset_segundos: saldo.resetEmSegundos,
  };
}
