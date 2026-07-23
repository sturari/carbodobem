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
  cpf: string;
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

type CriarPedidoInput = {
  cliente: ClienteInput;
  endereco: EnderecoInput;
  horario_entrega: string;
  itens: CheckoutItem[];
  observacoes?: string | null;
  user_id?: string;
};

type CriarCheckoutInput = CriarPedidoInput & { origin?: string };

type MercadoPagoPreference = {
  id: string;
  init_point?: string;
  sandbox_init_point?: string;
};

type MercadoPagoPayment = {
  id: number | string;
  status?: string;
  status_detail?: string;
  external_reference?: string;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
      ticket_url?: string;
    };
  };
  date_of_expiration?: string;
};

export type StatusPagamento = "aguardando" | "aprovado" | "pendente" | "recusado";

function normalizarOrigin(origin?: string) {
  if (!origin) return null;
  try {
    const url = new URL(origin);
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

export function getMercadoPagoPublicKey() {
  const prod = process.env.MERCADOPAGO_PUBLIC_KEY_PROD;
  const test = process.env.MERCADOPAGO_PUBLIC_KEY_TEST;
  const key = prod || test;
  if (!key) throw new Error("Mercado Pago public key não configurada.");
  return { publicKey: key, isSandbox: !prod };
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

/**
 * Cria cliente + endereço + pedido + itens no banco.
 * Retorna dados calculados no servidor a partir da tabela `produtos`.
 * Usado por todos os fluxos de pagamento (Checkout Pro, Pix nativo e Cartão).
 */
async function criarPedidoBase(input: CriarPedidoInput) {
  const { supabaseAdmin: supa } = await import("@/integrations/supabase/client.server");
  const { calcularItensPedido } = await import("@/lib/mercadopago-pure");
  const area = await buscarAreaEntrega(supa, input.endereco.cep);
  const taxaEntrega = Number(area.taxa_entrega);
  const produtos = await buscarProdutos(supa, input.itens);

  const calc = calcularItensPedido(produtos, input.itens, taxaEntrega);
  const { itens: itensCalc, subtotal, valorTotal } = calc;

  const { cpf: cpfCliente, ...clienteSemCpf } = input.cliente;
  const { data: clienteRow, error: clienteError } = await supa
    .from("clientes")
    .insert(clienteSemCpf)
    .select("id")
    .single();
  if (clienteError || !clienteRow) {
    throw new Error(clienteError?.message ?? "Falha ao criar cliente.");
  }

  const { data: enderecoRow, error: enderecoError } = await supa
    .from("enderecos")
    .insert({ ...input.endereco, cliente_id: clienteRow.id })
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
      horario_entrega: input.horario_entrega,
      valor_total: valorTotal,
      observacoes: input.observacoes ?? null,
      status: "pendente",
      user_id: input.user_id ?? null,
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

  return {
    pedidoId: pedidoRow.id,
    cpfCliente,
    itensCalc,
    subtotal,
    taxaEntrega,
    valorTotal,
  };
}

function payerFromCliente(cliente: ClienteInput, cpf: string) {
  const partes = cliente.nome.trim().split(/\s+/);
  const first_name = partes.shift() ?? cliente.nome;
  const last_name = partes.join(" ") || first_name;
  const telDigits = cliente.telefone.replace(/\D/g, "");
  const area_code = telDigits.slice(0, 2);
  const number = telDigits.slice(2);
  return {
    first_name,
    last_name,
    email: cliente.email,
    identification: { type: "CPF", number: cpf },
    ...(telDigits ? { phone: { area_code, number } } : {}),
  };
}

/* ============================================================
 * Fluxo 1: Checkout Pro (redirect) — mantido para retrocompat.
 * ============================================================ */
export async function criarCheckoutMercadoPago(data: CriarCheckoutInput) {
  const { accessToken, isSandbox } = getMercadoPagoConfig();
  const publicUrl = getPublicAppUrl(data.origin);

  const base = await criarPedidoBase(data);

  const preferenceBody = {
    items: base.itensCalc.map((item) => ({
      id: item.produto_id,
      title: item.nome,
      quantity: item.quantidade,
      unit_price: item.preco_unitario,
      currency_id: "BRL",
    })),
    payer: {
      name: data.cliente.nome,
      ...payerFromCliente(data.cliente, base.cpfCliente),
    },
    external_reference: base.pedidoId,
    back_urls: {
      success: `${publicUrl}/checkout/sucesso?pedido=${base.pedidoId}`,
      failure: `${publicUrl}/checkout/sucesso?pedido=${base.pedidoId}&status=failure`,
      pending: `${publicUrl}/checkout/sucesso?pedido=${base.pedidoId}&status=pending`,
    },
    auto_return: "approved",
    notification_url: `${publicUrl}/api/public/webhooks/mercadopago`,
    statement_descriptor: "CARBO DO BEM",
    payment_methods: {
      excluded_payment_methods: [],
      excluded_payment_types: [],
      installments: 6,
    },
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
    console.error("[MP] erro criar checkout", preferenceRes.status, text);
    throw new Error("Não foi possível iniciar o pagamento no Mercado Pago.");
  }

  const preference = (await preferenceRes.json()) as MercadoPagoPreference;
  const checkoutUrl = isSandbox ? preference.sandbox_init_point : preference.init_point;
  if (!checkoutUrl) throw new Error("Mercado Pago não retornou a URL de pagamento.");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("pedidos")
    .update({ mercadopago_preference_id: preference.id })
    .eq("id", base.pedidoId);

  enviarEmailConfirmacao({
    pedidoId: base.pedidoId,
    cliente: data.cliente,
    itens: base.itensCalc,
    subtotal: base.subtotal,
    taxaEntrega: base.taxaEntrega,
    valorTotal: base.valorTotal,
    horarioEntrega: data.horario_entrega,
    endereco: data.endereco,
    observacoes: data.observacoes,
  });

  return {
    pedido_id: base.pedidoId,
    preference_id: preference.id,
    checkout_url: checkoutUrl,
    is_sandbox: isSandbox,
    subtotal: base.subtotal,
    taxa_entrega: base.taxaEntrega,
    valor_total: base.valorTotal,
  };
}

/* ============================================================
 * Fluxo 2: Pagamento Pix nativo (QR + copia-e-cola no próprio app).
 * ============================================================ */
export async function criarPagamentoPixMP(data: CriarPedidoInput) {
  const { accessToken } = getMercadoPagoConfig();
  const base = await criarPedidoBase(data);
  const publicUrl = getPublicAppUrl();

  const body = {
    transaction_amount: Number(base.valorTotal.toFixed(2)),
    description: `Pedido ${base.pedidoId}`,
    payment_method_id: "pix",
    external_reference: base.pedidoId,
    notification_url: `${publicUrl}/api/public/webhooks/mercadopago`,
    statement_descriptor: "CARBO DO BEM",
    payer: {
      email: data.cliente.email,
      first_name: payerFromCliente(data.cliente, base.cpfCliente).first_name,
      last_name: payerFromCliente(data.cliente, base.cpfCliente).last_name,
      identification: { type: "CPF", number: base.cpfCliente },
    },
  };

  const res = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "X-Idempotency-Key": `pix-${base.pedidoId}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[MP] erro criar pix", res.status, text);
    throw new Error("Não foi possível gerar o Pix.");
  }

  const payment = (await res.json()) as MercadoPagoPayment;
  const td = payment.point_of_interaction?.transaction_data;
  if (!td?.qr_code) throw new Error("Mercado Pago não retornou o QR do Pix.");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("pedidos")
    .update({ mercadopago_payment_id: String(payment.id) })
    .eq("id", base.pedidoId);

  enviarEmailConfirmacao({
    pedidoId: base.pedidoId,
    cliente: data.cliente,
    itens: base.itensCalc,
    subtotal: base.subtotal,
    taxaEntrega: base.taxaEntrega,
    valorTotal: base.valorTotal,
    horarioEntrega: data.horario_entrega,
    endereco: data.endereco,
    observacoes: data.observacoes,
  });

  return {
    pedido_id: base.pedidoId,
    payment_id: String(payment.id),
    status: mapMercadoPagoStatus(payment.status).pagamentoStatus,
    qr_code: td.qr_code,
    qr_code_base64: td.qr_code_base64 ?? null,
    ticket_url: td.ticket_url ?? null,
    expires_at: payment.date_of_expiration ?? null,
    valor_total: base.valorTotal,
  };
}

/**
 * Reemite um novo pagamento Pix para um pedido pendente já existente.
 * Não cria pedido nem cliente novos — apenas emite outra cobrança Pix
 * usando o mesmo `external_reference` e valor do pedido.
 * Valida email do cliente para prevenir hijack por outro usuário.
 */
export async function regerarPagamentoPixMP(params: {
  pedidoId: string;
  cliente: ClienteInput;
}) {
  const { accessToken } = getMercadoPagoConfig();
  const publicUrl = getPublicAppUrl();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: pedido, error: pedidoErr } = await supabaseAdmin
    .from("pedidos")
    .select("id, status, valor_total, cliente_id, pix_lock_until, clientes(email)")
    .eq("id", params.pedidoId)
    .single();
  if (pedidoErr || !pedido) throw new Error("Pedido não encontrado.");
  if (pedido.status !== "pendente") {
    throw new Error("Este pedido não está mais pendente.");
  }
  const emailPedido = (pedido as { clientes?: { email?: string } | null }).clientes?.email;
  if (!emailPedido || emailPedido.toLowerCase() !== params.cliente.email.toLowerCase()) {
    throw new Error("Pedido não pertence a este cliente.");
  }

  // Lock atômico: só um requester por vez consegue reemitir dentro de 15s.
  // Evita cobranças duplicadas em cliques rápidos ou retries do cliente.
  const nowIso = new Date().toISOString();
  const lockUntilIso = new Date(Date.now() + 15_000).toISOString();
  const { data: locked, error: lockErr } = await supabaseAdmin
    .from("pedidos")
    .update({ pix_lock_until: lockUntilIso })
    .eq("id", params.pedidoId)
    .or(`pix_lock_until.is.null,pix_lock_until.lt.${nowIso}`)
    .select("id");
  if (lockErr) throw new Error(lockErr.message);
  if (!locked || locked.length === 0) {
    throw new Error("Já estamos gerando um novo Pix. Aguarde alguns segundos.");
  }


  const valorTotal = Number(pedido.valor_total);
  const payer = payerFromCliente(params.cliente, params.cliente.cpf);
  const body = {
    transaction_amount: Number(valorTotal.toFixed(2)),
    description: `Pedido ${params.pedidoId}`,
    payment_method_id: "pix",
    external_reference: params.pedidoId,
    notification_url: `${publicUrl}/api/public/webhooks/mercadopago`,
    statement_descriptor: "CARBO DO BEM",
    payer: {
      email: params.cliente.email,
      first_name: payer.first_name,
      last_name: payer.last_name,
      identification: { type: "CPF", number: params.cliente.cpf },
    },
  };

  const res = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      // Idempotency única por reemissão — usa timestamp para permitir múltiplas.
      "X-Idempotency-Key": `pix-${params.pedidoId}-${Date.now()}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[MP] erro reemitir pix", res.status, text);
    throw new Error("Não foi possível gerar um novo Pix.");
  }

  const payment = (await res.json()) as MercadoPagoPayment;
  const td = payment.point_of_interaction?.transaction_data;
  if (!td?.qr_code) throw new Error("Mercado Pago não retornou o QR do Pix.");

  await supabaseAdmin
    .from("pedidos")
    .update({ mercadopago_payment_id: String(payment.id) })
    .eq("id", params.pedidoId);

  return {
    pedido_id: params.pedidoId,
    payment_id: String(payment.id),
    status: mapMercadoPagoStatus(payment.status).pagamentoStatus,
    qr_code: td.qr_code,
    qr_code_base64: td.qr_code_base64 ?? null,
    ticket_url: td.ticket_url ?? null,
    expires_at: payment.date_of_expiration ?? null,
    valor_total: valorTotal,
  };
}

/* ============================================================
 * Fluxo 3: Pagamento com cartão (token gerado no cliente via MP.js).
 * O front tokeniza os dados do cartão localmente com a public key —
 * nenhum PAN/CVV toca nosso servidor.
 * ============================================================ */
export type CartaoInput = {
  token: string;
  payment_method_id: string;
  installments: number;
  issuer_id?: string | null;
};

export async function criarPagamentoCartaoMP(
  data: CriarPedidoInput & { cartao: CartaoInput },
) {
  const { accessToken } = getMercadoPagoConfig();
  const base = await criarPedidoBase(data);
  const publicUrl = getPublicAppUrl();

  // Juros aplicados server-side (fonte da verdade). O cliente só exibe.
  const { totalComJuros, MIN_PARCELAMENTO_BRL, MAX_PARCELAS } = await import(
    "@/lib/parcelamento"
  );
  let installments = Math.min(
    Math.max(1, Math.floor(data.cartao.installments)),
    MAX_PARCELAS,
  );
  if (installments > 1 && base.valorTotal <= MIN_PARCELAMENTO_BRL) {
    installments = 1;
  }
  const valorCobrado = totalComJuros(base.valorTotal, installments);

  const body: Record<string, unknown> = {
    transaction_amount: Number(valorCobrado.toFixed(2)),
    description: `Pedido ${base.pedidoId}`,
    token: data.cartao.token,
    installments,
    payment_method_id: data.cartao.payment_method_id,
    external_reference: base.pedidoId,
    notification_url: `${publicUrl}/api/public/webhooks/mercadopago`,
    statement_descriptor: "CARBO DO BEM",
    payer: {
      email: data.cliente.email,
      identification: { type: "CPF", number: base.cpfCliente },
    },
  };
  if (data.cartao.issuer_id) body.issuer_id = data.cartao.issuer_id;


  const res = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "X-Idempotency-Key": `card-${base.pedidoId}`,
    },
    body: JSON.stringify(body),
  });

  const payment = (await res.json().catch(() => ({}))) as MercadoPagoPayment & {
    message?: string;
  };

  if (!res.ok) {
    console.error("[MP] erro criar cartao", res.status, payment);
    throw new Error(payment.message || "Não foi possível processar o cartão.");
  }

  const { pedidoStatus, pagamentoStatus } = mapMercadoPagoStatus(payment.status);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("pedidos")
    .update({
      status: pedidoStatus,
      mercadopago_payment_id: String(payment.id),
    })
    .eq("id", base.pedidoId);

  enviarEmailConfirmacao({
    pedidoId: base.pedidoId,
    cliente: data.cliente,
    itens: base.itensCalc,
    subtotal: base.subtotal,
    taxaEntrega: base.taxaEntrega,
    valorTotal: base.valorTotal,
    horarioEntrega: data.horario_entrega,
    endereco: data.endereco,
    observacoes: data.observacoes,
  });

  return {
    pedido_id: base.pedidoId,
    payment_id: String(payment.id),
    status: pagamentoStatus,
    status_detail: payment.status_detail ?? null,
    valor_total: base.valorTotal,
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
  userId?: string | null;
}) {
  void (async () => {
    try {
      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
      const trackingUrl = params.userId
        ? null
        : `${getPublicAppUrl()}/pedido/${params.pedidoId}`;
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
          tracking_url: trackingUrl,
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
