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
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        // CRON_SECRET: uso manual/externo.
        // CRON_JOB_SECRET: usado pelo agendamento interno (pg_cron).
        const aceitos = [process.env["CRON_SECRET"], process.env["CRON_JOB_SECRET"]].filter(
          (s): s is string => typeof s === "string" && s.length > 0,
        );
        if (aceitos.length === 0) {
          return new Response("Missing config", { status: 500 });
        }
        const provided = request.headers.get("x-cron-secret");
        if (!provided || !aceitos.includes(provided)) {
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
            resultado.reconciliacao = await reconciliarPedidosPendentes({
              horas: horasReconciliacao,
            });
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
