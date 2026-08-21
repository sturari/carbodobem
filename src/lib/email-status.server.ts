/**
 * Consulta o status do último envio de e-mail de um pedido de convidado
 * usando os logs de entrega do provedor gerenciado (envio real, não stub).
 */
import { listEmailLogs, EmailAPIError } from "@lovable.dev/email-js";

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

const EVENTOS: Record<string, StatusEnvio> = {
  sent: "enviado",
  rejected: "rejeitado",
  bounced: "devolvido",
  complained: "reclamacao",
  unsubscribed: "descadastrado",
  suppressed: "bloqueado",
  rate_limited: "limitado",
};

export function mascararEmail(email: string): string {
  const [local, dominio] = email.split("@");
  if (!local || !dominio) return "e-mail do pedido";
  const visivel = local.slice(0, Math.min(2, local.length));
  return `${visivel}${"*".repeat(Math.max(2, local.length - visivel.length))}@${dominio}`;
}

/** Traduz o último evento de entrega para o status exibido ao cliente. */
export async function consultarUltimoEnvio(
  email: string,
  label = "pedido-confirmado",
): Promise<{ status: StatusEnvio; detalhe: string | null; em: string | null }> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { status: "indisponivel", detalhe: null, em: null };

  try {
    const res = await listEmailLogs({ recipient: email, limit: 25 }, { apiKey });
    const eventos = (res.data ?? [])
      .filter((e) => !e.tags?.length || e.tags.includes(label))
      .sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
    const ultimo = eventos[0];
    if (!ultimo) return { status: "sem_registro", detalhe: null, em: null };
    return {
      status: EVENTOS[ultimo.event_type] ?? "indisponivel",
      detalhe: ultimo.status ?? null,
      em: ultimo.timestamp,
    };
  } catch (error) {
    if (error instanceof EmailAPIError) {
      return { status: "indisponivel", detalhe: error.code ?? null, em: null };
    }
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
