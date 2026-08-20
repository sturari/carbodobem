/**
 * Testes da rotina de manutenção: reconciliação de pedidos pendentes com o
 * Mercado Pago (fonte da verdade) e expiração de pedidos abandonados.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

type Updated = { id: string; patch: Record<string, unknown> };

const state = {
  pedidos: [] as Array<Record<string, unknown>>,
  updates: [] as Updated[],
  payments: {} as Record<string, { id: number; status: string }>,
  byPedido: {} as Record<string, { id: number; status: string } | null>,
};

function makeAdmin() {
  return {
    from() {
      const ctx: {
        mode: "select" | "update";
        patch: Record<string, unknown>;
        id?: string;
        statusEq?: string;
      } = { mode: "select", patch: {} };

      const chain: Record<string, unknown> = {};
      const passthrough = ["select", "gte", "order", "limit", "lt"] as const;
      passthrough.forEach((m) => {
        chain[m] = () => chain;
      });
      chain.eq = (col: string, val: string) => {
        if (col === "id") ctx.id = val;
        if (col === "status") ctx.statusEq = val;
        return chain;
      };
      chain.update = (patch: Record<string, unknown>) => {
        ctx.mode = "update";
        ctx.patch = patch;
        return chain;
      };
      chain.then = (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
        if (ctx.mode === "update") {
          if (ctx.id) {
            state.updates.push({ id: ctx.id, patch: ctx.patch });
            return Promise.resolve({ data: null, error: null }).then(resolve, reject);
          }
          // update em lote (expiração)
          const alvo = state.pedidos.filter((p) => p.status === "pendente");
          alvo.forEach((p) => state.updates.push({ id: String(p.id), patch: ctx.patch }));
          return Promise.resolve({
            data: alvo.map((p) => ({ id: p.id })),
            error: null,
          }).then(resolve, reject);
        }
        const rows = state.pedidos.filter(
          (p) => !ctx.statusEq || p.status === ctx.statusEq,
        );
        return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
      };
      return chain;
    },
  };
}

vi.mock("@/integrations/supabase/client.server", () => ({
  get supabaseAdmin() {
    return makeAdmin();
  },
}));

vi.mock("@/lib/mercadopago.server", () => ({
  consultarPagamentoMercadoPago: async (id: string) => {
    const p = state.payments[id];
    if (!p) throw new Error("pagamento não encontrado");
    return p;
  },
  buscarPagamentoPorPedido: async (pedidoId: string) => state.byPedido[pedidoId] ?? null,
  mapMercadoPagoStatus: (status: string) => ({
    pedidoStatus:
      status === "approved"
        ? "pagamento_confirmado"
        : status === "pending" || status === "in_process"
          ? "pendente"
          : "cancelado",
    pagamentoStatus: status,
  }),
}));

const { reconciliarPedidosPendentes, expirarPedidosPendentes } = await import(
  "../manutencao-pedidos.server"
);

describe("reconciliarPedidosPendentes", () => {
  beforeEach(() => {
    state.pedidos = [];
    state.updates = [];
    state.payments = {};
    state.byPedido = {};
  });

  it("confirma pedido pendente cujo pagamento no MP está aprovado", async () => {
    state.pedidos = [
      { id: "ped-1", status: "pendente", mercadopago_payment_id: "900", created_at: "x" },
    ];
    state.payments["900"] = { id: 900, status: "approved" };

    const r = await reconciliarPedidosPendentes();

    expect(r.verificados).toBe(1);
    expect(r.atualizados).toBe(1);
    expect(r.detalhes[0]).toMatchObject({
      pedido_id: "ped-1",
      de: "pendente",
      para: "pagamento_confirmado",
      payment_id: "900",
    });
    expect(state.updates[0]!.patch).toMatchObject({
      status: "pagamento_confirmado",
      mercadopago_payment_id: "900",
    });
  });

  it("encontra pagamento por external_reference quando o pedido não tem payment_id", async () => {
    state.pedidos = [
      { id: "ped-2", status: "pendente", mercadopago_payment_id: null, created_at: "x" },
    ];
    state.byPedido["ped-2"] = { id: 555, status: "approved" };

    const r = await reconciliarPedidosPendentes();

    expect(r.atualizados).toBe(1);
    expect(state.updates[0]).toMatchObject({
      id: "ped-2",
      patch: { status: "pagamento_confirmado", mercadopago_payment_id: "555" },
    });
  });

  it("não altera pedido que segue pendente no MP", async () => {
    state.pedidos = [
      { id: "ped-3", status: "pendente", mercadopago_payment_id: "700", created_at: "x" },
    ];
    state.payments["700"] = { id: 700, status: "pending" };

    const r = await reconciliarPedidosPendentes();

    expect(r.verificados).toBe(1);
    expect(r.atualizados).toBe(0);
    expect(state.updates).toHaveLength(0);
  });

  it("ignora pedido sem pagamento algum no Mercado Pago", async () => {
    state.pedidos = [
      { id: "ped-4", status: "pendente", mercadopago_payment_id: null, created_at: "x" },
    ];
    const r = await reconciliarPedidosPendentes();
    expect(r.atualizados).toBe(0);
    expect(state.updates).toHaveLength(0);
  });

  it("uma falha isolada não interrompe os demais pedidos", async () => {
    state.pedidos = [
      { id: "ped-5", status: "pendente", mercadopago_payment_id: "999", created_at: "x" },
      { id: "ped-6", status: "pendente", mercadopago_payment_id: "901", created_at: "x" },
    ];
    // "999" não existe em state.payments → consulta lança erro.
    state.payments["901"] = { id: 901, status: "approved" };

    const r = await reconciliarPedidosPendentes();

    expect(r.verificados).toBe(2);
    expect(r.atualizados).toBe(1);
    expect(state.updates).toHaveLength(1);
    expect(state.updates[0]!.id).toBe("ped-6");
  });
});

describe("expirarPedidosPendentes", () => {
  beforeEach(() => {
    state.pedidos = [];
    state.updates = [];
  });

  it("cancela pedidos pendentes antigos", async () => {
    state.pedidos = [
      { id: "old-1", status: "pendente" },
      { id: "old-2", status: "pendente" },
      { id: "pago", status: "pagamento_confirmado" },
    ];

    const r = await expirarPedidosPendentes({ horas: 24 });

    expect(r.cancelados).toBe(2);
    expect(state.updates.map((u) => u.id)).toEqual(["old-1", "old-2"]);
    expect(state.updates[0]!.patch).toMatchObject({ status: "cancelado" });
  });

  it("não cancela nada quando não há pendentes", async () => {
    state.pedidos = [{ id: "pago", status: "entregue" }];
    const r = await expirarPedidosPendentes();
    expect(r.cancelados).toBe(0);
    expect(state.updates).toHaveLength(0);
  });
});
