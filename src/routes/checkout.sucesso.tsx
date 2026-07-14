import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { z } from "zod";

export const Route = createFileRoute("/checkout/sucesso")({
  validateSearch: z.object({
    pedido: z.string().optional(),
    status: z.string().optional(),
    payment_id: z.string().optional(),
    collection_status: z.string().optional(),
  }),
  component: Sucesso,
});

function Sucesso() {
  const { pedido, status, payment_id, collection_status } = Route.useSearch();
  const finalStatus = collection_status || status || "approved";

  const config =
    finalStatus === "failure" || finalStatus === "rejected"
      ? {
          Icon: XCircle,
          color: "text-destructive",
          titulo: "Pagamento não concluído",
          msg: "Seu pagamento não foi aprovado. Tente novamente ou use outro método.",
        }
      : finalStatus === "pending" || finalStatus === "in_process"
        ? {
            Icon: Clock,
            color: "text-warm",
            titulo: "Pagamento em análise",
            msg: "Assim que o Mercado Pago aprovar, começamos a preparar seu pedido.",
          }
        : {
            Icon: CheckCircle2,
            color: "text-primary",
            titulo: "Pedido recebido!",
            msg: "Obrigado pela compra. Em breve você receberá a confirmação por e-mail e WhatsApp.",
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
        {payment_id && (
          <p className="text-xs text-muted-foreground">
            Pagamento: <span className="font-mono">{payment_id}</span>
          </p>
        )}
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
