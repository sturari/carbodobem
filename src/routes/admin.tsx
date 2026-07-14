import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  atualizarStatusPedido,
  listarPedidosAdmin,
  verificarAdmin,
} from "@/lib/admin.functions";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Pedidos" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
});

const STATUS_OPTIONS = [
  "pendente",
  "em_preparo",
  "saiu_para_entrega",
  "entregue",
  "cancelado",
] as const;

type StatusPedido = (typeof STATUS_OPTIONS)[number];

function AdminPage() {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);
  const [authorized, setAuthorized] = useState(false);

  const verifyFn = useServerFn(verificarAdmin);
  const listFn = useServerFn(listarPedidosAdmin);
  const updateFn = useServerFn(atualizarStatusPedido);
  const qc = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        navigate({ to: "/auth" });
        return;
      }
      try {
        const res = await verifyFn();
        if (cancelled) return;
        if (!res.isAdmin) {
          navigate({ to: "/" });
          return;
        }
        setAuthorized(true);
      } catch {
        navigate({ to: "/auth" });
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, verifyFn]);

  const pedidosQ = useQuery({
    queryKey: ["admin-pedidos"],
    queryFn: () => listFn(),
    enabled: authorized,
  });

  const mut = useMutation({
    mutationFn: (v: { pedido_id: string; status: StatusPedido }) =>
      updateFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-pedidos"] }),
  });

  if (!checked) {
    return <div className="p-8 text-sm text-muted-foreground">Verificando acesso...</div>;
  }
  if (!authorized) return null;

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Pedidos</h1>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth" });
            }}
            className="rounded-md border border-input px-3 py-1.5 text-sm"
          >
            Sair
          </button>
        </div>

        {pedidosQ.isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {pedidosQ.error && (
          <p className="text-sm text-destructive">
            {(pedidosQ.error as Error).message}
          </p>
        )}

        <div className="space-y-4">
          {(pedidosQ.data ?? []).map((p: any) => (
            <article
              key={p.id}
              className="rounded-lg border border-border bg-card p-4 shadow-sm"
            >
              <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs text-muted-foreground">
                    #{p.id.slice(0, 8)} •{" "}
                    {new Date(p.created_at).toLocaleString("pt-BR")}
                  </p>
                  <p className="font-medium">
                    {p.clientes?.nome} — {p.clientes?.telefone}
                  </p>
                  <p className="text-sm text-muted-foreground">{p.clientes?.email}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold">{formatBRL(Number(p.valor_total))}</p>
                  <p className="text-xs text-muted-foreground">
                    Entrega: {new Date(p.horario_entrega).toLocaleString("pt-BR")}
                  </p>
                </div>
              </header>

              <div className="mb-3 text-sm">
                <p>
                  {p.enderecos?.rua}, {p.enderecos?.numero}
                  {p.enderecos?.complemento ? ` — ${p.enderecos.complemento}` : ""} •{" "}
                  {p.enderecos?.bairro} • CEP {p.enderecos?.cep}
                </p>
              </div>

              <ul className="mb-3 space-y-1 text-sm">
                {(p.itens_pedido ?? []).map((it: any, i: number) => (
                  <li key={i}>
                    {it.quantidade}× {it.produtos?.nome} —{" "}
                    {formatBRL(Number(it.preco_unitario))}
                  </li>
                ))}
              </ul>

              {p.observacoes && (
                <p className="mb-3 rounded-md bg-muted/50 p-2 text-sm">
                  <span className="font-medium">Obs:</span> {p.observacoes}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">Status:</span>
                <select
                  value={p.status}
                  disabled={mut.isPending}
                  onChange={(e) =>
                    mut.mutate({
                      pedido_id: p.id,
                      status: e.target.value as StatusPedido,
                    })
                  }
                  className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
                {p.mercadopago_payment_id && (
                  <span className="text-xs text-muted-foreground">
                    MP: {p.mercadopago_payment_id}
                  </span>
                )}
              </div>
            </article>
          ))}
          {pedidosQ.data && pedidosQ.data.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum pedido ainda.</p>
          )}
        </div>
      </div>
    </div>
  );
}
