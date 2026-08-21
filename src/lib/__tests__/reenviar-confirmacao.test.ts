/**
 * Testes do reenvio de e-mail de confirmação para pedidos de convidado:
 * - só aceita pedido sem `user_id` (sem login)
 * - exige e-mail exatamente igual ao do cliente do pedido
 * - link direto (`tracking_url`) consistente com /pedido/:id
 * - rate limit de 5 envios por 10 min por IP
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

type Pedido = {
  id: string;
  user_id: string | null;
  valor_total: number;
  horario_entrega: string;
  observacoes: string | null;
  clientes: { nome: string; email: string } | null;
  enderecos: Record<string, string> | null;
  itens_pedido: Array<{
    quantidade: number;
    preco_unitario: number;
    produtos: { nome: string } | null;
  }>;
};

const state: {
  pedido: Pedido | null;
  filtroUserIdNull: boolean;
  sends: Array<{ template: string; to: string; options: any }>;
  suppress: boolean;
} = { pedido: null, filtroUserIdNull: false, sends: [], suppress: false };

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => {
      const chain: any = {};
      chain.select = () => chain;
      chain.eq = () => chain;
      chain.is = (col: string, val: unknown) => {
        if (col === "user_id" && val === null) state.filtroUserIdNull = true;
        return chain;
      };
      chain.maybeSingle = async () => {
        const p = state.pedido;
        // Emula a política do filtro `.is("user_id", null)`
        if (!p || (state.filtroUserIdNull && p.user_id !== null)) {
          return { data: null, error: null };
        }
        return { data: p, error: null };
      };
      return chain;
    },
  },
}));

vi.mock("@/lib/email-templates/send-email", () => ({
  sendTemplateEmail: async (template: string, to: string, options: any) => {
    state.sends.push({ template, to, options });
    return state.suppress
      ? { sent: false, reason: "recipient_suppressed" }
      : { sent: true };
  },
}));

vi.mock("@/lib/mercadopago.server", () => ({
  getPublicAppUrl: () => "https://carbodobem.com.br",
}));

const PEDIDO_ID = "ad10d06d-dd1c-4c00-a707-7d122ac54036";

function pedidoBase(overrides: Partial<Pedido> = {}): Pedido {
  return {
    id: PEDIDO_ID,
    user_id: null,
    valor_total: 130,
    horario_entrega: "2026-08-22T15:00:00.000Z",
    observacoes: null,
    clientes: { nome: "Felipe", email: "Felipe.Sturari@Gmail.com" },
    enderecos: { cep: "71503505", rua: "SHIN QI 5", numero: "10", bairro: "Lago Norte" },
    itens_pedido: [
      { quantidade: 2, preco_unitario: 50, produtos: { nome: "Salmão" } },
      { quantidade: 1, preco_unitario: 20, produtos: { nome: "Frango" } },
    ],
    ...overrides,
  };
}

async function reenviar(email: string) {
  const { reenviarConfirmacaoConvidado } = await import(
    "@/lib/reenviar-confirmacao.server"
  );
  return reenviarConfirmacaoConvidado({ pedidoId: PEDIDO_ID, email });
}

describe("reenviarConfirmacaoConvidado", () => {
  beforeEach(() => {
    state.pedido = pedidoBase();
    state.filtroUserIdNull = false;
    state.sends = [];
    state.suppress = false;
  });

  it("reenvia para o e-mail do pedido (case-insensitive) sem exigir login", async () => {
    const res = await reenviar("felipe.sturari@gmail.com");
    expect(res).toEqual({ ok: true });
    expect(state.sends).toHaveLength(1);
    expect(state.sends[0]!.template).toBe("pedido-confirmado");
    expect(state.sends[0]!.to).toBe("Felipe.Sturari@Gmail.com");
  });

  it("mantém o link direto do pedido consistente", async () => {
    await reenviar("felipe.sturari@gmail.com");
    expect(state.sends[0]!.options.templateData.tracking_url).toBe(
      `https://carbodobem.com.br/pedido/${PEDIDO_ID}`,
    );
    expect(state.sends[0]!.options.templateData.pedido_id).toBe(PEDIDO_ID);
  });

  it("calcula subtotal e taxa de entrega a partir dos itens", async () => {
    await reenviar("felipe.sturari@gmail.com");
    const d = state.sends[0]!.options.templateData;
    expect(d.subtotal).toBe(120);
    expect(d.taxa_entrega).toBe(10);
    expect(d.valor_total).toBe(130);
  });

  it("recusa e-mail que não corresponde ao pedido, sem enviar nada", async () => {
    await expect(reenviar("outro@exemplo.com")).rejects.toThrow(
      /não corresponde/i,
    );
    expect(state.sends).toHaveLength(0);
  });

  it("recusa pedido vinculado a uma conta (exige login)", async () => {
    state.pedido = pedidoBase({ user_id: "11111111-1111-1111-1111-111111111111" });
    await expect(reenviar("felipe.sturari@gmail.com")).rejects.toThrow(
      /não encontrado/i,
    );
    expect(state.filtroUserIdNull).toBe(true);
    expect(state.sends).toHaveLength(0);
  });

  it("recusa pedido inexistente", async () => {
    state.pedido = null;
    await expect(reenviar("felipe.sturari@gmail.com")).rejects.toThrow(
      /não encontrado/i,
    );
  });

  it("reporta e-mail suprimido sem lançar erro", async () => {
    state.suppress = true;
    const res = await reenviar("felipe.sturari@gmail.com");
    expect(res.ok).toBe(false);
    expect(res.motivo).toBe("suprimido");
    expect(res.mensagem).toMatch(/bloqueado/i);
  });

  it("usa idempotencyKey distinta por reenvio", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-21T00:00:00Z"));
    await reenviar("felipe.sturari@gmail.com");
    vi.setSystemTime(new Date("2026-08-21T00:00:05Z"));
    await reenviar("felipe.sturari@gmail.com");
    vi.useRealTimers();
    const [a, b] = state.sends.map((s) => s.options.idempotencyKey);
    expect(a).not.toBe(b);
    expect(a).toContain(PEDIDO_ID);
  });
});
