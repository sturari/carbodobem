/**
 * Testes de integração para `criarPedidoBase` — orquestração de banco
 * (cliente, endereço, pedido, itens) + validação de estoque, cobertura e
 * cálculo de valor_total. O cliente do Supabase é mockado por tabela.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

type Insert = { table: string; data: unknown };

type Scenario = {
  areas: Array<{ cep_inicio: string; cep_fim: string; taxa_entrega: number }>;
  produtos: Array<{
    id: string;
    nome: string;
    preco: number | string;
    ativo: boolean;
    estoque: number;
  }>;
  failInsertOn?: string;
};

const state: { supabase: unknown; inserts: Insert[]; scenario: Scenario | null } = {
  supabase: null,
  inserts: [],
  scenario: null,
};

function makeSupabaseMock(scenario: Scenario) {
  state.inserts = [];
  const from = (table: string) => {
    let insertData: unknown = null;
    let mode: "select" | "insert" = "select";

    const terminate = (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
      try {
        if (mode === "insert") {
          if (scenario.failInsertOn === table) {
            return Promise.resolve({
              data: null,
              error: { message: `Falha simulada em ${table}` },
            }).then(resolve, reject);
          }
          const arr = Array.isArray(insertData) ? insertData : [insertData];
          arr.forEach((row) => state.inserts.push({ table, data: row }));
          return Promise.resolve({ error: null }).then(resolve, reject);
        }
        if (table === "areas_cobertura") {
          return Promise.resolve({ data: scenario.areas, error: null }).then(
            resolve,
            reject,
          );
        }
        if (table === "produtos") {
          return Promise.resolve({ data: scenario.produtos, error: null }).then(
            resolve,
            reject,
          );
        }
        return Promise.resolve({ data: [], error: null }).then(resolve, reject);
      } catch (e) {
        return Promise.reject(e).then(null, reject);
      }
    };

    const chain: Record<string, unknown> = {};
    const methods = ["select", "eq", "in", "order", "not", "or"] as const;
    methods.forEach((m) => {
      chain[m] = () => chain;
    });
    chain.insert = (d: unknown) => {
      mode = "insert";
      insertData = d;
      return chain;
    };
    chain.single = async () => {
      if (mode === "insert") {
        if (scenario.failInsertOn === table) {
          return { data: null, error: { message: `Falha simulada em ${table}` } };
        }
        const rec = Array.isArray(insertData) ? insertData[0] : insertData;
        const id = `${table}-id-${state.inserts.length + 1}`;
        state.inserts.push({ table, data: rec });
        return { data: { id }, error: null };
      }
      return { data: null, error: null };
    };
    chain.then = terminate;
    return chain;
  };
  return { from };
}

vi.mock("@/integrations/supabase/client.server", () => ({
  get supabaseAdmin() {
    return state.supabase;
  },
}));

vi.mock("@/lib/email-templates/send-email", () => ({
  sendTemplateEmail: vi.fn(async () => ({ sent: true })),
}));

import { criarPedidoBase } from "../mercadopago.server";

const baseInput = {
  cliente: {
    nome: "João Teste",
    telefone: "61999999999",
    email: "joao@example.com",
    cpf: "12345678909",
  },
  endereco: {
    cep: "71500000",
    rua: "SHIN QL 1",
    numero: "10",
    complemento: null,
    bairro: "Lago Norte",
    cidade: "Brasília",
    uf: "DF",
  },
  horario_entrega: "hoje 09:00-12:00",
  itens: [{ produto_id: "p1", quantidade: 2 }],
  observacoes: null,
} as const;

describe("criarPedidoBase", () => {
  beforeEach(() => {
    state.inserts = [];
    state.scenario = null;
    state.supabase = null;
  });

  it("cria cliente, endereço, pedido e itens quando estoque é suficiente", async () => {
    state.supabase = makeSupabaseMock({
      areas: [{ cep_inicio: "71000000", cep_fim: "71999999", taxa_entrega: 15 }],
      produtos: [
        { id: "p1", nome: "Salmão", preco: 50, ativo: true, estoque: 10 },
      ],
    });

    const result = await criarPedidoBase({ ...baseInput });

    expect(result.pedidoId).toMatch(/^pedidos-id-/);
    expect(result.subtotal).toBe(100);
    expect(result.taxaEntrega).toBe(15);
    expect(result.valorTotal).toBe(115);
    expect(result.itensCalc).toHaveLength(1);
    expect(result.itensCalc[0]).toMatchObject({
      produto_id: "p1",
      quantidade: 2,
      preco_unitario: 50,
    });

    const tables = state.inserts.map((i) => i.table);
    expect(tables).toContain("clientes");
    expect(tables).toContain("enderecos");
    expect(tables).toContain("pedidos");
    expect(tables).toContain("itens_pedido");

    // CPF não vaza para tabela clientes.
    const cliente = state.inserts.find((i) => i.table === "clientes")!
      .data as Record<string, unknown>;
    expect(cliente).not.toHaveProperty("cpf");
    expect(cliente.email).toBe("joao@example.com");

    // valor_total gravado no pedido bate com o retornado.
    const pedido = state.inserts.find((i) => i.table === "pedidos")!
      .data as Record<string, unknown>;
    expect(pedido.valor_total).toBe(115);
    expect(pedido.status).toBe("pendente");
  });

  it("rejeita quando produto está sem estoque suficiente e não grava nada", async () => {
    state.supabase = makeSupabaseMock({
      areas: [{ cep_inicio: "71000000", cep_fim: "71999999", taxa_entrega: 15 }],
      produtos: [
        { id: "p1", nome: "Salmão", preco: 50, ativo: true, estoque: 1 },
      ],
    });

    await expect(criarPedidoBase({ ...baseInput })).rejects.toThrow(
      /estoque insuficiente/i,
    );
    // Nenhum insert deve ter ocorrido — falha antes do banco ser tocado.
    expect(state.inserts).toHaveLength(0);
  });

  it("rejeita quando produto está zerado e não grava nada", async () => {
    state.supabase = makeSupabaseMock({
      areas: [{ cep_inicio: "71000000", cep_fim: "71999999", taxa_entrega: 15 }],
      produtos: [
        { id: "p1", nome: "Salmão", preco: 50, ativo: true, estoque: 0 },
      ],
    });
    await expect(criarPedidoBase({ ...baseInput })).rejects.toThrow(
      /sem estoque/i,
    );
    expect(state.inserts).toHaveLength(0);
  });

  it("rejeita CEP fora da área de cobertura com mensagem clara", async () => {
    state.supabase = makeSupabaseMock({
      areas: [{ cep_inicio: "71000000", cep_fim: "71999999", taxa_entrega: 15 }],
      produtos: [
        { id: "p1", nome: "Salmão", preco: 50, ativo: true, estoque: 10 },
      ],
    });
    await expect(
      criarPedidoBase({
        ...baseInput,
        endereco: { ...baseInput.endereco, cep: "01000000" },
      }),
    ).rejects.toThrow(/fora da área de cobertura/i);
    expect(state.inserts).toHaveLength(0);
  });

  it("valor_total = soma dos itens + taxa de entrega (múltiplos itens)", async () => {
    state.supabase = makeSupabaseMock({
      areas: [{ cep_inicio: "71000000", cep_fim: "71999999", taxa_entrega: 12.5 }],
      produtos: [
        { id: "p1", nome: "Salmão", preco: 50, ativo: true, estoque: 10 },
        { id: "p2", nome: "Frango", preco: "30.50", ativo: true, estoque: 10 },
      ],
    });

    const result = await criarPedidoBase({
      ...baseInput,
      itens: [
        { produto_id: "p1", quantidade: 2 }, // 100
        { produto_id: "p2", quantidade: 3 }, // 91.50
      ],
    });

    expect(result.subtotal).toBe(191.5);
    expect(result.taxaEntrega).toBe(12.5);
    // Soma exata dos itens + taxa, sem arredondamentos surpresa.
    expect(result.valorTotal).toBe(204);
    expect(result.itensCalc).toHaveLength(2);
  });

  it("suporta taxa de entrega zerada (frete grátis)", async () => {
    state.supabase = makeSupabaseMock({
      areas: [{ cep_inicio: "71000000", cep_fim: "71999999", taxa_entrega: 0 }],
      produtos: [
        { id: "p1", nome: "Salmão", preco: 50, ativo: true, estoque: 10 },
      ],
    });
    const result = await criarPedidoBase({ ...baseInput });
    expect(result.taxaEntrega).toBe(0);
    expect(result.valorTotal).toBe(result.subtotal);
    expect(result.valorTotal).toBe(100);
  });
});
