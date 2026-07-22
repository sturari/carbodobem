import { describe, expect, it } from "vitest";
import { createHmac } from "crypto";
import {
  calcularItensPedido,
  verifyMercadoPagoSignature,
  type ProdutoLite,
} from "../mercadopago-pure";

const produtos: ProdutoLite[] = [
  { id: "a", nome: "Salmão", preco: 50, ativo: true, estoque: 5 },
  { id: "b", nome: "Frango", preco: "30.5", ativo: true, estoque: 2 },
  { id: "c", nome: "Inativo", preco: 10, ativo: false, estoque: 10 },
  { id: "d", nome: "Sem estoque", preco: 10, ativo: true, estoque: 0 },
];

describe("calcularItensPedido", () => {
  it("calcula subtotal e total com taxa", () => {
    const r = calcularItensPedido(
      produtos,
      [
        { produto_id: "a", quantidade: 2 },
        { produto_id: "b", quantidade: 1 },
      ],
      15,
    );
    expect(r.subtotal).toBe(130.5);
    expect(r.valorTotal).toBe(145.5);
    expect(r.itens).toHaveLength(2);
    expect(r.itens[0].preco_unitario).toBe(50);
  });

  it("rejeita produto inativo", () => {
    expect(() =>
      calcularItensPedido(produtos, [{ produto_id: "c", quantidade: 1 }], 0),
    ).toThrow(/indisponível/i);
  });

  it("rejeita produto sem estoque", () => {
    expect(() =>
      calcularItensPedido(produtos, [{ produto_id: "d", quantidade: 1 }], 0),
    ).toThrow(/sem estoque/i);
  });

  it("rejeita quantidade acima do estoque", () => {
    expect(() =>
      calcularItensPedido(produtos, [{ produto_id: "b", quantidade: 5 }], 0),
    ).toThrow(/estoque insuficiente/i);
  });

  it("rejeita produto inexistente", () => {
    expect(() =>
      calcularItensPedido(produtos, [{ produto_id: "zzz", quantidade: 1 }], 0),
    ).toThrow(/inválido/i);
  });

  it("rejeita quantidade zero/negativa/fracionária", () => {
    expect(() =>
      calcularItensPedido(produtos, [{ produto_id: "a", quantidade: 0 }], 0),
    ).toThrow();
    expect(() =>
      calcularItensPedido(produtos, [{ produto_id: "a", quantidade: -1 }], 0),
    ).toThrow();
    expect(() =>
      calcularItensPedido(produtos, [{ produto_id: "a", quantidade: 1.5 }], 0),
    ).toThrow();
  });

  it("rejeita taxa negativa", () => {
    expect(() =>
      calcularItensPedido(produtos, [{ produto_id: "a", quantidade: 1 }], -1),
    ).toThrow(/taxa/i);
  });

  it("rejeita pedido vazio", () => {
    expect(() => calcularItensPedido(produtos, [], 0)).toThrow(/sem itens/i);
  });
});

describe("verifyMercadoPagoSignature", () => {
  const secret = "test-secret";
  const dataId = "1234567890";
  const requestId = "req-abc";
  const ts = "1700000000";
  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const v1 = createHmac("sha256", secret).update(manifest).digest("hex");
  const header = `ts=${ts},v1=${v1}`;

  it("aceita assinatura válida", () => {
    expect(
      verifyMercadoPagoSignature({ signatureHeader: header, requestId, dataId, secret }),
    ).toBe(true);
  });

  it("rejeita v1 adulterado", () => {
    const bad = header.replace(v1, "0".repeat(v1.length));
    expect(
      verifyMercadoPagoSignature({ signatureHeader: bad, requestId, dataId, secret }),
    ).toBe(false);
  });

  it("rejeita quando dataId difere", () => {
    expect(
      verifyMercadoPagoSignature({
        signatureHeader: header,
        requestId,
        dataId: "outro",
        secret,
      }),
    ).toBe(false);
  });

  it("rejeita quando requestId difere", () => {
    expect(
      verifyMercadoPagoSignature({
        signatureHeader: header,
        requestId: "outro",
        dataId,
        secret,
      }),
    ).toBe(false);
  });

  it("rejeita header ausente/malformado", () => {
    expect(
      verifyMercadoPagoSignature({ signatureHeader: null, requestId, dataId, secret }),
    ).toBe(false);
    expect(
      verifyMercadoPagoSignature({ signatureHeader: "abc", requestId, dataId, secret }),
    ).toBe(false);
    expect(
      verifyMercadoPagoSignature({
        signatureHeader: "ts=1,v1=",
        requestId,
        dataId,
        secret,
      }),
    ).toBe(false);
  });

  it("rejeita v1 com tamanho diferente (evita crash timingSafeEqual)", () => {
    expect(
      verifyMercadoPagoSignature({
        signatureHeader: `ts=${ts},v1=abcd`,
        requestId,
        dataId,
        secret,
      }),
    ).toBe(false);
  });

  it("rejeita quando falta secret ou dataId", () => {
    expect(
      verifyMercadoPagoSignature({
        signatureHeader: header,
        requestId,
        dataId: null,
        secret,
      }),
    ).toBe(false);
    expect(
      verifyMercadoPagoSignature({
        signatureHeader: header,
        requestId,
        dataId,
        secret: "",
      }),
    ).toBe(false);
  });
});
