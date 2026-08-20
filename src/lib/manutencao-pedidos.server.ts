/**
 * Rotinas de manutenção de pedidos (uso exclusivo no servidor):
 * - reconciliar: pedidos `pendente` que já têm pagamento no Mercado Pago
 *   têm o status corrigido a partir da fonte da verdade (API do MP).
 * - expirar: pedidos `pendente` antigos são cancelados para não poluir
 *   relatórios nem travar operação.
 */
import {
  buscarPagamentoPorPedido,
  consultarPagamentoMercadoPago,
  mapMercadoPagoStatus,
} from "@/lib/mercadopago.server";

export type ResultadoReconciliacao = {
  verificados: number;
  atualizados: number;
  detalhes: Array<{ pedido_id: string; de: string; para: string; payment_id: string }>;
};

/** Reconcilia pedidos pendentes criados nas últimas `horas` horas. */
export async function reconciliarPedidosPendentes(opts?: {
  horas?: number;
  limite?: number;
}): Promise<ResultadoReconciliacao> {
  const horas = opts?.horas ?? 24 * 30;
  const limite = opts?.limite ?? 100;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const desde = new Date(Date.now() - horas * 3600_000).toISOString();
  const { data: pedidos, error } = await supabaseAdmin
    .from("pedidos")
    .select("id, status, mercadopago_payment_id, created_at")
    .eq("status", "pendente")
    .gte("created_at", desde)
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error) throw new Error(error.message);

  const detalhes: ResultadoReconciliacao["detalhes"] = [];
  for (const pedido of pedidos ?? []) {
    try {
      const payment = pedido.mercadopago_payment_id
        ? await consultarPagamentoMercadoPago(pedido.mercadopago_payment_id)
        : await buscarPagamentoPorPedido(pedido.id);
      if (!payment) continue;

      const { pedidoStatus } = mapMercadoPagoStatus(payment.status);
      if (pedidoStatus === pedido.status && pedido.mercadopago_payment_id) continue;

      const { error: upErr } = await supabaseAdmin
        .from("pedidos")
        .update({
          status: pedidoStatus,
          mercadopago_payment_id: String(payment.id),
        })
        .eq("id", pedido.id);
      if (upErr) throw new Error(upErr.message);

      if (pedidoStatus !== pedido.status) {
        detalhes.push({
          pedido_id: pedido.id,
          de: pedido.status,
          para: pedidoStatus,
          payment_id: String(payment.id),
        });
      }
    } catch (e) {
      console.error("[reconciliar] falha no pedido", pedido.id, e);
    }
  }

  return {
    verificados: pedidos?.length ?? 0,
    atualizados: detalhes.length,
    detalhes,
  };
}

/** Cancela pedidos que continuam `pendente` após `horas` horas. */
export async function expirarPedidosPendentes(opts?: { horas?: number }) {
  const horas = opts?.horas ?? 24;
  const limite = new Date(Date.now() - horas * 3600_000).toISOString();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data, error } = await supabaseAdmin
    .from("pedidos")
    .update({ status: "cancelado" })
    .eq("status", "pendente")
    .lt("created_at", limite)
    .select("id");
  if (error) throw new Error(error.message);

  return { cancelados: data?.length ?? 0 };
}
