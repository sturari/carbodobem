import { Outlet, createFileRoute } from "@tanstack/react-router";

/**
 * Layout do checkout. Existe apenas para permitir rotas filhas
 * (`/checkout` e `/checkout/sucesso`) — sem ele, a página de sucesso
 * do Mercado Pago nunca renderiza.
 */
export const Route = createFileRoute("/checkout")({
  component: () => <Outlet />,
});
