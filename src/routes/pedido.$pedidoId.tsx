import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import { Loader2, MailCheck, PackageSearch } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/Header";
import { CarrinhoDrawer } from "@/components/CarrinhoDrawer";
import {
  buscarPedidoConvidado,
  reenviarEmailConfirmacaoConvidado,
} from "@/lib/pedidos-cliente.functions";
import { formatBRL } from "@/lib/format";

function ReenviarConfirmacao({ pedidoId }: { pedidoId: string }) {
  const reenviar = useServerFn(reenviarEmailConfirmacaoConvidado);
  const [email, setEmail] = React.useState("");
  const [enviando, setEnviando] = React.useState(false);
  const [enviado, setEnviado] = React.useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    try {
      const res = await reenviar({ data: { pedido_id: pedidoId, email } });
      if (res.ok) {
        setEnviado(true);
        toast.success("E-mail de confirmação reenviado!");
      } else {
        toast.error("Este e-mail está bloqueado para envios. Fale com o atendimento.");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Não foi possível reenviar o e-mail.",
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className="mt-6 rounded-xl border border-border/70 bg-muted/40 p-4 text-sm"
    >
      <p className="font-semibold">Não recebeu o e-mail de confirmação?</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Informe o mesmo e-mail usado no pedido e reenviamos a confirmação com este
        link de acompanhamento.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
          className="min-w-0 flex-1 rounded-full border border-border bg-background px-4 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={enviando || enviado}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-60"
        >
          {enviando ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MailCheck className="h-4 w-4" />
          )}
          {enviado ? "Enviado" : "Reenviar e-mail"}
        </button>
      </div>
    </form>
  );
}

export const Route = createFileRoute("/pedido/$pedidoId")({
  head: () => ({
    meta: [
      { title: "Acompanhar pedido — Carbo do Bem" },
      { name: "description", content: "Acompanhe o status do seu pedido na Carbo do Bem." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: PedidoConvidadoPage,
});

const STATUS_LABEL: Record<string, string> = {
  pendente: "Aguardando pagamento",
  pagamento_confirmado: "Pagamento confirmado",
  em_preparo: "Em preparo",
  saiu_para_entrega: "Saiu para entrega",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

function PedidoConvidadoPage() {
  const { pedidoId } = useParams({ from: "/pedido/$pedidoId" });
  const fetchPedido = useServerFn(buscarPedidoConvidado);
  const pedidoQ = useQuery({
    queryKey: ["pedido-convidado", pedidoId],
    queryFn: () => fetchPedido({ data: { pedido_id: pedidoId } }),
  });

  const p = pedidoQ.data;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <CarrinhoDrawer />
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold">Acompanhar pedido</h1>
          <p className="text-sm text-muted-foreground">
            Este é o seu link exclusivo para acompanhar o pedido.
          </p>
        </div>

        {pedidoQ.isLoading && (
          <div className="rounded-2xl border border-border/70 bg-card p-8 text-center text-sm text-muted-foreground">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-primary" />
            Carregando pedido...
          </div>
        )}

        {(pedidoQ.error || (pedidoQ.data === null && !pedidoQ.isLoading)) && (
          <div className="rounded-2xl border border-border/70 bg-card p-10 text-center">
            <PackageSearch className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Não encontramos este pedido. Se ele foi feito com uma conta,{" "}
              <Link to="/auth" className="text-primary underline">entre</Link>{" "}
              para acompanhá-lo.
            </p>
          </div>
        )}

        {p && (
          <article className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
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
                  Entrega prevista: {new Date(p.horario_entrega).toLocaleString("pt-BR")}
                </p>
              </div>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">
                {STATUS_LABEL[p.status] ?? p.status}
              </span>
            </header>

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

            <ReenviarConfirmacao pedidoId={p.id} />

            <div className="mt-6 rounded-xl bg-primary/5 p-4 text-sm">
              <p className="font-semibold">Quer acompanhar mais fácil da próxima vez?</p>
              <p className="mt-1 text-muted-foreground">
                Crie uma conta com este mesmo e-mail e todos os seus pedidos ficam salvos em um só lugar.
              </p>
              <Link
                to="/auth"
                className="mt-3 inline-block rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground"
              >
                Criar conta
              </Link>
            </div>
          </article>
        )}
      </main>
    </div>
  );
}
