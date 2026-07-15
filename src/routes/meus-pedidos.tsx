import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Loader2, PackageSearch } from "lucide-react";
import { Header } from "@/components/Header";
import { CarrinhoDrawer } from "@/components/CarrinhoDrawer";
import { supabase } from "@/integrations/supabase/client";
import { listarMeusPedidos } from "@/lib/pedidos-cliente.functions";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/meus-pedidos")({
  head: () => ({
    meta: [
      { title: "Meus pedidos — Carbo do Bem" },
      { name: "description", content: "Acompanhe o status dos seus pedidos na Carbo do Bem." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: MeusPedidosPage,
});

const STATUS_LABEL: Record<string, string> = {
  pendente: "Aguardando pagamento",
  pagamento_confirmado: "Pagamento confirmado",
  em_preparo: "Em preparo",
  saiu_para_entrega: "Saiu para entrega",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

const STATUS_CLASS: Record<string, string> = {
  pendente: "bg-muted text-muted-foreground",
  pagamento_confirmado: "bg-cold/15 text-cold",
  em_preparo: "bg-warm/15 text-warm",
  saiu_para_entrega: "bg-primary/15 text-primary",
  entregue: "bg-primary text-primary-foreground",
  cancelado: "bg-destructive/15 text-destructive",
};

const FLUXO = [
  "pendente",
  "pagamento_confirmado",
  "em_preparo",
  "saiu_para_entrega",
  "entregue",
] as const;

function BarraProgresso({ status }: { status: string }) {
  if (status === "cancelado") {
    return (
      <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
        Pedido cancelado
      </div>
    );
  }
  const idx = FLUXO.indexOf(status as (typeof FLUXO)[number]);
  return (
    <ol className="flex flex-wrap items-center gap-1 text-[11px]">
      {FLUXO.map((s, i) => {
        const done = idx >= 0 && i <= idx;
        return (
          <li key={s} className="flex items-center gap-1">
            <span
              className={`flex h-6 min-w-6 items-center justify-center rounded-full px-2 font-semibold ${
                done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}
            </span>
            <span className={done ? "font-semibold" : "text-muted-foreground"}>
              {STATUS_LABEL[s]}
            </span>
            {i < FLUXO.length - 1 && <span className="text-muted-foreground">›</span>}
          </li>
        );
      })}
    </ol>
  );
}

function MeusPedidosPage() {
  const navigate = useNavigate();
  const [authChecked, setAuthChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate({ to: "/auth", search: { redirect: "/meus-pedidos" } });
        return;
      }
      setSignedIn(true);
      setAuthChecked(true);
    });
  }, [navigate]);

  const fetchPedidos = useServerFn(listarMeusPedidos);
  const pedidosQ = useQuery({
    queryKey: ["meus-pedidos"],
    queryFn: () => fetchPedidos(),
    enabled: signedIn,
  });

  if (!authChecked) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <CarrinhoDrawer />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold">Meus pedidos</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe aqui o status e o histórico dos seus pedidos.
          </p>
        </div>

        {pedidosQ.isLoading && (
          <div className="rounded-2xl border border-border/70 bg-card p-8 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-primary" />
            Carregando pedidos...
          </div>
        )}

        {pedidosQ.error && (
          <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            {(pedidosQ.error as Error).message}
          </div>
        )}

        {pedidosQ.data && pedidosQ.data.length === 0 && (
          <div className="rounded-2xl border border-border/70 bg-card p-10 text-center">
            <PackageSearch className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Você ainda não tem pedidos por aqui.
            </p>
            <Link
              to="/"
              className="mt-4 inline-block rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              Fazer meu primeiro pedido
            </Link>
          </div>
        )}

        <div className="space-y-4">
          {(pedidosQ.data ?? []).map((p: any) => {
            const cls = STATUS_CLASS[p.status] ?? "bg-muted text-muted-foreground";
            return (
              <article
                key={p.id}
                className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm"
              >
                <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Pedido #{p.id.slice(0, 8).toUpperCase()} •{" "}
                      {new Date(p.created_at).toLocaleString("pt-BR")}
                    </p>
                    <p className="mt-1 font-display text-lg font-bold text-warm">
                      {formatBRL(Number(p.valor_total))}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Entrega prevista:{" "}
                      {new Date(p.horario_entrega).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${cls}`}
                  >
                    {STATUS_LABEL[p.status] ?? p.status}
                  </span>
                </header>

                <div className="mb-3">
                  <BarraProgresso status={p.status} />
                </div>

                <ul className="mb-3 space-y-1 text-sm">
                  {(p.itens_pedido ?? []).map((it: any, i: number) => (
                    <li key={i} className="flex justify-between gap-3">
                      <span className="text-muted-foreground">
                        {it.quantidade}× {it.produtos?.nome ?? "Item"}
                      </span>
                      <span>{formatBRL(Number(it.preco_unitario) * it.quantidade)}</span>
                    </li>
                  ))}
                </ul>

                {p.enderecos && (
                  <p className="text-xs text-muted-foreground">
                    Entrega em {p.enderecos.rua}, {p.enderecos.numero}
                    {p.enderecos.complemento ? ` — ${p.enderecos.complemento}` : ""} •{" "}
                    {p.enderecos.bairro} • CEP {p.enderecos.cep}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      </main>
    </div>
  );
}
