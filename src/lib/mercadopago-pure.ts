/**
 * Helpers puros do Mercado Pago (sem I/O), extraídos para permitir testes
 * unitários rápidos sem depender de banco/rede.
 */
import { createHmac, timingSafeEqual } from "crypto";

export type ProdutoLite = {
  id: string;
  nome: string;
  preco: number | string;
  ativo: boolean;
  estoque: number;
};

export type ItemInput = { produto_id: string; quantidade: number };

export type ItemCalculado = {
  produto_id: string;
  nome: string;
  quantidade: number;
  preco_unitario: number;
};

export type CalculoPedido = {
  itens: ItemCalculado[];
  subtotal: number;
  taxaEntrega: number;
  valorTotal: number;
};

/**
 * Valida estoque/ativação e calcula subtotal + total.
 * Fonte da verdade dos preços: parâmetro `produtos` (vindo do banco).
 * Lança Error com mensagem em pt-BR quando inválido.
 */
export function calcularItensPedido(
  produtos: ProdutoLite[],
  itens: ItemInput[],
  taxaEntrega: number,
): CalculoPedido {
  if (!itens.length) throw new Error("Pedido sem itens.");
  if (!(taxaEntrega >= 0)) throw new Error("Taxa de entrega inválida.");

  let subtotal = 0;
  const calc = itens.map((item) => {
    if (!(item.quantidade > 0) || !Number.isInteger(item.quantidade)) {
      throw new Error("Quantidade inválida.");
    }
    const produto = produtos.find((p) => p.id === item.produto_id);
    if (!produto) throw new Error("Produto inválido no pedido.");
    if (!produto.ativo) throw new Error(`Produto indisponível: ${produto.nome}`);
    if (produto.estoque <= 0) throw new Error(`Produto sem estoque: ${produto.nome}`);
    if (item.quantidade > produto.estoque) {
      throw new Error(
        `Estoque insuficiente para ${produto.nome} (disponível: ${produto.estoque}).`,
      );
    }
    const preco = Number(produto.preco);
    if (!Number.isFinite(preco) || preco < 0) {
      throw new Error(`Preço inválido para ${produto.nome}.`);
    }
    subtotal += preco * item.quantidade;
    return {
      produto_id: produto.id,
      nome: produto.nome,
      quantidade: item.quantidade,
      preco_unitario: preco,
    };
  });

  const valorTotal = Number((subtotal + taxaEntrega).toFixed(2));
  return { itens: calc, subtotal: Number(subtotal.toFixed(2)), taxaEntrega, valorTotal };
}

/**
 * Valida assinatura HMAC-SHA256 enviada pelo Mercado Pago em `x-signature`.
 * Formato do header: "ts=1699999999,v1=<hex>".
 * Manifest oficial: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 */
export function verifyMercadoPagoSignature(params: {
  signatureHeader: string | null;
  requestId: string | null;
  dataId: string | null;
  secret: string;
}): boolean {
  const { signatureHeader, requestId, dataId, secret } = params;
  if (!signatureHeader || !dataId || !secret) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k?.trim(), v?.trim()];
    }),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${requestId ?? ""};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");

  try {
    const a = Buffer.from(v1, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length === 0 || a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
