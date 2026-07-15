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
 * Prioriza MERCADOPAGO_ACCESS_TOKEN_PROD (produção). Se não houver,
 * cai para MERCADOPAGO_ACCESS_TOKEN_TEST (sandbox) — útil para testes.
 */
export const criarPreferenciaMP = createServerFn({ method: "POST" })
  .inputValidator((raw) => inputSchema.parse(raw))
  .handler(async ({ data }): Promise<CreatePreferenceResult & { checkout_url: string; is_sandbox: boolean }> => {
    const prodToken = process.env.MERCADOPAGO_ACCESS_TOKEN_PROD;
    const testToken = process.env.MERCADOPAGO_ACCESS_TOKEN_TEST;
    const accessToken = prodToken || testToken;
    // Se não há token de produção, estamos em sandbox e devemos usar sandbox_init_point.
    const isSandbox = !prodToken;

    const publicUrl =
      process.env.PUBLIC_APP_URL ??
      "https://project--58f6f86b-1d2b-449d-b777-7408cba43a69.lovable.app";

    if (!accessToken) {
      throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado.");
    }

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
