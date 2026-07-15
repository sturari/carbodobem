import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Carbo do Bem" },
      {
        name: "description",
        content:
          "Como a Carbo do Bem coleta, usa e protege seus dados pessoais, em conformidade com a LGPD.",
      },
    ],
  }),
  component: PrivacidadePage,
});

const HOJE = new Date().toLocaleDateString("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Link to="/" className="text-xs font-semibold text-primary">
          ← voltar à loja
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold">Política de Privacidade</h1>
        <p className="mt-1 text-sm text-muted-foreground">Última atualização: {HOJE}</p>

        <section className="prose prose-sm mt-6 max-w-none space-y-5 text-foreground">
          <p>
            A <strong>Carbo do Bem</strong> ("nós") respeita sua privacidade e trata seus
            dados pessoais em conformidade com a Lei Geral de Proteção de Dados Pessoais
            (Lei nº 13.709/2018 — LGPD). Esta política explica quais dados coletamos, para
            que os usamos e quais são seus direitos como titular.
          </p>

          <h2 className="font-display text-xl font-bold">1. Dados que coletamos</h2>
          <ul className="list-disc pl-5">
            <li>
              <strong>Cadastro:</strong> nome, e-mail e senha (armazenada de forma
              criptografada);
            </li>
            <li>
              <strong>Pedidos:</strong> telefone (WhatsApp), endereço de entrega,
              itens do pedido, horário desejado e observações;
            </li>
            <li>
              <strong>Pagamento:</strong> processado pelo <strong>Mercado Pago</strong>;
              não armazenamos dados de cartão de crédito;
            </li>
            <li>
              <strong>Uso do site:</strong> logs técnicos, cookies e métricas do Google
              Analytics.
            </li>
          </ul>

          <h2 className="font-display text-xl font-bold">2. Finalidade</h2>
          <ul className="list-disc pl-5">
            <li>Processar pedidos, pagamentos e entregas;</li>
            <li>Enviar e-mails transacionais (confirmação, status, entrega);</li>
            <li>Atender solicitações e comunicar sobre o seu pedido;</li>
            <li>Cumprir obrigações legais, fiscais e regulatórias;</li>
            <li>Melhorar nossos produtos e a experiência do site.</li>
          </ul>

          <h2 className="font-display text-xl font-bold">3. Base legal</h2>
          <p>
            Tratamos seus dados com fundamento em <em>execução de contrato</em> (para
            entregar seu pedido), <em>consentimento</em> (para cookies analíticos),
            <em> cumprimento de obrigação legal</em> e <em>legítimo interesse</em> (para
            segurança e prevenção a fraudes).
          </p>

          <h2 className="font-display text-xl font-bold">4. Compartilhamento</h2>
          <p>Compartilhamos seus dados apenas com parceiros necessários à operação:</p>
          <ul className="list-disc pl-5">
            <li>
              <strong>Mercado Pago</strong> — processamento de pagamento;
            </li>
            <li>
              <strong>Lovable / Supabase</strong> — hospedagem do site e banco de dados;
            </li>
            <li>
              <strong>Google Analytics</strong> — métricas de uso;
            </li>
            <li>Autoridades públicas, quando exigido por lei.</li>
          </ul>

          <h2 className="font-display text-xl font-bold">5. Retenção</h2>
          <p>
            Mantemos seus dados pelo tempo necessário para cumprir as finalidades
            descritas ou por obrigação legal (por exemplo, notas fiscais por 5 anos).
            Após esse prazo, os dados são apagados ou anonimizados.
          </p>

          <h2 className="font-display text-xl font-bold">6. Seus direitos</h2>
          <p>Como titular, você pode a qualquer momento:</p>
          <ul className="list-disc pl-5">
            <li>Confirmar a existência de tratamento;</li>
            <li>Acessar, corrigir ou atualizar seus dados;</li>
            <li>Solicitar anonimização, bloqueio ou eliminação;</li>
            <li>Solicitar portabilidade;</li>
            <li>Revogar o consentimento;</li>
            <li>Reclamar junto à ANPD.</li>
          </ul>
          <p>
            Para exercer seus direitos, escreva para{" "}
            <a
              className="text-primary underline"
              href="mailto:atendimento@carbodobem.com.br"
            >
              atendimento@carbodobem.com.br
            </a>
            .
          </p>

          <h2 className="font-display text-xl font-bold">7. Cookies</h2>
          <p>
            Usamos cookies essenciais (para funcionamento do carrinho e da sessão) e
            cookies analíticos (Google Analytics). Você pode aceitar ou recusar cookies
            analíticos no banner exibido em sua primeira visita, e alterar sua escolha
            depois pelo mesmo banner.
          </p>

          <h2 className="font-display text-xl font-bold">8. Segurança</h2>
          <p>
            Adotamos medidas técnicas e organizacionais para proteger seus dados,
            incluindo criptografia em trânsito (HTTPS), controle de acesso e políticas
            de segurança da informação. Ainda assim, nenhum sistema é 100% seguro.
          </p>

          <h2 className="font-display text-xl font-bold">9. Contato</h2>
          <p>
            <strong>Carbo do Bem</strong>
            <br />
            SHIN CA 5, Ed. Solarium Center, D-1, Loja 87 — Lago Norte, Brasília/DF
            <br />
            E-mail: atendimento@carbodobem.com.br
            <br />
            WhatsApp: +55 61 99452-9009
          </p>
        </section>
      </main>
    </div>
  );
}
