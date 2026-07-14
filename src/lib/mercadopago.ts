/**
 * Cliente Mercado Pago (Checkout Pro) — STUB.
 * Ativação real: instalar `mercadopago` SDK ou usar fetch direto contra
 * https://api.mercadopago.com/checkout/preferences com Bearer <access_token>.
 */
export type PreferenceItem = {
  id: string;
  title: string;
  quantity: number;
  unit_price: number;
  currency_id?: "BRL";
};

export type CreatePreferenceInput = {
  items: PreferenceItem[];
  payer: { name: string; email: string; phone?: string };
  external_reference: string; // pedido_id
  back_urls?: { success?: string; failure?: string; pending?: string };
  notification_url?: string;
};

export type CreatePreferenceResult = {
  id: string;
  init_point: string;
  sandbox_init_point: string;
};
