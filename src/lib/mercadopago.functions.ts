import { createServerFn } from "@tanstack/react-start";

import { z } from "zod";


const checkoutSchema = z.object({
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

// NOTE: A antiga função `criarPreferenciaMP` foi removida por questão de segurança.
// Ela aceitava `unit_price` e `pedido_id` vindos do cliente sem autenticação,
// permitindo que qualquer pessoa criasse um link de pagamento com valor arbitrário
// para um pedido existente. Todo o fluxo de checkout agora passa exclusivamente
// por `iniciarCheckoutMercadoPago`, que deriva preços e totais da tabela
// `produtos` no servidor.



export const iniciarCheckoutMercadoPago = createServerFn({ method: "POST" })
  .inputValidator((raw) => checkoutSchema.parse(raw))
  .handler(async ({ data }) => {
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const { criarCheckoutMercadoPago } = await import("@/lib/mercadopago.server");
    const forwardedProto = getRequestHeader("x-forwarded-proto") || "https";
    const forwardedHost = getRequestHeader("x-forwarded-host") || getRequestHeader("host");
    const requestOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : undefined;

    // Auth opcional: se o usuário estiver logado, associamos o pedido a ele.
    let userId: string | undefined;
    try {
      const authHeader = getRequestHeader("authorization");
      const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;
      if (token) {
        const { createClient } = await import("@supabase/supabase-js");
        const supa = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } },
        );
        const { data: userData } = await supa.auth.getUser(token);
        userId = userData.user?.id;
      }
    } catch {
      // token inválido/expirado — segue como convidado
    }

    return criarCheckoutMercadoPago({
      ...data,
      user_id: userId,
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
