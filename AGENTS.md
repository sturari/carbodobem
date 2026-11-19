## Stack e hospedagem

- TanStack Start (React + Vite) + TypeScript + Tailwind/shadcn. Gerenciador: `bun`.
- Hospedagem: **Vercel** (preset `vercel` do Nitro em `vite.config.ts`); cada push
  no `main` publica o site, e cada branch/PR ganha uma URL de preview.
- Banco e login: **Supabase** (projeto próprio). Migrações em `supabase/migrations/`.
- E-mail transacional: **Resend** (`src/lib/email-templates/send-email.ts`).
- Pagamentos: Mercado Pago (webhook em `/api/public/webhooks/mercadopago`).
- Rotina diária de pedidos: Vercel Cron (`vercel.json`) → `/api/public/cron/pedidos`.

## Regras do projeto

- `.env` é rastreado pelo Git de propósito e guarda apenas identificadores
  públicos do Supabase (URL e chave publishable). Nunca coloque segredos de
  verdade ali — chaves de pagamento, e-mail, service role e rotina vivem nas
  variáveis de ambiente da Vercel. Use `.env.example` como modelo de chaves.
- Ao mexer em `bun.lock`, não mescle manualmente: regenere com `bun install`
  (o `.gitattributes` já bloqueia a mesclagem automática).
- Sem force-push, rebase ou squash de commits já publicados.
- Antes de commitar: `bun run test`, `bunx tsc --noEmit` e `bun run build`.
