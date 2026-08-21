import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const pedidoBaseSchema = z.object({
  cliente: z.object({
    nome: z.string().min(2),
    telefone: z.string().min(10),
    email: z.string().email(),
    cpf: z.string().length(11),
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
    .array(z.object({ produto_id: z.string().uuid(), quantidade: z.number().int().positive() }))
    .min(1),
  observacoes: z.string().optional().nullable(),
});

const checkoutSchema = pedidoBaseSchema.extend({
  origin: z.string().url().optional(),
});

const cartaoSchema = pedidoBaseSchema.extend({
  cartao: z.object({
    token: z.string().min(1),
    payment_method_id: z.string().min(1),
    installments: z.number().int().positive().max(12),
    issuer_id: z.string().nullable().optional(),
  }),
});

const statusSchema = z.object({
  pedido_id: z.string().uuid().optional(),
  payment_id: z.string().optional(),
});

// Resolve user_id opcional pelo header Authorization. Retorna undefined em erro.
async function resolveUserId(): Promise<string | undefined> {
  const { getRequestHeader } = await import("@tanstack/react-start/server");
  try {
    const authHeader = getRequestHeader("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
    if (!token) return undefined;
    const { createClient } = await import("@supabase/supabase-js");
    const supa = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data } = await supa.auth.getUser(token);
    return data.user?.id;
  } catch {
    return undefined;
  }
}

/**
 * Rate limit best-effort para endpoints de pagamento. Chaveia por IP + rota.
 * Sem edge WAF: isso reduz abuso simples (scripts, retries automáticos)
 * mas não substitui um limitador em borda.
 */
async function limitarPagamento(rota: string): Promise<void> {
  const { getRequestHeader } = await import("@tanstack/react-start/server");
  const { enforceRateLimit, clientKeyFromHeaders } = await import(
    "@/lib/rate-limit.server"
  );
  const headers = {
    get: (name: string) => getRequestHeader(name) ?? null,
  };
  const ip = clientKeyFromHeaders(headers);
  await enforceRateLimit({
    key: `pay:${rota}:${ip}`,
    limit: 10,
    windowSeconds: 60,
    message: "Muitas tentativas de pagamento. Aguarde {s}s e tente novamente.",
  });
}

/** Retorna a public key do Mercado Pago para uso no SDK JS do cliente. */
export const obterMercadoPagoPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  const { getMercadoPagoPublicKey } = await import("@/lib/mercadopago.server");
  return getMercadoPagoPublicKey();
});

/** Fluxo redirect: Checkout Pro (mantido). */
export const iniciarCheckoutMercadoPago = createServerFn({ method: "POST" })
  .inputValidator((raw) => checkoutSchema.parse(raw))
  .handler(async ({ data }) => {
    await limitarPagamento("checkout");
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const { criarCheckoutMercadoPago } = await import("@/lib/mercadopago.server");
    const forwardedProto = getRequestHeader("x-forwarded-proto") || "https";
    const forwardedHost = getRequestHeader("x-forwarded-host") || getRequestHeader("host");
    const requestOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : undefined;
    const userId = await resolveUserId();
    return criarCheckoutMercadoPago({
      ...data,
      user_id: userId,
      origin: data.origin ?? requestOrigin,
    });
  });

/** Fluxo Pix nativo: retorna QR + copia-e-cola. */
export const criarPagamentoPix = createServerFn({ method: "POST" })
  .inputValidator((raw) => pedidoBaseSchema.parse(raw))
  .handler(async ({ data }) => {
    await limitarPagamento("pix");
    const { criarPagamentoPixMP } = await import("@/lib/mercadopago.server");
    const userId = await resolveUserId();
    return criarPagamentoPixMP({ ...data, user_id: userId });
  });

const regerarPixSchema = z.object({
  pedido_id: z.string().uuid(),
  cliente: z.object({
    nome: z.string().min(2),
    telefone: z.string().min(10),
    email: z.string().email(),
    cpf: z.string().length(11),
  }),
});

/** Reemite Pix para um pedido pendente existente (não recria o pedido). */
export const regerarPagamentoPix = createServerFn({ method: "POST" })
  .inputValidator((raw) => regerarPixSchema.parse(raw))
  .handler(async ({ data }) => {
    await limitarPagamento("pix-regen");
    const { regerarPagamentoPixMP } = await import("@/lib/mercadopago.server");
    return regerarPagamentoPixMP({
      pedidoId: data.pedido_id,
      cliente: data.cliente,
    });
  });

/** Fluxo cartão: recebe token gerado no cliente pelo MP.js. */
export const criarPagamentoCartao = createServerFn({ method: "POST" })
  .inputValidator((raw) => cartaoSchema.parse(raw))
  .handler(async ({ data }) => {
    await limitarPagamento("cartao");
    const { criarPagamentoCartaoMP } = await import("@/lib/mercadopago.server");
    const userId = await resolveUserId();
    return criarPagamentoCartaoMP({ ...data, user_id: userId });
  });

/** Consulta status atual do pagamento (usado no polling do Pix). */
export const confirmarPagamentoMercadoPago = createServerFn({ method: "POST" })
  .inputValidator((raw) => statusSchema.parse(raw))
  .handler(async ({ data }) => {
    const { sincronizarPagamentoPedido } = await import("@/lib/mercadopago.server");
    return sincronizarPagamentoPedido({
      pedidoId: data.pedido_id,
      paymentId: data.payment_id,
    });
  });
