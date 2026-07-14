import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const criarPedidoSchema = z.object({
  cliente: z.object({
    nome: z.string().min(2),
    telefone: z.string().min(10),
    email: z.string().email(),
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
});

export const criarPedido = createServerFn({ method: "POST" })
  .inputValidator((raw) => criarPedidoSchema.parse(raw))
  .handler(async ({ data }) => {
    // Checkout anônimo confiável: validamos CEP e preços pelo banco.
    // Usa supabaseAdmin (service role) para escrever sem depender de
    // políticas SELECT (o retorno .select() após insert exigiria SELECT
    // ao anon, o que expõe dados de outros clientes).
    const { supabaseAdmin: supa } = await import(
      "@/integrations/supabase/client.server"
    );

    // 1) valida cobertura
    const { data: areas, error: areasErr } = await supa
      .from("areas_cobertura")
      .select("cep_inicio, cep_fim, taxa_entrega")
      .eq("ativo", true);
    if (areasErr) throw new Error(areasErr.message);
    const area = (areas ?? []).find(
      (a) => data.endereco.cep >= a.cep_inicio && data.endereco.cep <= a.cep_fim,
    );
    if (!area) throw new Error("CEP fora da área de cobertura.");
    const taxa = Number(area.taxa_entrega);

    // 2) busca preços atuais dos produtos
    const ids = data.itens.map((i) => i.produto_id);
    const { data: produtos, error: prodErr } = await supa
      .from("produtos")
      .select("id, nome, preco, estoque, ativo")
      .in("id", ids);
    if (prodErr) throw new Error(prodErr.message);
    if (!produtos || produtos.length !== ids.length)
      throw new Error("Produto inválido no pedido.");

    let subtotal = 0;
    const itensCalc = data.itens.map((it) => {
      const p = produtos.find((x) => x.id === it.produto_id)!;
      if (!p.ativo) throw new Error(`Produto indisponível: ${p.nome}`);
      const preco = Number(p.preco);
      subtotal += preco * it.quantidade;
      return { produto_id: p.id, quantidade: it.quantidade, preco_unitario: preco };
    });
    const valor_total = subtotal + taxa;

    // 3) cria cliente
    const { data: clienteRow, error: clErr } = await supa
      .from("clientes")
      .insert(data.cliente)
      .select("id")
      .single();
    if (clErr || !clienteRow) throw new Error(clErr?.message ?? "Falha ao criar cliente");

    // 4) cria endereço
    const { data: endRow, error: endErr } = await supa
      .from("enderecos")
      .insert({ ...data.endereco, cliente_id: clienteRow.id })
      .select("id")
      .single();
    if (endErr || !endRow) throw new Error(endErr?.message ?? "Falha ao criar endereço");

    // 5) cria pedido
    const { data: pedidoRow, error: pedErr } = await supa
      .from("pedidos")
      .insert({
        cliente_id: clienteRow.id,
        endereco_id: endRow.id,
        horario_entrega: data.horario_entrega,
        valor_total,
        observacoes: data.observacoes ?? null,
      })
      .select("id")
      .single();
    if (pedErr || !pedidoRow) throw new Error(pedErr?.message ?? "Falha ao criar pedido");

    // 6) cria itens
    const { error: itErr } = await supa
      .from("itens_pedido")
      .insert(itensCalc.map((i) => ({ ...i, pedido_id: pedidoRow.id })));
    if (itErr) throw new Error(itErr.message);

    return {
      pedido_id: pedidoRow.id,
      subtotal,
      taxa_entrega: taxa,
      valor_total,
    };
  });
