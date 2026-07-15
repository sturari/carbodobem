import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
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

function Sucesso() {
  const { pedido, status, payment_id, collection_id, collection_status } = Route.useSearch();
  const fnConfirmarPagamento = useServerFn(confirmarPagamentoMercadoPago);
  const [statusConfirmado, setStatusConfirmado] = React.useState<string | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);

  const paymentId = payment_id || collection_id;

  React.useEffect(() => {
    let ativo = true;
    if (!paymentId) return;
    fnConfirmarPagamento({ data: { pedido_id: pedido, payment_id: paymentId } })
      .then((res) => {
        if (ativo) setStatusConfirmado(res.status);
      })
      .catch((e: unknown) => {
        if (ativo) setErro(e instanceof Error ? e.message : "Não foi possível confirmar o pagamento.");
      });
    return () => {
      ativo = false;
    };
  }, [fnConfirmarPagamento, paymentId, pedido]);

  const finalStatus = statusConfirmado || collection_status || status || "aguardando";

  const config =
    finalStatus === "failure" || finalStatus === "rejected" || finalStatus === "recusado"
      ? {
          Icon: XCircle,
          color: "text-destructive",
          titulo: "Pagamento não concluído",
          msg: "Seu pagamento não foi aprovado. Tente novamente ou use outro método.",
        }
      : finalStatus === "pending" || finalStatus === "in_process" || finalStatus === "pendente"
        ? {
            Icon: Clock,
            color: "text-warm",
            titulo: "Pagamento em análise",
            msg: "Assim que o Mercado Pago aprovar, começamos a preparar seu pedido.",
          }
        : finalStatus === "approved" || finalStatus === "aprovado"
          ? {
              Icon: CheckCircle2,
              color: "text-primary",
              titulo: "Pedido recebido!",
              msg: "Pagamento aprovado. Em breve você receberá a confirmação por e-mail e WhatsApp.",
            }
        : {
            Icon: Clock,
            color: "text-warm",
            titulo: "Aguardando confirmação",
            msg: "Seu pedido foi criado e estamos aguardando a confirmação do Mercado Pago.",
          };

  const { Icon } = config;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md text-center rounded-2xl border border-border/70 bg-card p-8 shadow-sm">
        <Icon className={`mx-auto h-16 w-16 ${config.color}`} />
        <h1 className="mt-4 font-display text-2xl font-bold">{config.titulo}</h1>
        <p className="mt-2 text-muted-foreground">{config.msg}</p>
        {pedido && (
          <p className="mt-3 text-xs text-muted-foreground">
            Número do pedido: <span className="font-mono">{pedido.slice(0, 8)}</span>
          </p>
        )}
        {paymentId && (
          <p className="text-xs text-muted-foreground">
            Pagamento: <span className="font-mono">{paymentId}</span>
          </p>
        )}
        {erro && <p className="mt-3 text-xs text-destructive">{erro}</p>}
        <Link
          to="/"
          className="mt-6 inline-block rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          Voltar à loja
        </Link>
      </div>
    </div>
  );
}
