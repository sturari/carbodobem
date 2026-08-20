import { createFileRoute } from "@tanstack/react-router";

/**
 * Rotina de manutenção de pedidos (chamada por cron ou manualmente).
 *
 *   POST /api/public/cron/pedidos
 *   Header: x-cron-secret: <CRON_SECRET>
 *   Body opcional: { "reconciliar": true, "expirar": true, "horasExpiracao": 24 }
 *
 * Segurança: exige o segredo CRON_SECRET; nunca retorna dados pessoais.
 */
export const Route = createFileRoute("/api/public/cron/pedidos")({
  // @ts-expect-error - `server` handled by TanStack Start plugin at build time
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const secret = process.env["CRON_SECRET"];
        if (!secret) {
          return new Response("Missing config", { status: 500 });
        }
        const provided = request.headers.get("x-cron-secret");
        if (!provided || provided !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: {
          reconciliar?: boolean;
          expirar?: boolean;
          horasExpiracao?: number;
          horasReconciliacao?: number;
        } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          /* corpo vazio é válido */
        }

        const fazerReconciliar = body.reconciliar !== false;
        const fazerExpirar = body.expirar !== false;
        const horasExpiracao =
          typeof body.horasExpiracao === "number" &&
          body.horasExpiracao >= 1 &&
          body.horasExpiracao <= 24 * 30
            ? body.horasExpiracao
            : 24;
        const horasReconciliacao =
          typeof body.horasReconciliacao === "number" &&
          body.horasReconciliacao >= 1 &&
          body.horasReconciliacao <= 24 * 365
            ? body.horasReconciliacao
            : 24 * 30;

        const { reconciliarPedidosPendentes, expirarPedidosPendentes } = await import(
          "@/lib/manutencao-pedidos.server"
        );

        const resultado: Record<string, unknown> = {};
        try {
          if (fazerReconciliar) {
            resultado.reconciliacao = await reconciliarPedidosPendentes();
          }
          if (fazerExpirar) {
            resultado.expiracao = await expirarPedidosPendentes({ horas: horasExpiracao });
          }
        } catch (e) {
          console.error("[cron pedidos] falha", e);
          return Response.json({ ok: false, erro: "Falha na manutenção." }, { status: 500 });
        }

        return Response.json({ ok: true, ...resultado });
      },
    },
  },
});
