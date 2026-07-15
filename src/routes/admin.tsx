import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  atualizarProduto,
  atualizarStatusPedido,
  criarProduto,
  listarPedidosAdmin,
  listarProdutosAdmin,
  reembolsarPedido,
  sincronizarPedidoMP,
  verificarAdmin,
} from "@/lib/admin.functions";
import { formatBRL } from "@/lib/format";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Painel" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
});

const STATUS_OPTIONS = [
  "pendente",
  "pagamento_confirmado",
  "em_preparo",
  "saiu_para_entrega",
  "entregue",
  "cancelado",
] as const;
type StatusPedido = (typeof STATUS_OPTIONS)[number];

const STATUS_LABEL: Record<StatusPedido, string> = {
  pendente: "Aguardando pagamento",
  pagamento_confirmado: "Pagamento confirmado",
  em_preparo: "Em preparo",
  saiu_para_entrega: "Saiu para entrega",
  entregue: "Entregue",
  cancelado: "Cancelado",
};


type Tab = "pedidos" | "produtos";

function AdminPage() {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [tab, setTab] = useState<Tab>("pedidos");
  const verifyFn = useServerFn(verificarAdmin);

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

  if (!checked) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Verificando acesso...
      </div>
    );
  }
  if (!authorized) return null;

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Painel administrativo</h1>
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

        <div className="mb-6 flex gap-2 border-b border-border">
          {(["pedidos", "produtos"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
                tab === t
                  ? "border-b-2 border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "pedidos" ? <PedidosTab /> : <ProdutosTab />}
      </div>
    </div>
  );
}

function PedidosTab() {
  const listFn = useServerFn(listarPedidosAdmin);
  const updateFn = useServerFn(atualizarStatusPedido);
  const refundFn = useServerFn(reembolsarPedido);
  const syncFn = useServerFn(sincronizarPedidoMP);
  const qc = useQueryClient();

  const pedidosQ = useQuery({
    queryKey: ["admin-pedidos"],
    queryFn: () => listFn(),
  });

  const mut = useMutation({
    mutationFn: (v: { pedido_id: string; status: StatusPedido }) =>
      updateFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-pedidos"] }),
  });

  const refundMut = useMutation({
    mutationFn: (pedido_id: string) => refundFn({ data: { pedido_id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-pedidos"] });
      alert("Reembolso solicitado com sucesso no Mercado Pago.");
    },
    onError: (e: Error) => alert(e.message),
  });

  const syncMut = useMutation({
    mutationFn: (pedido_id: string) => syncFn({ data: { pedido_id } }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["admin-pedidos"] });
      alert(`Status sincronizado com o Mercado Pago: ${res.status}`);
    },
    onError: (e: Error) => alert(e.message),
  });

  if (pedidosQ.isLoading)
    return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (pedidosQ.error)
    return (
      <p className="text-sm text-destructive">
        {(pedidosQ.error as Error).message}
      </p>
    );

  return (
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
              <p className="text-sm text-muted-foreground">
                {p.clientes?.email}
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold">
                {formatBRL(Number(p.valor_total))}
              </p>
              <p className="text-xs text-muted-foreground">
                Entrega:{" "}
                {new Date(p.horario_entrega).toLocaleString("pt-BR")}
              </p>
            </div>
          </header>

          <div className="mb-3 text-sm">
            <p>
              {p.enderecos?.rua}, {p.enderecos?.numero}
              {p.enderecos?.complemento ? ` — ${p.enderecos.complemento}` : ""}{" "}
              • {p.enderecos?.bairro} • CEP {p.enderecos?.cep}
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
                  {STATUS_LABEL[s]}
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
  );
}

type ProdutoForm = {
  id?: string;
  nome: string;
  categoria: string;
  descricao: string;
  preco: string;
  estoque: string;
  gramatura_g: string;
  imagem_url: string;
  ativo: boolean;
};

const emptyForm: ProdutoForm = {
  nome: "",
  categoria: "",
  descricao: "",
  preco: "",
  estoque: "0",
  gramatura_g: "",
  imagem_url: "",
  ativo: true,
};

function ProdutosTab() {
  const listFn = useServerFn(listarProdutosAdmin);
  const createFn = useServerFn(criarProduto);
  const updateFn = useServerFn(atualizarProduto);
  const qc = useQueryClient();

  const [form, setForm] = useState<ProdutoForm>(emptyForm);
  const [editing, setEditing] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const produtosQ = useQuery({
    queryKey: ["admin-produtos"],
    queryFn: () => listFn(),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-produtos"] });
    qc.invalidateQueries({ queryKey: ["produtos"] });
  };

  const createMut = useMutation({
    mutationFn: (payload: any) => createFn({ data: payload }),
    onSuccess: () => {
      invalidate();
      setForm(emptyForm);
      setEditing(null);
      setErr(null);
    },
    onError: (e: Error) => setErr(e.message),
  });

  const updateMut = useMutation({
    mutationFn: (payload: any) => updateFn({ data: payload }),
    onSuccess: () => {
      invalidate();
      setForm(emptyForm);
      setEditing(null);
      setErr(null);
    },
    onError: (e: Error) => setErr(e.message),
  });

  const toggleAtivoMut = useMutation({
    mutationFn: (p: { id: string; ativo: boolean }) =>
      updateFn({ data: p }),
    onSuccess: invalidate,
  });

  const startEdit = (p: any) => {
    setEditing(p.id);
    setForm({
      id: p.id,
      nome: p.nome,
      categoria: p.categoria,
      descricao: p.descricao ?? "",
      preco: String(p.preco),
      estoque: String(p.estoque),
      gramatura_g: p.gramatura_g != null ? String(p.gramatura_g) : "",
      imagem_url: p.imagem_url ?? "",
      ativo: p.ativo,
    });
    setErr(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditing(null);
    setForm(emptyForm);
    setErr(null);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const preco = Number(form.preco);
    const estoque = Number(form.estoque);
    const gramatura = form.gramatura_g ? Number(form.gramatura_g) : null;
    if (!form.nome.trim() || !form.categoria.trim()) {
      setErr("Nome e categoria são obrigatórios.");
      return;
    }
    if (Number.isNaN(preco) || preco < 0) {
      setErr("Preço inválido.");
      return;
    }
    if (Number.isNaN(estoque) || estoque < 0) {
      setErr("Estoque inválido.");
      return;
    }
    const payload: any = {
      nome: form.nome.trim(),
      categoria: form.categoria.trim(),
      descricao: form.descricao.trim() || null,
      preco,
      estoque,
      gramatura_g: gramatura,
      imagem_url: form.imagem_url.trim() || null,
      ativo: form.ativo,
    };
    if (editing) {
      updateMut.mutate({ id: editing, ...payload });
    } else {
      createMut.mutate(payload);
    }
  };

  if (produtosQ.isLoading)
    return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (produtosQ.error)
    return (
      <p className="text-sm text-destructive">
        {(produtosQ.error as Error).message}
      </p>
    );

  const submitting = createMut.isPending || updateMut.isPending;

  return (
    <div className="space-y-6">
      <form
        onSubmit={submit}
        className="rounded-lg border border-border bg-card p-4 shadow-sm"
      >
        <h2 className="mb-4 text-lg font-semibold">
          {editing ? "Editar produto" : "Novo produto"}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nome *">
            <input
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className={inputCls}
              required
            />
          </Field>
          <Field label="Categoria *">
            <input
              value={form.categoria}
              onChange={(e) =>
                setForm({ ...form, categoria: e.target.value })
              }
              className={inputCls}
              required
            />
          </Field>
          <Field label="Preço (R$) *">
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.preco}
              onChange={(e) => setForm({ ...form, preco: e.target.value })}
              className={inputCls}
              required
            />
          </Field>
          <Field label="Estoque *">
            <input
              type="number"
              step="1"
              min="0"
              value={form.estoque}
              onChange={(e) => setForm({ ...form, estoque: e.target.value })}
              className={inputCls}
              required
            />
          </Field>
          <Field label="Gramatura (g)">
            <input
              type="number"
              step="1"
              min="0"
              value={form.gramatura_g}
              onChange={(e) =>
                setForm({ ...form, gramatura_g: e.target.value })
              }
              className={inputCls}
            />
          </Field>
          <Field label="Imagem (URL)">
            <input
              type="url"
              value={form.imagem_url}
              onChange={(e) =>
                setForm({ ...form, imagem_url: e.target.value })
              }
              placeholder="https://..."
              className={inputCls}
            />
          </Field>
          <Field label="Descrição" className="sm:col-span-2">
            <textarea
              value={form.descricao}
              onChange={(e) =>
                setForm({ ...form, descricao: e.target.value })
              }
              rows={3}
              className={inputCls}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
            />
            Ativo (visível na loja)
          </label>
        </div>

        {err && <p className="mt-3 text-sm text-destructive">{err}</p>}

        <div className="mt-4 flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {submitting
              ? "Salvando..."
              : editing
                ? "Salvar alterações"
                : "Criar produto"}
          </button>
          {editing && (
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-md border border-input px-4 py-2 text-sm"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">
          Produtos ({produtosQ.data?.length ?? 0})
        </h2>
        <div className="space-y-2">
          {(produtosQ.data ?? []).map((p: any) => (
            <div
              key={p.id}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 shadow-sm ${
                !p.ativo ? "opacity-60" : ""
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                {p.imagem_url ? (
                  <img
                    src={p.imagem_url}
                    alt={p.nome}
                    className="h-12 w-12 rounded object-cover"
                  />
                ) : (
                  <div className="h-12 w-12 rounded bg-muted" />
                )}
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.categoria} • {formatBRL(Number(p.preco))} • estoque{" "}
                    {p.estoque}
                    {p.gramatura_g ? ` • ${p.gramatura_g}g` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => startEdit(p)}
                  className="rounded-md border border-input px-3 py-1 text-xs"
                >
                  Editar
                </button>
                <button
                  onClick={() =>
                    toggleAtivoMut.mutate({ id: p.id, ativo: !p.ativo })
                  }
                  disabled={toggleAtivoMut.isPending}
                  className="rounded-md border border-input px-3 py-1 text-xs"
                >
                  {p.ativo ? "Desativar" : "Ativar"}
                </button>
              </div>
            </div>
          ))}
          {produtosQ.data && produtosQ.data.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhum produto cadastrado.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1 block font-medium">{label}</span>
      {children}
    </label>
  );
}
