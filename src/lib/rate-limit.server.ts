/**
 * Rate limiter simples backed by Postgres.
 *
 * Nota: o backend não tem primitivo padronizado de rate limiting; este é um
 * limitador ad-hoc, best-effort, para reduzir abuso nos endpoints de
 * pagamento. Não substitui um WAF/edge rate limiter.
 *
 * Estratégia: janela fixa por chave (ex.: IP + rota). Um upsert incrementa
 * o contador; se a janela expirou, reseta. Se estourar o limite, lança.
 */
type SupabaseAdmin = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

export type RateLimitOptions = {
  key: string;
  limit: number;
  windowSeconds: number;
};

export async function enforceRateLimit(opts: RateLimitOptions): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const supa: SupabaseAdmin = supabaseAdmin;
  const now = new Date();
  const windowMs = opts.windowSeconds * 1000;

  const { data: row } = await supa
    .from("rate_limits")
    // @ts-expect-error - tabela existe na migration mais recente
    .select("key, window_start, count")
    .eq("key", opts.key)
    .maybeSingle();

  const currentStart = row ? new Date((row as { window_start: string }).window_start).getTime() : 0;
  const expired = !row || now.getTime() - currentStart > windowMs;

  if (expired) {
    await supa
      // @ts-expect-error - tabela existe na migration mais recente
      .from("rate_limits")
      .upsert(
        {
          key: opts.key,
          window_start: now.toISOString(),
          count: 1,
          updated_at: now.toISOString(),
        },
        { onConflict: "key" },
      );
    return;
  }

  const nextCount = ((row as { count: number }).count ?? 0) + 1;
  if (nextCount > opts.limit) {
    const retryInSec = Math.max(
      1,
      Math.ceil((currentStart + windowMs - now.getTime()) / 1000),
    );
    throw new Error(
      `Muitas tentativas de pagamento. Aguarde ${retryInSec}s e tente novamente.`,
    );
  }

  await supa
    // @ts-expect-error - tabela existe na migration mais recente
    .from("rate_limits")
    .update({ count: nextCount, updated_at: now.toISOString() })
    .eq("key", opts.key);
}

/** Extrai um identificador estável do chamador (IP) para chavear o limite. */
export function clientKeyFromHeaders(headers: {
  get(name: string): string | null | undefined;
}): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  const cf = headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  return "unknown";
}
