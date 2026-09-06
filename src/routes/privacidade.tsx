import { createFileRoute, Link } from "@tanstack/react-router";
import { EMPRESA } from "@/lib/empresa";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade e Cookies — Carbo do Bem" },
      {
        name: "description",
        content:
          "Como a Carbo do Bem coleta, usa, compartilha e protege seus dados pessoais e cookies, em conformidade com a LGPD (Lei nº 13.709/2018).",
      },
      { property: "og:title", content: "Política de Privacidade e Cookies — Carbo do Bem" },
      {
        property: "og:description",
        content:
          "Dados coletados, finalidades, bases legais, prazos de retenção e seus direitos como titular, conforme a LGPD.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Política de Privacidade e Cookies — Carbo do Bem" },
      {
        name: "twitter:description",
        content:
          "Dados coletados, finalidades, bases legais, prazos de retenção e seus direitos como titular, conforme a LGPD.",
      },
    ],
  }),
  component: PrivacidadePage,
});

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-xl font-bold">{children}</h2>;
}

function PrivacidadePage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Link to="/" className="text-xs font-semibold text-primary">
          ← voltar à loja
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold">
          Política de Privacidade e Cookies
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Última atualização: {EMPRESA.atualizadoEm}
        </p>

        <section className="prose prose-sm mt-6 max-w-none space-y-5 text-foreground">
          <p>
            A <strong>{EMPRESA.nomeFantasia}</strong> ("nós") é a controladora dos seus
            dados pessoais e os trata conforme a Lei Geral de Proteção de Dados Pessoais
            (Lei nº 13.709/2018 — LGPD), o Marco Civil da Internet (Lei nº 12.965/2014) e
            o Código de Defesa do Consumidor. Esta política explica quais dados coletamos,
            por quê, com quem compartilhamos, por quanto tempo guardamos e quais são os
            seus direitos.
          </p>

          <H2>1. Controladora e contato do encarregado</H2>
          <p>
            <strong>{EMPRESA.nomeFantasia}</strong>
            {EMPRESA.razaoSocial && EMPRESA.cnpj ? (
              <>
                <br />
                {EMPRESA.razaoSocial} — CNPJ {EMPRESA.cnpj}
              </>
            ) : null}
            <br />
            {EMPRESA.endereco}
            <br />
            Encarregado(a) de dados (DPO) e canal do titular:{" "}
            <a className="text-primary underline" href={`mailto:${EMPRESA.email}`}>
              {EMPRESA.email}
            </a>
            <br />
            WhatsApp: {EMPRESA.whatsapp}
          </p>

          <H2>2. Dados que coletamos</H2>
          <ul className="list-disc pl-5">
            <li>
              <strong>Identificação e contato:</strong> nome, e-mail, telefone/WhatsApp e
              CPF (necessário ao pagamento e à nota fiscal);
            </li>
            <li>
              <strong>Conta (opcional):</strong> e-mail e senha, guardada apenas de forma
              criptografada (hash) pelo nosso provedor de autenticação;
            </li>
            <li>
              <strong>Pedido e entrega:</strong> endereço completo, CEP, itens, valores,
              data/turno de entrega e observações;
            </li>
            <li>
              <strong>Pagamento:</strong> processado pelo Mercado Pago. Guardamos apenas o
              identificador da transação, o método e o status. Não armazenamos número
              completo de cartão nem CVV;
            </li>
            <li>
              <strong>Comunicações:</strong> registros de e-mails transacionais enviados e
              seu status de entrega, além do histórico de atendimento;
            </li>
            <li>
              <strong>Dados técnicos:</strong> endereço IP, data e hora de acesso,
              dispositivo, navegador, páginas visitadas e cookies.
            </li>
          </ul>
          <p>
            Não coletamos dados pessoais sensíveis e não direcionamos a loja a crianças e
            adolescentes. Se identificarmos cadastro de menor de 18 anos sem
            representação, os dados serão eliminados.
          </p>

          <H2>3. Finalidades e bases legais</H2>
          <ul className="list-disc pl-5">
            <li>
              Processar e entregar pedidos, cobrar e dar suporte —{" "}
              <em>execução de contrato</em> (art. 7º, V);
            </li>
            <li>
              Enviar e-mails transacionais (confirmação, saiu para entrega, entregue) —{" "}
              <em>execução de contrato</em>;
            </li>
            <li>
              Emitir notas fiscais e guardar registros contábeis e de acesso —{" "}
              <em>cumprimento de obrigação legal</em> (art. 7º, II), inclusive a guarda de
              registros de conexão/aplicação prevista no Marco Civil;
            </li>
            <li>
              Prevenir fraudes, garantir a segurança do site e apurar abusos —{" "}
              <em>legítimo interesse</em> (art. 7º, IX) e prevenção à fraude (art. 11, II,
              "g");
            </li>
            <li>
              Medir audiência com Google Analytics e melhorar a loja —{" "}
              <em>consentimento</em> dado no banner de cookies (art. 7º, I), revogável a
              qualquer momento;
            </li>
            <li>
              Enviar promoções, quando você optar por recebê-las — <em>consentimento</em>,
              com descadastro em todos os envios.
            </li>
          </ul>

          <H2>4. Com quem compartilhamos</H2>
          <ul className="list-disc pl-5">
            <li>
              <strong>Mercado Pago</strong> — processamento de pagamentos e antifraude
              (operador/controlador próprio);
            </li>
            <li>
              <strong>Lovable e Supabase</strong> — hospedagem do site, banco de dados e
              autenticação;
            </li>
            <li>
              <strong>Provedor de e-mail</strong> — envio das mensagens transacionais a
              partir de notify.{EMPRESA.site};
            </li>
            <li>
              <strong>Google Analytics</strong> — métricas de uso, somente com seu
              consentimento;
            </li>
            <li>
              <strong>Equipe de entrega</strong> — recebe nome, endereço, telefone e itens
              do pedido, apenas para entregar;
            </li>
            <li>
              Autoridades públicas e Judiciário, quando houver obrigação legal ou ordem
              judicial.
            </li>
          </ul>
          <p>
            Não vendemos seus dados. Alguns desses parceiros podem processar informações
            fora do Brasil; nesses casos, a transferência internacional se apoia nas
            hipóteses do art. 33 da LGPD e em cláusulas contratuais de proteção.
          </p>

          <H2>5. Por quanto tempo guardamos</H2>
          <ul className="list-disc pl-5">
            <li>Dados de pedido e fiscais: 5 anos, por obrigação legal e fiscal;</li>
            <li>Registros de acesso da aplicação: 6 meses (Marco Civil, art. 15);</li>
            <li>Dados da conta: enquanto a conta existir e por até 5 anos depois, para defesa em eventual disputa;</li>
            <li>Consentimento de cookies: até 12 meses ou até você alterar sua escolha.</li>
          </ul>
          <p>Encerrados os prazos, os dados são eliminados ou anonimizados.</p>

          <H2>6. Seus direitos como titular</H2>
          <p>A qualquer momento você pode (art. 18 da LGPD):</p>
          <ul className="list-disc pl-5">
            <li>Confirmar a existência de tratamento e acessar seus dados;</li>
            <li>Corrigir dados incompletos, inexatos ou desatualizados;</li>
            <li>Solicitar anonimização, bloqueio ou eliminação de dados desnecessários;</li>
            <li>Solicitar portabilidade a outro fornecedor;</li>
            <li>Obter informação sobre com quem compartilhamos seus dados;</li>
            <li>Revogar o consentimento e saber as consequências da negativa;</li>
            <li>Opor-se a tratamento feito com base em legítimo interesse;</li>
            <li>Peticionar à ANPD (gov.br/anpd).</li>
          </ul>
          <p>
            Para exercer qualquer direito, escreva para{" "}
            <a className="text-primary underline" href={`mailto:${EMPRESA.email}`}>
              {EMPRESA.email}
            </a>
            . Respondemos em até 15 dias; podemos pedir informações para confirmar sua
            identidade e, em alguns casos, manter dados que a lei nos obriga a guardar.
          </p>

          <H2>7. Cookies e tecnologias similares</H2>
          <ul className="list-disc pl-5">
            <li>
              <strong>Essenciais:</strong> mantêm o carrinho, a sessão de login e a
              segurança. Sem eles a loja não funciona, por isso não dependem de
              consentimento;
            </li>
            <li>
              <strong>Analíticos (Google Analytics):</strong> medem visitas e navegação de
              forma agregada. Só são ativados se você aceitar no banner;
            </li>
            <li>
              Você pode aceitar ou recusar os analíticos no banner da primeira visita,
              mudar a escolha depois pelo mesmo banner e bloquear cookies nas
              configurações do seu navegador.
            </li>
          </ul>

          <H2>8. Segurança e incidentes</H2>
          <p>
            Adotamos medidas técnicas e administrativas de proteção: criptografia em
            trânsito (HTTPS), senhas com hash, controle de acesso por perfil, regras de
            acesso no banco de dados, limitação de tentativas e registro de operações
            sensíveis. Nenhum sistema é totalmente imune: em caso de incidente com risco
            relevante, comunicaremos você e a ANPD nos prazos legais.
          </p>

          <H2>9. Decisões automatizadas</H2>
          <p>
            Não tomamos decisões exclusivamente automatizadas sobre você. As análises
            antifraude do Mercado Pago podem recusar uma transação; nesse caso, você pode
            pedir revisão pelos nossos canais de atendimento.
          </p>

          <H2>10. Alterações desta política</H2>
          <p>
            Podemos atualizar esta política para refletir mudanças legais ou de operação. A
            versão vigente fica sempre nesta página, com a data de última atualização.
          </p>

          <H2>11. Contato</H2>
          <p>
            <strong>{EMPRESA.nomeFantasia}</strong>
            <br />
            {EMPRESA.endereco}
            <br />
            E-mail: {EMPRESA.email}
            <br />
            WhatsApp: {EMPRESA.whatsapp}
            <br />
            Instagram: {EMPRESA.instagram}
          </p>
          <p>
            Veja também os{" "}
            <Link className="text-primary underline" to="/termos">
              Termos de Uso e Condições de Venda
            </Link>
            .
          </p>
        </section>
      </main>
    </div>
  );
}
