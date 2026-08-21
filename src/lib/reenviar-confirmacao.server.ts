import { getPublicAppUrl } from "@/lib/mercadopago.server";

/**
 * Reenvia o e-mail de confirmação de um pedido de convidado (sem conta).
 * Segurança: só aceita pedidos com `user_id` NULL e exige que o e-mail
 * informado seja exatamente o e-mail do cliente do pedido — assim o link
 * de rastreio nunca é enviado para um endereço arbitrário.
 */
export type MotivoFalhaEnvio =
  | "suprimido"
  | "dominio_nao_verificado"
  | "envios_desativados"
  | "limite_provedor"
  | "falha_provedor";

export async function reenviarConfirmacaoConvidado(params: {
  pedidoId: string;
  email: string;
}): Promise<{ ok: boolean; motivo?: MotivoFalhaEnvio; mensagem?: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: pedido, error } = await supabaseAdmin
    .from("pedidos")
    .select(
      `
      id, user_id, valor_total, horario_entrega, observacoes,
      clientes:cliente_id ( nome, email ),
      enderecos:endereco_id ( cep, rua, numero, complemento, bairro, cidade, uf ),
      itens_pedido ( quantidade, preco_unitario, produtos:produto_id ( nome ) )
      `,
    )
    .eq("id", params.pedidoId)
    .is("user_id", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!pedido) throw new Error("Pedido não encontrado.");

  const cliente = pedido.clientes as unknown as { nome: string; email: string } | null;
  const emailInformado = params.email.trim().toLowerCase();
  if (!cliente || cliente.email.trim().toLowerCase() !== emailInformado) {
    throw new Error("E-mail não corresponde ao pedido.");
  }

  const itens = ((pedido.itens_pedido ?? []) as Array<{
    quantidade: number;
    preco_unitario: number;
    produtos: { nome: string } | null;
  }>).map((it) => ({
    nome: it.produtos?.nome ?? "Item",
    quantidade: it.quantidade,
    preco_unitario: Number(it.preco_unitario),
  }));

  const subtotal = itens.reduce((s, it) => s + it.quantidade * it.preco_unitario, 0);
  const valorTotal = Number(pedido.valor_total);
  const taxaEntrega = Math.max(0, Number((valorTotal - subtotal).toFixed(2)));

  const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
  const enviar = () =>
    sendTemplateEmail("pedido-confirmado", cliente.email, {
      idempotencyKey: `pedido-confirmado-reenvio-${pedido.id}-${Date.now()}`,
      templateData: {
        nome_cliente: cliente.nome,
        pedido_id: pedido.id,
        itens,
        subtotal,
        taxa_entrega: taxaEntrega,
        valor_total: valorTotal,
        horario_entrega: pedido.horario_entrega,
        endereco: pedido.enderecos,
        observacoes: pedido.observacoes,
        tracking_url: `${getPublicAppUrl()}/pedido/${pedido.id}`,
      },
    });

  try {
    const result = await enviar();
    if (!result.sent) {
      return {
        ok: false,
        motivo: "suprimido",
        mensagem:
          "Este e-mail está bloqueado para novos envios (caixa inexistente, devolução anterior ou descadastro). Fale com o atendimento.",
      };
    }
    return { ok: true };
  } catch (error) {
    const { EmailAPIError } = await import("@lovable.dev/email-js");
    if (error instanceof EmailAPIError) {
      console.error("[reenvio-confirmacao] falha no provedor", {
        pedido: pedido.id,
        code: error.code,
        status: error.status,
      });
      if (error.code === "domain_not_verified") {
        return {
          ok: false,
          motivo: "dominio_nao_verificado",
          mensagem:
            "Nosso remetente de e-mail está em verificação. Use este link para acompanhar o pedido — ele continua válido.",
        };
      }
      if (error.code === "emails_disabled") {
        return {
          ok: false,
          motivo: "envios_desativados",
          mensagem:
            "O envio de e-mails está temporariamente desativado. Use este link para acompanhar o pedido.",
        };
      }
      if (error.status === 429) {
        const espera = error.retryAfterSeconds ?? 60;
        return {
          ok: false,
          motivo: "limite_provedor",
          mensagem: `Estamos com muitos envios agora. Tente novamente em ${espera}s.`,
        };
      }
      return {
        ok: false,
        motivo: "falha_provedor",
        mensagem:
          "Não conseguimos enviar o e-mail agora. Tente novamente em alguns minutos ou fale com o atendimento.",
      };
    }
    console.error("[reenvio-confirmacao] erro inesperado", error);
    return {
      ok: false,
      motivo: "falha_provedor",
      mensagem:
        "Não conseguimos enviar o e-mail agora. Tente novamente em alguns minutos.",
    };
  }
}
