import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { CreatePreferenceResult } from "./mercadopago";


const checkoutSchema = z.object({
  cliente: z.object({
    nome: z.string().min(2),
    telefone: z.string().min(10),
    email: z.string().email(),
  }),
  endereco: z.object({
    cep: z.string().length(8),
    rua: z.string().min(1),
    numero: z.string().min(1),
    complemento: z.string().optional().nullable(),
    bairro: z.string().min(1),
    cidade: z.string().min(1),
    uf: z.string().length(2),
  }),
  horario_entrega: z.string().datetime(),
  itens: z
    .array(
      z.object({
        produto_id: z.string().uuid(),
        quantidade: z.number().int().positive(),
      }),
    )
    .min(1),
  observacoes: z.string().optional().nullable(),
  origin: z.string().url().optional(),
});

const statusSchema = z.object({
  pedido_id: z.string().uuid().optional(),
  payment_id: z.string().optional(),
});

const inputSchema = z.object({
  pedido_id: z.string().uuid(),
  items: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        quantity: z.number().int().positive(),
        unit_price: z.number().positive(),
      }),
    )
    .min(1),
  payer: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
  }),
});

/**
 * Cria uma preferência de pagamento no Mercado Pago (Checkout Pro).
 * Prioriza MERCADOPAGO_ACCESS_TOKEN_PROD (produção). Se não houver,
 * cai para MERCADOPAGO_ACCESS_TOKEN_TEST (sandbox) — útil para testes.
 */
export const criarPreferenciaMP = createServerFn({ method: "POST" })
  .inputValidator((raw) => inputSchema.parse(raw))
  .handler(async ({ data }): Promise<CreatePreferenceResult & { checkout_url: string; is_sandbox: boolean }> => {
    const { getMercadoPagoConfig, getPublicAppUrl } = await import("@/lib/mercadopago.server");
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const { accessToken, isSandbox } = getMercadoPagoConfig();
    const forwardedProto = getRequestHeader("x-forwarded-proto") || "https";
    const forwardedHost = getRequestHeader("x-forwarded-host") || getRequestHeader("host");
    const requestOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : undefined;

    const publicUrl = getPublicAppUrl(requestOrigin);

    const body = {
      items: data.items.map((i) => ({
        id: i.id,
        title: i.title,
        quantity: i.quantity,
        unit_price: i.unit_price,
        currency_id: "BRL" as const,
      })),
      payer: {
        name: data.payer.name,
        email: data.payer.email,
        ...(data.payer.phone
          ? { phone: { number: data.payer.phone } }
          : {}),
      },
      external_reference: data.pedido_id,
      back_urls: {
        success: `${publicUrl}/checkout/sucesso?pedido=${data.pedido_id}`,
        failure: `${publicUrl}/checkout/sucesso?pedido=${data.pedido_id}&status=failure`,
        pending: `${publicUrl}/checkout/sucesso?pedido=${data.pedido_id}&status=pending`,
      },
      auto_return: "approved",
      notification_url: `${publicUrl}/api/public/webhooks/mercadopago`,
      statement_descriptor: "CARBO DO BEM",
    };

    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[MP] erro criar preferência", res.status, text);
      throw new Error(`Mercado Pago retornou ${res.status}`);
    }

    const json = (await res.json()) as CreatePreferenceResult;

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("pedidos")
        .update({ mercadopago_preference_id: json.id })
        .eq("id", data.pedido_id);
    } catch (e) {
      console.error("[MP] falha ao salvar preference_id", e);
    }

    const checkout_url = isSandbox ? json.sandbox_init_point : json.init_point;
    return { ...json, checkout_url, is_sandbox: isSandbox };
  });

export const iniciarCheckoutMercadoPago = createServerFn({ method: "POST" })
  .inputValidator((raw) => checkoutSchema.parse(raw))
  .handler(async ({ data }) => {
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const { criarCheckoutMercadoPago } = await import("@/lib/mercadopago.server");
    const forwardedProto = getRequestHeader("x-forwarded-proto") || "https";
    const forwardedHost = getRequestHeader("x-forwarded-host") || getRequestHeader("host");
    const requestOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : undefined;

    return criarCheckoutMercadoPago({
      ...data,
      origin: data.origin ?? requestOrigin,
    });
  });

export const confirmarPagamentoMercadoPago = createServerFn({ method: "POST" })
  .inputValidator((raw) => statusSchema.parse(raw))
  .handler(async ({ data }) => {
    const { sincronizarPagamentoPedido } = await import("@/lib/mercadopago.server");
    return sincronizarPagamentoPedido({
      pedidoId: data.pedido_id,
      paymentId: data.payment_id,
    });
  });
