/**
 * Testes do rate limiter usado no reenvio de confirmação (5 por 10 min por IP)
 * e da extração da chave de IP a partir dos headers.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

type Row = { key: string; window_start: string; count: number };

const store = new Map<string, Row>();

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => {
      let op: "select" | "upsert" | "update" = "select";
      let payload: any = null;
      let key = "";
      const chain: any = {};
      chain.select = () => {
        op = "select";
        return chain;
      };
      chain.eq = (_c: string, v: string) => {
        key = v;
        if (op === "update") {
          store.set(key, { ...(store.get(key) as Row), ...payload });
          return Promise.resolve({ error: null });
        }
        return chain;
      };
      chain.maybeSingle = async () => ({ data: store.get(key) ?? null, error: null });
      chain.upsert = async (d: any) => {
        store.set(d.key, { key: d.key, window_start: d.window_start, count: d.count });
        return { error: null };
      };
      chain.update = (d: any) => {
        op = "update";
        payload = d;
        return chain;
      };
      return chain;
    },
  },
}));

const OPTS = { key: "reenvio-confirmacao:1.2.3.4", limit: 5, windowSeconds: 600 };

async function limiter() {
  return (await import("@/lib/rate-limit.server")).enforceRateLimit;
}

describe("enforceRateLimit", () => {
  beforeEach(() => {
    store.clear();
    vi.useRealTimers();
  });

  it("permite 5 chamadas e bloqueia a 6ª na mesma janela", async () => {
    const enforce = await limiter();
    for (let i = 0; i < 5; i++) await enforce(OPTS);
    expect(store.get(OPTS.key)!.count).toBe(5);
    await expect(enforce(OPTS)).rejects.toThrow(/Aguarde/i);
  });

  it("libera novamente depois da janela de 10 minutos", async () => {
    const enforce = await limiter();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-21T00:00:00Z"));
    for (let i = 0; i < 5; i++) await enforce(OPTS);
    await expect(enforce(OPTS)).rejects.toThrow();
    vi.setSystemTime(new Date("2026-08-21T00:10:01Z"));
    await expect(enforce(OPTS)).resolves.toBeUndefined();
    expect(store.get(OPTS.key)!.count).toBe(1);
    vi.useRealTimers();
  });

  it("conta separadamente por IP", async () => {
    const enforce = await limiter();
    for (let i = 0; i < 5; i++) await enforce(OPTS);
    await expect(
      enforce({ ...OPTS, key: "reenvio-confirmacao:9.9.9.9" }),
    ).resolves.toBeUndefined();
  });
});

describe("clientKeyFromHeaders", () => {
  const h = (map: Record<string, string>) => ({
    get: (n: string) => map[n] ?? null,
  });

  it("prioriza o primeiro IP de x-forwarded-for", async () => {
    const { clientKeyFromHeaders } = await import("@/lib/rate-limit.server");
    expect(clientKeyFromHeaders(h({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }))).toBe(
      "1.2.3.4",
    );
  });

  it("cai para x-real-ip, cf-connecting-ip e unknown", async () => {
    const { clientKeyFromHeaders } = await import("@/lib/rate-limit.server");
    expect(clientKeyFromHeaders(h({ "x-real-ip": " 2.2.2.2 " }))).toBe("2.2.2.2");
    expect(clientKeyFromHeaders(h({ "cf-connecting-ip": "3.3.3.3" }))).toBe("3.3.3.3");
    expect(clientKeyFromHeaders(h({}))).toBe("unknown");
  });
});
