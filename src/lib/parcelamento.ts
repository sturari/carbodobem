// Regras de parcelamento no cartão de crédito.
// Compartilhado entre cliente (exibição) e servidor (cobrança real).

/** Valor mínimo do pedido para liberar parcelamento (2x ou mais). */
export const MIN_PARCELAMENTO_BRL = 200;

/** Número máximo de parcelas oferecidas. */
export const MAX_PARCELAS = 6;

/**
 * Taxa de juros ao mês aplicada a partir de 2x.
 * ~2.99% a.m. — valor de mercado praticado por adquirentes (Mercado Pago,
 * Cielo, Stone) para parcelamento com juros repassados ao consumidor.
 */
export const JUROS_MES = 0.0299;

export type OpcaoParcela = {
  n: number;
  valorParcela: number;
  total: number;
  temJuros: boolean;
};

/**
 * Calcula as opções de parcelamento para um dado valor total.
 * - 1x: sempre disponível, sem juros.
 * - 2x..MAX: só liberadas se o valor for maior que MIN_PARCELAMENTO_BRL,
 *   e cada parcela recebe juros pelo modelo Price.
 */
export function calcularOpcoesParcelas(valorTotal: number): OpcaoParcela[] {
  const opcoes: OpcaoParcela[] = [
    { n: 1, valorParcela: round2(valorTotal), total: round2(valorTotal), temJuros: false },
  ];
  if (valorTotal <= MIN_PARCELAMENTO_BRL) return opcoes;

  for (let n = 2; n <= MAX_PARCELAS; n++) {
    const parcela = pricePayment(valorTotal, JUROS_MES, n);
    const total = round2(parcela * n);
    opcoes.push({ n, valorParcela: round2(parcela), total, temJuros: true });
  }
  return opcoes;
}

/** Devolve o valor total efetivamente cobrado do cliente para N parcelas. */
export function totalComJuros(valorTotal: number, n: number): number {
  if (n <= 1) return round2(valorTotal);
  if (valorTotal <= MIN_PARCELAMENTO_BRL) return round2(valorTotal);
  const nClamped = Math.min(Math.max(1, Math.floor(n)), MAX_PARCELAS);
  const parcela = pricePayment(valorTotal, JUROS_MES, nClamped);
  return round2(parcela * nClamped);
}

function pricePayment(pv: number, i: number, n: number): number {
  return (pv * i) / (1 - Math.pow(1 + i, -n));
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
