import { createFileRoute, Link } from "@tanstack/react-router";
import { EMPRESA } from "@/lib/empresa";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso e Condições de Venda — Carbo do Bem" },
      {
        name: "description",
        content:
          "Termos de uso, condições de venda, entrega, trocas e direito de arrependimento da loja online Carbo do Bem, em Brasília/DF.",
      },
      { property: "og:title", content: "Termos de Uso e Condições de Venda — Carbo do Bem" },
      {
        property: "og:description",
        content:
          "Condições de venda, entrega, cancelamento e reembolso da loja Carbo do Bem, conforme o Código de Defesa do Consumidor.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Termos de Uso e Condições de Venda — Carbo do Bem" },
      {
        name: "twitter:description",
        content:
          "Condições de venda, entrega, cancelamento e reembolso da loja Carbo do Bem, conforme o Código de Defesa do Consumidor.",
      },
    ],
  }),
  component: TermosPage,
});

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-xl font-bold">{children}</h2>;
}

function TermosPage() {
  const identificado = EMPRESA.razaoSocial && EMPRESA.cnpj;

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Link to="/" className="text-xs font-semibold text-primary">
          ← voltar à loja
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold">
          Termos de Uso e Condições de Venda
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Última atualização: {EMPRESA.atualizadoEm}
        </p>

        <section className="prose prose-sm mt-6 max-w-none space-y-5 text-foreground">
          <p>
            Ao acessar <strong>{EMPRESA.site}</strong> e realizar pedidos, você concorda
            com as condições abaixo. Estes Termos seguem o Código de Defesa do Consumidor
            (Lei nº 8.078/1990), o Decreto nº 7.962/2013 (comércio eletrônico), o Marco
            Civil da Internet (Lei nº 12.965/2014) e a LGPD (Lei nº 13.709/2018).
          </p>

          <H2>1. Quem somos</H2>
          <p>
            <strong>{EMPRESA.nomeFantasia}</strong>
            {identificado ? (
              <>
                <br />
                Razão social: {EMPRESA.razaoSocial}
                <br />
                CNPJ: {EMPRESA.cnpj}
              </>
            ) : null}
            <br />
            Endereço: {EMPRESA.endereco}
            <br />
            E-mail: {EMPRESA.email}
            <br />
            WhatsApp: {EMPRESA.whatsapp}
          </p>
          {!identificado ? (
            <p className="text-muted-foreground">
              A razão social e o CNPJ completos constam na nota fiscal e no e-mail de
              confirmação do pedido e podem ser solicitados pelos canais de atendimento
              acima.
            </p>
          ) : null}
          <p>
            Comercializamos refeições artesanais ultracongeladas com entrega agendada em
            Brasília/DF.
          </p>

          <H2>2. Atendimento ao cliente</H2>
          <p>
            Atendemos por e-mail ({EMPRESA.email}), WhatsApp ({EMPRESA.whatsapp}) e
            Instagram ({EMPRESA.instagram}).
          </p>

          <H2>3. Capacidade para contratar</H2>
          <p>
            A compra é destinada a pessoas maiores de 18 anos e civilmente capazes.
            Menores de 18 anos somente podem comprar com assistência dos pais ou
            responsáveis legais.
          </p>

          <H2>4. Cadastro e conta</H2>
          <ul className="list-disc pl-5">
            <li>É possível comprar como visitante, sem criar conta;</li>
            <li>O cliente deve fornecer informações verdadeiras e mantê-las atualizadas;</li>
            <li>A conta é pessoal e intransferível;</li>
            <li>
              O cliente é responsável por manter a senha em sigilo e pelas atividades
              feitas em sua conta.
            </li>
          </ul>

          <H2>5. Produtos, preços e informações</H2>
          <ul className="list-disc pl-5">
            <li>
              Cada produto informa nome, descrição, gramatura e preço. As fotos são
              ilustrativas e podem ter pequenas variações de apresentação;
            </li>
            <li>
              Informações de ingredientes, alergênicos (conforme RDC ANVISA nº 727/2022)
              e modo de preparo constam no rótulo da embalagem e podem ser solicitadas
              antes da compra pelos nossos canais de atendimento;
            </li>
            <li>
              Antes de concluir o pedido, exibimos o resumo com itens, quantidades, taxa
              de entrega e <strong>valor total</strong>, sem custos ocultos;
            </li>
            <li>
              Preços e disponibilidade podem mudar sem aviso prévio; vale o valor exibido
              no momento da finalização do pedido;
            </li>
            <li>
              Em caso de erro evidente de preço, indisponibilidade de estoque ou suspeita
              de fraude, podemos recusar ou cancelar o pedido, com estorno integral.
            </li>
          </ul>

          <H2>6. Pagamento</H2>
          <ul className="list-disc pl-5">
            <li>
              Os pagamentos são processados pelo <strong>Mercado Pago</strong> (Pix ou
              cartão de crédito). Não temos acesso aos dados completos do seu cartão;
            </li>
            <li>
              O parcelamento com juros, quando disponível, tem as condições e o valor
              total com encargos exibidos antes da confirmação;
            </li>
            <li>
              O pedido só é confirmado após a aprovação do pagamento. Pix não pago expira
              e o pedido é cancelado automaticamente;
            </li>
            <li>
              Enviamos a confirmação do pedido por e-mail imediatamente após a aprovação,
              com o resumo da compra e o link de acompanhamento.
            </li>
          </ul>

          <H2>7. Entrega</H2>
          <ul className="list-disc pl-5">
            <li>
              Entregamos nas regiões cadastradas em nossa área de cobertura, verificada
              pelo CEP no checkout;
            </li>
            <li>
              A entrega ocorre na data e no turno escolhidos (9h–12h, 12h–15h ou
              15h–18h). O prazo e a taxa aparecem antes do pagamento;
            </li>
            <li>
              O cliente ou pessoa autorizada deve estar no endereço no turno escolhido,
              pois o produto é congelado e não pode ficar exposto;
            </li>
            <li>
              Se a entrega não for possível por ausência, endereço incorreto ou acesso
              impedido, entramos em contato para reagendar; a nova tentativa pode ter
              custo adicional;
            </li>
            <li>
              Após o recebimento, o produto deve ser mantido em freezer a -18 °C.
              Recomendamos conferir a embalagem no momento da entrega.
            </li>
          </ul>

          <H2>8. Direito de arrependimento (7 dias)</H2>
          <p>
            Por ser compra fora do estabelecimento, você pode desistir em até{" "}
            <strong>7 dias corridos</strong> contados do recebimento, sem precisar
            justificar (art. 49 do CDC). Basta avisar por e-mail ou WhatsApp. Os valores
            pagos, inclusive a taxa de entrega, são devolvidos integralmente.
          </p>
          <p>
            Por segurança alimentar, a devolução dos produtos depende de o lacre estar
            intacto e de o item ter sido conservado congelado. Produtos abertos,
            descongelados ou consumidos não podem ser recolhidos para revenda, mas isso
            não afasta seus direitos em caso de vício ou defeito (item 9). A retirada é
            combinada com nossa equipe, sem custo para você.
          </p>

          <H2>9. Produto com problema, troca e reembolso</H2>
          <ul className="list-disc pl-5">
            <li>
              Produto avariado, fora da validade, descongelado na entrega ou diferente do
              pedido: avise em até <strong>24 horas</strong> do recebimento, com fotos, e
              faremos a troca ou o reembolso integral;
            </li>
            <li>
              Para produtos alimentícios perecíveis, o prazo legal de reclamação por
              vício aparente é de <strong>30 dias</strong> (art. 26, I, do CDC);
            </li>
            <li>
              Reembolsos são feitos no mesmo meio de pagamento: no Pix, em até 5 dias
              úteis após a confirmação; no cartão, o estorno depende do prazo da
              administradora, podendo aparecer na fatura seguinte.
            </li>
          </ul>

          <H2>10. Cancelamento antes da entrega</H2>
          <p>
            Pedidos podem ser cancelados sem custo enquanto não estiverem em preparo.
            Após o início do preparo, entre em contato: avaliaremos o cancelamento ou o
            reagendamento da entrega.
          </p>

          <H2>11. Uso adequado do site</H2>
          <p>
            O cliente concorda em usar o site apenas para fins lícitos e a não tentar
            interferir em seu funcionamento, coletar dados de outros usuários, aplicar
            engenharia reversa ou burlar mecanismos de segurança.
          </p>

          <H2>12. Propriedade intelectual</H2>
          <p>
            Marca, logotipo, imagens, receitas, textos e demais conteúdos do site
            pertencem à {EMPRESA.nomeFantasia} e não podem ser reproduzidos sem
            autorização por escrito.
          </p>

          <H2>13. Responsabilidade</H2>
          <p>
            Respondemos pelos nossos produtos e serviços nos limites do Código de Defesa
            do Consumidor. Não respondemos por danos decorrentes de conservação
            inadequada após a entrega, preparo fora das instruções do rótulo,
            informações incorretas fornecidas no pedido ou indisponibilidades de
            internet, do provedor de pagamento e de outros serviços de terceiros.
          </p>

          <H2>14. Privacidade e dados pessoais</H2>
          <p>
            O tratamento dos seus dados está descrito na{" "}
            <Link className="text-primary underline" to="/privacidade">
              Política de Privacidade
            </Link>
            , parte integrante destes Termos.
          </p>

          <H2>15. Alterações destes Termos</H2>
          <p>
            Podemos atualizar estes Termos a qualquer momento. A versão vigente estará
            sempre nesta página, com a data de última atualização; as condições aplicáveis
            ao seu pedido são as vigentes na data da compra.
          </p>

          <H2>16. Lei aplicável e foro</H2>
          <p>
            Estes Termos são regidos pelas leis brasileiras. Fica eleito o foro do
            domicílio do consumidor para dirimir eventuais controvérsias, conforme o art.
            101, I, do CDC.
          </p>

          <p>
            Dúvidas? Fale com a gente em{" "}
            <a className="text-primary underline" href={`mailto:${EMPRESA.email}`}>
              {EMPRESA.email}
            </a>{" "}
            ou pelo{" "}
            <a
              className="text-primary underline"
              href={EMPRESA.whatsappLink}
              target="_blank"
              rel="noreferrer"
            >
              WhatsApp {EMPRESA.whatsapp}
            </a>
            . Você também pode recorrer ao Procon-DF ou ao portal consumidor.gov.br.
          </p>
        </section>
      </main>
    </div>
  );
}
