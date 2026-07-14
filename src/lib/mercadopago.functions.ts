import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { CreatePreferenceResult } from "./mercadopago";

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
 *
 * ⚠️ ATUALMENTE MOCKADO — devolve um init_point falso.
 * A chamada real está comentada abaixo. Para ativar:
 *   1. Preencher MERCADOPAGO_ACCESS_TOKEN no .env
 *   2. Descomentar o bloco `fetch("https://api.mercadopago.com/checkout/preferences" ...)`
 *   3. Remover o retorno mock
 */
export const criarPreferenciaMP = createServerFn({ method: "POST" })
  .inputValidator((raw) => inputSchema.parse(raw))
  .handler(async ({ data }): Promise<CreatePreferenceResult> => {
    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    const publicUrl = process.env.PUBLIC_APP_URL ?? "http://localhost:8080";

    // ------ MOCK (remover ao integrar de verdade) ------
    if (!accessToken || accessToken.startsWith("TEST-xxxx") || accessToken === "") {
      return {
        id: `MOCK-${data.pedido_id}`,
        init_point: `${publicUrl}/checkout/sucesso?pedido=${data.pedido_id}&mock=1`,
        sandbox_init_point: `${publicUrl}/checkout/sucesso?pedido=${data.pedido_id}&mock=1`,
      };
    }

    // ------ CHAMADA REAL (stub — habilitar quando tiver credenciais) ------
    /*
    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        items: data.items.map((i) => ({ ...i, currency_id: "BRL" })),
        payer: data.payer,
        external_reference: data.pedido_id,
        back_urls: {
          success: `${publicUrl}/checkout/sucesso?pedido=${data.pedido_id}`,
          failure: `${publicUrl}/checkout/falha?pedido=${data.pedido_id}`,
          pending: `${publicUrl}/checkout/pendente?pedido=${data.pedido_id}`,
        },
        auto_return: "approved",
        notification_url: `${publicUrl}/api/public/webhooks/mercadopago`,
        payment_methods: {
          // PIX, cartão, boleto liberados por padrão
        },
      }),
    });
    if (!res.ok) throw new Error(`Mercado Pago erro ${res.status}`);
    const json = (await res.json()) as CreatePreferenceResult;
    return json;
    */

    // fallback (não deve chegar aqui)
    return {
      id: `MOCK-${data.pedido_id}`,
      init_point: `${publicUrl}/checkout/sucesso?pedido=${data.pedido_id}&mock=1`,
      sandbox_init_point: `${publicUrl}/checkout/sucesso?pedido=${data.pedido_id}&mock=1`,
    };
  });
