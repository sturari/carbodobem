<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Regras do projeto

- `.env` é rastreado pelo Git de propósito: builds publicados só incluem arquivos
  commitados, e ele guarda apenas identificadores públicos do backend. Nunca
  coloque segredos de verdade ali — chaves de pagamento, e-mail e rotina vivem
  nos secrets do Lovable Cloud. Use `.env.example` como modelo de chaves.
- Ao mexer em `bun.lock`, não mescle manualmente: regenerate com `bun install`
  (o `.gitattributes` já bloqueia a mesclagem automática).
- Trabalhe em um branch sincronizado só; sem force-push, rebase ou squash de
  commits já publicados.
