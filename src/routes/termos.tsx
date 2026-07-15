import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — Carbo do Bem" },
      {
        name: "description",
        content:
          "Termos e condições de uso da loja online Carbo do Bem para compra de refeições ultra-congeladas.",
      },
    ],
  }),
  component: TermosPage,
});

const HOJE = new Date().toLocaleDateString("pt-BR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

function TermosPage() {
  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-3xl px-4 py-10">
        <Link to="/" className="text-xs font-semibold text-primary">
          ← voltar à loja
        </Link>
        <h1 className="mt-2 font-display text-3xl font-bold">Termos de Uso</h1>
        <p className="mt-1 text-sm text-muted-foreground">Última atualização: {HOJE}</p>

        <section className="prose prose-sm mt-6 max-w-none space-y-5 text-foreground">
          <p>
            Ao acessar e realizar pedidos em <strong>carbodobem.com.br</strong>, você
            concorda com os termos abaixo. Leia com atenção antes de finalizar a compra.
          </p>

          <h2 className="font-display text-xl font-bold">1. A loja</h2>
          <p>
            A Carbo do Bem comercializa refeições artesanais ultra-congeladas com
            entrega agendada em Brasília/DF. O prazo de entrega e a taxa são calculados
            de acordo com o CEP informado no checkout.
          </p>

          <h2 className="font-display text-xl font-bold">2. Cadastro e conta</h2>
          <ul className="list-disc pl-5">
            <li>
              O cliente deve fornecer informações verdadeiras e mantê-las atualizadas;
            </li>
            <li>A conta é pessoal e intransferível;</li>
            <li>
              O cliente é responsável por manter a senha em sigilo e por atividades
              feitas em sua conta.
            </li>
          </ul>

          <h2 className="font-display text-xl font-bold">3. Pedidos e pagamento</h2>
          <ul className="list-disc pl-5">
            <li>
              Os pedidos são confirmados apenas após a aprovação do pagamento pelo{" "}
              <strong>Mercado Pago</strong> (PIX, cartão ou boleto);
            </li>
            <li>
              Preços e disponibilidade podem mudar sem aviso prévio. O valor válido é o
              exibido no momento da finalização do pedido;
            </li>
            <li>
              Nos reservamos o direito de recusar ou cancelar pedidos por indisponibilidade
              de estoque, erro de precificação ou suspeita de fraude, com estorno
              integral do valor pago.
            </li>
          </ul>

          <h2 className="font-display text-xl font-bold">4. Entrega</h2>
          <ul className="list-disc pl-5">
            <li>Atendemos as regiões cadastradas em nossa área de cobertura;</li>
            <li>
              O cliente ou pessoa autorizada deve estar disponível no endereço no
              horário escolhido para receber o pedido congelado;
            </li>
            <li>
              Caso não seja possível entregar por ausência ou endereço incorreto, uma
              segunda tentativa pode ter custo adicional.
            </li>
          </ul>

          <h2 className="font-display text-xl font-bold">5. Trocas, cancelamento e reembolso</h2>
          <p>
            Conforme o Código de Defesa do Consumidor (art. 49), você pode desistir da
            compra em até <strong>7 dias corridos</strong> a partir do recebimento,
            desde que o produto esteja lacrado e em perfeitas condições. Por se tratar
            de produto alimentício congelado, produtos com lacre violado ou fora da
            temperatura de conservação não poderão ser aceitos para devolução, salvo
            em caso de defeito de fabricação. Reembolsos são efetuados no mesmo método
            de pagamento em até 10 dias úteis.
          </p>

          <h2 className="font-display text-xl font-bold">6. Uso adequado</h2>
          <p>
            O cliente concorda em usar o site apenas para fins lícitos e a não tentar
            interferir em seu funcionamento, coletar dados de outros usuários ou
            burlar mecanismos de segurança.
          </p>

          <h2 className="font-display text-xl font-bold">7. Propriedade intelectual</h2>
          <p>
            Marca, logotipo, imagens, textos e conteúdo do site são de propriedade da
            Carbo do Bem e não podem ser reproduzidos sem autorização.
          </p>

          <h2 className="font-display text-xl font-bold">8. Limitação de responsabilidade</h2>
          <p>
            A Carbo do Bem não se responsabiliza por danos decorrentes de uso inadequado
            dos produtos, armazenamento fora da temperatura recomendada ou informações
            incorretas fornecidas pelo cliente.
          </p>

          <h2 className="font-display text-xl font-bold">9. Alterações</h2>
          <p>
            Podemos atualizar estes Termos a qualquer momento. A versão vigente estará
            sempre nesta página, com a data de última atualização.
          </p>

          <h2 className="font-display text-xl font-bold">10. Foro e lei aplicável</h2>
          <p>
            Estes Termos são regidos pelas leis brasileiras. Fica eleito o foro da
            comarca de Brasília/DF para dirimir eventuais controvérsias, com renúncia
            a qualquer outro por mais privilegiado que seja.
          </p>

          <p>
            Dúvidas? Fale com a gente em{" "}
            <a
              className="text-primary underline"
              href="mailto:atendimento@carbodobem.com.br"
            >
              atendimento@carbodobem.com.br
            </a>{" "}
            ou pelo WhatsApp +55 61 99452-9009.
          </p>
        </section>
      </main>
    </div>
  );
}
