import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Webhook Mercado Pago (Checkout Pro / IPN v2).
 * URL configurada no painel MP:
 *   https://<dominio>/api/public/webhooks/mercadopago
 *
 * Segurança: valida x-signature (HMAC-SHA256) com MERCADOPAGO_WEBHOOK_SECRET.
 * Fluxo: quando `type=payment`, busca /v1/payments/{id} e atualiza pedido.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Signature, X-Request-Id",
};

function verifySignature(params: {
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string | null;
  secret: string;
}): boolean {
  const { signatureHeader, requestId, dataId, secret } = params;
  if (!signatureHeader || !dataId) return false;

  // Header: "ts=1699999999,v1=abcdef..."
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k?.trim(), v?.trim()];
    }),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  // Manifest conforme docs MP: id:<data.id>;request-id:<x-request-id>;ts:<ts>;
  const manifest = `id:${dataId};request-id:${requestId ?? ""};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");

  try {
    const a = Buffer.from(v1, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function mapStatus(mpStatus: string): "pendente" | "em_preparo" | "cancelado" {
  switch (mpStatus) {
    case "approved":
      return "em_preparo";
    case "rejected":
    case "cancelled":
    case "refunded":
    case "charged_back":
      return "cancelado";
    default:
      return "pendente"; // in_process, pending, authorized
  }
}

export const Route = createFileRoute("/api/public/webhooks/mercadopago")({
  // @ts-expect-error - `server` handled by TanStack Start plugin at build time
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: corsHeaders }),

      POST: async ({ request }: { request: Request }) => {
        const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
        const accessToken =
          process.env.MERCADOPAGO_ACCESS_TOKEN_PROD ||
          process.env.MERCADOPAGO_ACCESS_TOKEN_TEST;

        if (!secret || !accessToken) {
          console.error("[MP webhook] segredos ausentes");
          return new Response("Missing config", { status: 500, headers: corsHeaders });
        }

        const url = new URL(request.url);
        const signatureHeader = request.headers.get("x-signature");
        const requestId = request.headers.get("x-request-id");

        // MP envia data.id no query e/ou no body
        let bodyJson: { type?: string; action?: string; data?: { id?: string | number } } = {};
        try {
          bodyJson = await request.json();
        } catch {
          /* alguns pings vêm sem corpo */
        }

        const dataId =
          url.searchParams.get("data.id") ||
          (bodyJson?.data?.id ? String(bodyJson.data.id) : null);
        const type = url.searchParams.get("type") || bodyJson?.type || bodyJson?.action;

        const okSig = verifySignature({ signatureHeader, requestId, dataId, secret });
        if (!okSig) {
          console.warn("[MP webhook] assinatura inválida", { requestId, dataId });
          return new Response("Invalid signature", { status: 401, headers: corsHeaders });
        }

        // Só processamos eventos de pagamento
        if (!type || !String(type).includes("payment") || !dataId) {
          return new Response("ok", { status: 200, headers: corsHeaders });
        }

        // Busca detalhes do pagamento
        const payRes = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!payRes.ok) {
          const t = await payRes.text().catch(() => "");
          console.error("[MP webhook] erro ao buscar pagamento", payRes.status, t);
          return new Response("Payment fetch failed", { status: 502, headers: corsHeaders });
        }
        const payment = (await payRes.json()) as {
          id: number;
          status: string;
          external_reference?: string;
        };

        const pedidoId = payment.external_reference;
        if (!pedidoId) {
          return new Response("No external_reference", { status: 200, headers: corsHeaders });
        }

        const novoStatus = mapStatus(payment.status);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin
          .from("pedidos")
          .update({
            status: novoStatus,
            mercadopago_payment_id: String(payment.id),
          })
          .eq("id", pedidoId);

        if (error) {
          console.error("[MP webhook] erro update pedido", error);
          return new Response("DB error", { status: 500, headers: corsHeaders });
        }

        return new Response("ok", { status: 200, headers: corsHeaders });
      },
    },
  },
});
