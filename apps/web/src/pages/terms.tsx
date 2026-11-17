import { Link } from "react-router-dom";

import { copy } from "@/components/dashboard/copy";
import { LegalPage, Placeholder } from "@/components/legal-page";

// NOTE: template app-specific de Termos de Uso. Preencha os campos [entre colchetes]
// e faça uma revisão jurídica antes de considerar isto final.
export default function TermsPage() {
  return (
    <LegalPage
      pageTitle="Mewki - Termos de Uso"
      bar={copy.legal.terms.bar}
      title="Termos de Uso"
      updated="Última atualização: 3 de agosto de 2026"
      intro={
        <>
          Estes Termos regem o uso da Mewki ("serviço"), operado por{" "}
          <Placeholder>[Nome da empresa/responsável]</Placeholder> ("nós"). Ao criar uma conta ou
          usar o serviço, você concorda com estes Termos.
        </>
      }
      contact={copy.legal.terms.contact}
      contactEmail={<Placeholder>[e-mail de contato]</Placeholder>}
      sections={[
        {
          title: "O serviço",
          body: (
            <p>
              A Mewki é um app de gerenciamento de tarefas com recursos gratuitos e pagos (planos
              Free, Pro e Max). Podemos alterar ou descontinuar funcionalidades, com aviso quando
              razoável.
            </p>
          ),
        },
        {
          title: "Conta",
          body: (
            <p>
              Você é responsável por manter suas credenciais seguras e por toda atividade na sua
              conta. A autenticação é feita via nosso provedor de identidade (Clerk).
            </p>
          ),
        },
        {
          title: "Planos, cobrança e cancelamento",
          body: (
            <ul>
              <li>
                Os planos pagos são cobrados via Stripe, de forma recorrente (mensal ou anual).
              </li>
              <li>
                Você pode cancelar a qualquer momento; o acesso premium permanece até o fim do
                período já pago. Não há reembolso proporcional, salvo quando exigido por lei.
              </li>
              <li>Os limites de cada plano estão descritos na página de planos.</li>
            </ul>
          ),
        },
        {
          title: "Uso aceitável",
          body: (
            <p>
              Você concorda em não usar o serviço para fins ilegais, não tentar burlar limites de
              plano, não abusar dos recursos de IA/voz e não comprometer a segurança ou a
              disponibilidade do sistema.
            </p>
          ),
        },
        {
          title: "Recursos de IA",
          body: (
            <p>
              A criação de tarefas por voz usa serviços de IA de terceiros (OpenAI). As
              interpretações são automáticas e podem conter erros; revise as tarefas geradas.
            </p>
          ),
        },
        {
          title: "Conteúdo do usuário",
          body: (
            <p>
              Você mantém a titularidade das suas tarefas e dados. Concede a nós apenas a licença
              necessária para operar o serviço (armazenar e processar seus dados para você).
            </p>
          ),
        },
        {
          title: "Limitação de responsabilidade",
          body: (
            <p>
              O serviço é fornecido "no estado em que se encontra". Na máxima extensão permitida em
              lei, não nos responsabilizamos por danos indiretos ou perda de dados decorrentes do
              uso do serviço.
            </p>
          ),
        },
        {
          title: "Alterações e contato",
          body: (
            <p>
              Podemos atualizar estes Termos; mudanças relevantes serão comunicadas. Foro:{" "}
              <Placeholder>[cidade/UF]</Placeholder>. Dúvidas:{" "}
              <Placeholder>[e-mail de contato]</Placeholder>. Veja também nossa{" "}
              <Link to="/privacidade">Política de Privacidade</Link>.
            </p>
          ),
        },
      ]}
    />
  );
}
