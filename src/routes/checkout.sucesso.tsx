import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { z } from "zod";

export const Route = createFileRoute("/checkout/sucesso")({
  validateSearch: z.object({ pedido: z.string().optional() }),
  component: Sucesso,
});

function Sucesso() {
  const { pedido } = Route.useSearch();
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md text-center rounded-2xl border border-border/70 bg-card p-8 shadow-sm">
        <CheckCircle2 className="mx-auto h-16 w-16 text-primary" />
        <h1 className="mt-4 font-display text-2xl font-bold">Pedido recebido!</h1>
        <p className="mt-2 text-muted-foreground">
          Obrigado pela compra. Em breve você receberá a confirmação por e-mail e WhatsApp.
        </p>
        {pedido && (
          <p className="mt-3 text-xs text-muted-foreground">
            Número do pedido: <span className="font-mono">{pedido.slice(0, 8)}</span>
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
