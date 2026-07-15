import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Clock, Loader2, RefreshCw, XCircle } from "lucide-react";
import React from "react";
import { z } from "zod";
import { confirmarPagamentoMercadoPago } from "@/lib/mercadopago.functions";

export const Route = createFileRoute("/checkout/sucesso")({
  validateSearch: z.object({
    pedido: z.string().optional(),
    status: z.string().optional(),
    payment_id: z.string().optional(),
    collection_id: z.string().optional(),
    collection_status: z.string().optional(),
  }),
  component: Sucesso,
});

type UiStatus = "aprovado" | "pendente" | "recusado" | "aguardando";

function normalizar(raw?: string | null): UiStatus {
  if (!raw) return "aguardando";
  if (["approved", "aprovado"].includes(raw)) return "aprovado";
  if (["rejected", "failure", "cancelled", "recusado"].includes(raw)) return "recusado";
  if (["pending", "in_process", "pendente"].includes(raw)) return "pendente";
  return "aguardando";
}

function Sucesso() {
  const { pedido, status, payment_id, collection_id, collection_status } = Route.useSearch();
  const fnConfirmarPagamento = useServerFn(confirmarPagamentoMercadoPago);
  const [statusConfirmado, setStatusConfirmado] = React.useState<string | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const [carregando, setCarregando] = React.useState(false);

  const paymentId = payment_id || collection_id;

  const confirmar = React.useCallback(async () => {
    if (!paymentId && !pedido) return;
    setCarregando(true);
    setErro(null);
    try {
      const res = await fnConfirmarPagamento({
        data: { pedido_id: pedido, payment_id: paymentId },
      });
      setStatusConfirmado(res.status);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Não foi possível confirmar o pagamento.");
    } finally {
      setCarregando(false);
    }
  }, [fnConfirmarPagamento, paymentId, pedido]);

  React.useEffect(() => {
    void confirmar();
  }, [confirmar]);

  const finalStatus = normalizar(statusConfirmado || collection_status || status);

  const config =
    finalStatus === "recusado"
      ? {
          Icon: XCircle,
          color: "text-destructive",
          titulo: "Pagamento não concluído",
          msg: "Seu pagamento não foi aprovado. Tente novamente ou use outro método de pagamento.",
        }
      : finalStatus === "pendente"
        ? {
            Icon: Clock,
            color: "text-warm",
            titulo: "Pagamento em processamento",
            msg: "Recebemos seu pedido e o Mercado Pago está processando o pagamento. Assim que for aprovado, começamos a preparar sua refeição — você também receberá a confirmação por e-mail.",
          }
        : finalStatus === "aprovado"
          ? {
              Icon: CheckCircle2,
              color: "text-primary",
              titulo: "Pedido confirmado!",
              msg: "Pagamento aprovado. Em breve você receberá a confirmação por e-mail e WhatsApp.",
            }
          : {
              Icon: Clock,
              color: "text-warm",
              titulo: "Aguardando confirmação",
              msg: "Seu pedido foi criado e estamos aguardando a confirmação do Mercado Pago. Isso pode levar alguns instantes — atualize para verificar novamente.",
            };

  const { Icon } = config;
  const mostrarAtualizar = finalStatus === "pendente" || finalStatus === "aguardando";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center rounded-2xl border border-border/70 bg-card p-8 shadow-sm">
        <Icon className={`mx-auto h-16 w-16 ${config.color}`} />
        <h1 className="mt-4 font-display text-2xl font-bold">{config.titulo}</h1>
        <p className="mt-2 text-muted-foreground">{config.msg}</p>

        <div className="mt-4 space-y-1 text-xs text-muted-foreground">
          {pedido && (
            <p>
              Número do pedido: <span className="font-mono">{pedido.slice(0, 8)}</span>
            </p>
          )}
          {paymentId && (
            <p>
              Pagamento: <span className="font-mono">{paymentId}</span>
            </p>
          )}
          <p>
            Status:{" "}
            <span className="font-semibold capitalize text-foreground">{finalStatus}</span>
          </p>
        </div>

        {erro && <p className="mt-3 text-xs text-destructive">{erro}</p>}

        <div className="mt-6 flex flex-col items-center gap-2">
          {mostrarAtualizar && (
            <button
              type="button"
              onClick={() => void confirmar()}
              disabled={carregando}
              className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
            >
              {carregando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Atualizar status
            </button>
          )}
          <Link
            to="/"
            className="inline-block rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Voltar à loja
          </Link>
        </div>
      </div>
    </div>
  );
}
