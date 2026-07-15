import type { Database } from "@/integrations/supabase/types";

type SupabaseAdmin = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

type ProdutoRow = Pick<
  Database["public"]["Tables"]["produtos"]["Row"],
  "id" | "nome" | "preco" | "ativo" | "estoque"
>;

type CheckoutItem = {
  produto_id: string;
  quantidade: number;
};

type ClienteInput = {
  nome: string;
  telefone: string;
  email: string;
};

type EnderecoInput = {
  cep: string;
  rua: string;
  numero: string;
  complemento?: string | null;
  bairro: string;
  cidade: string;
  uf: string;
};

type CriarCheckoutInput = {
  cliente: ClienteInput;
  endereco: EnderecoInput;
  horario_entrega: string;
  itens: CheckoutItem[];
  observacoes?: string | null;
  origin?: string;
  user_id?: string;
};


type MercadoPagoPreference = {
  id: string;
  init_point?: string;
  sandbox_init_point?: string;
};

type MercadoPagoPayment = {
  id: number | string;
  status?: string;
  external_reference?: string;
};

export type StatusPagamento = "aguardando" | "aprovado" | "pendente" | "recusado";

function normalizarOrigin(origin?: string) {
  if (!origin) return null;
  try {
    const url = new URL(origin);
    // O Mercado Pago não aceita localhost/http em back_urls quando auto_return
    // está ativo. Só usamos origens públicas HTTPS; no dev local caímos no
    // domínio estável do preview.
    if (url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function getPublicAppUrl(origin?: string) {
  const envUrl = process.env.PUBLIC_APP_URL;
  if (envUrl) return envUrl.replace(/\/$/, "");

  const safeOrigin = normalizarOrigin(origin);
  if (safeOrigin) return safeOrigin;

  return "https://project--58f6f86b-1d2b-449d-b777-7408cba43a69.lovable.app";
}

export function getMercadoPagoConfig() {
  const prodToken = process.env.MERCADOPAGO_ACCESS_TOKEN_PROD;
  const testToken = process.env.MERCADOPAGO_ACCESS_TOKEN_TEST;
  const accessToken = prodToken || testToken;
  if (!accessToken) throw new Error("Mercado Pago não configurado.");

  const isSandbox = !prodToken;
  return { accessToken, isSandbox };
}

export function mapMercadoPagoStatus(mpStatus?: string): {
  pedidoStatus: "pendente" | "pagamento_confirmado" | "cancelado";
  pagamentoStatus: StatusPagamento;
} {
  switch (mpStatus) {
    case "approved":
      return { pedidoStatus: "pagamento_confirmado", pagamentoStatus: "aprovado" };
    case "rejected":
    case "cancelled":
    case "refunded":
    case "charged_back":
      return { pedidoStatus: "cancelado", pagamentoStatus: "recusado" };
    case "pending":
    case "in_process":
    case "authorized":
      return { pedidoStatus: "pendente", pagamentoStatus: "pendente" };
    default:
      return { pedidoStatus: "pendente", pagamentoStatus: "aguardando" };
  }
}


async function buscarAreaEntrega(supa: SupabaseAdmin, cep: string) {
  const { data: areas, error } = await supa
    .from("areas_cobertura")
    .select("cep_inicio, cep_fim, taxa_entrega")
    .eq("ativo", true);
  if (error) throw new Error(error.message);

  const area = (areas ?? []).find((a) => cep >= a.cep_inicio && cep <= a.cep_fim);
  if (!area) throw new Error("CEP fora da área de cobertura.");
  return area;
}

async function buscarProdutos(supa: SupabaseAdmin, itens: CheckoutItem[]) {
  const ids = itens.map((i) => i.produto_id);
  const idsUnicos = [...new Set(ids)];

  const { data: produtos, error } = await supa
    .from("produtos")
    .select("id, nome, preco, ativo, estoque")
    .in("id", idsUnicos);
  if (error) throw new Error(error.message);
  if (!produtos || produtos.length !== idsUnicos.length) {
    throw new Error("Produto inválido no pedido.");
  }

  return produtos as ProdutoRow[];
}


export async function criarCheckoutMercadoPago(data: CriarCheckoutInput) {
  const { supabaseAdmin: supa } = await import("@/integrations/supabase/client.server");
  const { accessToken, isSandbox } = getMercadoPagoConfig();
  const publicUrl = getPublicAppUrl(data.origin);

  const area = await buscarAreaEntrega(supa, data.endereco.cep);
  const taxaEntrega = Number(area.taxa_entrega);
  const produtos = await buscarProdutos(supa, data.itens);

  let subtotal = 0;
  const itensCalc = data.itens.map((item) => {
    const produto = produtos.find((p) => p.id === item.produto_id);
    if (!produto) throw new Error("Produto inválido no pedido.");
    if (!produto.ativo) throw new Error(`Produto indisponível: ${produto.nome}`);
    if (produto.estoque <= 0) {
      throw new Error(`Produto sem estoque: ${produto.nome}`);
    }
    if (item.quantidade > produto.estoque) {
      throw new Error(
        `Estoque insuficiente para ${produto.nome} (disponível: ${produto.estoque}).`,
      );
    }
    const preco = Number(produto.preco);
    subtotal += preco * item.quantidade;
    return {
      produto_id: produto.id,
      nome: produto.nome,
      quantidade: item.quantidade,
      preco_unitario: preco,
    };
  });

  const valorTotal = subtotal + taxaEntrega;

  const { data: clienteRow, error: clienteError } = await supa
    .from("clientes")
    .insert(data.cliente)
    .select("id")
    .single();
  if (clienteError || !clienteRow) {
    throw new Error(clienteError?.message ?? "Falha ao criar cliente.");
  }

  const { data: enderecoRow, error: enderecoError } = await supa
    .from("enderecos")
    .insert({ ...data.endereco, cliente_id: clienteRow.id })
    .select("id")
    .single();
  if (enderecoError || !enderecoRow) {
    throw new Error(enderecoError?.message ?? "Falha ao criar endereço.");
  }

  const { data: pedidoRow, error: pedidoError } = await supa
    .from("pedidos")
    .insert({
      cliente_id: clienteRow.id,
      endereco_id: enderecoRow.id,
      horario_entrega: data.horario_entrega,
      valor_total: valorTotal,
      observacoes: data.observacoes ?? null,
      status: "pendente",
      user_id: data.user_id ?? null,
    })
    .select("id")
    .single();
  if (pedidoError || !pedidoRow) {
    throw new Error(pedidoError?.message ?? "Falha ao criar pedido.");
  }


  const { error: itensError } = await supa.from("itens_pedido").insert(
    itensCalc.map((item) => ({
      pedido_id: pedidoRow.id,
      produto_id: item.produto_id,
      quantidade: item.quantidade,
      preco_unitario: item.preco_unitario,
    })),
  );
  if (itensError) throw new Error(itensError.message);

  const preferenceBody = {
    items: itensCalc.map((item) => ({
      id: item.produto_id,
      title: item.nome,
      quantity: item.quantidade,
      unit_price: item.preco_unitario,
      currency_id: "BRL",
    })),
    payer: {
      name: data.cliente.nome,
      email: data.cliente.email,
      ...(data.cliente.telefone ? { phone: { number: data.cliente.telefone } } : {}),
    },
    external_reference: pedidoRow.id,
    back_urls: {
      success: `${publicUrl}/checkout/sucesso?pedido=${pedidoRow.id}`,
      failure: `${publicUrl}/checkout/sucesso?pedido=${pedidoRow.id}&status=failure`,
      pending: `${publicUrl}/checkout/sucesso?pedido=${pedidoRow.id}&status=pending`,
    },
    auto_return: "approved",
    notification_url: `${publicUrl}/api/public/webhooks/mercadopago`,
    statement_descriptor: "CARBO DO BEM",
  };

  const preferenceRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(preferenceBody),
  });

  if (!preferenceRes.ok) {
    const text = await preferenceRes.text().catch(() => "");
    console.error("[MP] erro criar checkout", preferenceRes.status, text, {
      success: preferenceBody.back_urls.success,
      failure: preferenceBody.back_urls.failure,
      pending: preferenceBody.back_urls.pending,
      notification_url: preferenceBody.notification_url,
    });
    throw new Error("Não foi possível iniciar o pagamento no Mercado Pago.");
  }

  const preference = (await preferenceRes.json()) as MercadoPagoPreference;
  const checkoutUrl = isSandbox ? preference.sandbox_init_point : preference.init_point;
  if (!checkoutUrl) throw new Error("Mercado Pago não retornou a URL de pagamento.");

  const { error: updateError } = await supa
    .from("pedidos")
    .update({ mercadopago_preference_id: preference.id })
    .eq("id", pedidoRow.id);
  if (updateError) console.error("[MP] falha ao salvar preference_id", updateError);

  enviarEmailConfirmacao({
    pedidoId: pedidoRow.id,
    cliente: data.cliente,
    itens: itensCalc,
    subtotal,
    taxaEntrega,
    valorTotal,
    horarioEntrega: data.horario_entrega,
    endereco: data.endereco,
    observacoes: data.observacoes,
  });

  return {
    pedido_id: pedidoRow.id,
    preference_id: preference.id,
    checkout_url: checkoutUrl,
    is_sandbox: isSandbox,
    subtotal,
    taxa_entrega: taxaEntrega,
    valor_total: valorTotal,
  };
}

function enviarEmailConfirmacao(params: {
  pedidoId: string;
  cliente: ClienteInput;
  itens: Array<{ nome: string; quantidade: number; preco_unitario: number }>;
  subtotal: number;
  taxaEntrega: number;
  valorTotal: number;
  horarioEntrega: string;
  endereco: EnderecoInput;
  observacoes?: string | null;
}) {
  void (async () => {
    try {
      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
      await sendTemplateEmail("pedido-confirmado", params.cliente.email, {
        idempotencyKey: `pedido-confirmado-${params.pedidoId}`,
        templateData: {
          nome_cliente: params.cliente.nome,
          pedido_id: params.pedidoId,
          itens: params.itens,
          subtotal: params.subtotal,
          taxa_entrega: params.taxaEntrega,
          valor_total: params.valorTotal,
          horario_entrega: params.horarioEntrega,
          endereco: params.endereco,
          observacoes: params.observacoes,
        },
      });
    } catch (error) {
      console.error("[pedido] falha ao enviar email de confirmação", error);
    }
  })();
}

export async function consultarPagamentoMercadoPago(paymentId: string) {
  const { accessToken } = getMercadoPagoConfig();
  const payRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!payRes.ok) {
    const text = await payRes.text().catch(() => "");
    console.error("[MP] erro ao consultar pagamento", payRes.status, text);
    throw new Error("Não foi possível consultar o pagamento.");
  }

  return (await payRes.json()) as MercadoPagoPayment;
}

export async function sincronizarPagamentoPedido(params: {
  pedidoId?: string;
  paymentId?: string;
}) {
  if (!params.paymentId) {
    return {
      pedido_id: params.pedidoId ?? null,
      payment_id: null,
      status: "aguardando" as StatusPagamento,
    };
  }

  const payment = await consultarPagamentoMercadoPago(params.paymentId);
  const pedidoId = payment.external_reference || params.pedidoId;
  if (!pedidoId) {
    return {
      pedido_id: null,
      payment_id: String(payment.id),
      status: mapMercadoPagoStatus(payment.status).pagamentoStatus,
    };
  }

  const { pedidoStatus, pagamentoStatus } = mapMercadoPagoStatus(payment.status);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("pedidos")
    .update({
      status: pedidoStatus,
      mercadopago_payment_id: String(payment.id),
    })
    .eq("id", pedidoId);

  if (error) throw new Error(error.message);

  return {
    pedido_id: pedidoId,
    payment_id: String(payment.id),
    status: pagamentoStatus,
  };
}
