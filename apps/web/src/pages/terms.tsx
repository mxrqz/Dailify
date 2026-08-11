import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { SiteHeader } from "@/components/site-header";

// NOTE: template app-specific de Termos de Uso. Preencha os campos [entre colchetes]
// e faça uma revisão jurídica antes de considerar isto final.
export default function TermsPage() {
  return (
    <>
      <Helmet>
        <title>Dailify - Termos de Uso</title>
      </Helmet>

      <SiteHeader className="px-[clamp(1rem,5vw,24rem)]" />

      <main className="px-[clamp(1rem,5vw,24rem)] py-12 bg-background text-foreground">
        <div className="mx-auto max-w-3xl flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold">Termos de Uso</h1>
            <p className="text-sm text-muted-foreground">Última atualização: 3 de agosto de 2026</p>
          </div>

          <p className="text-muted-foreground">
            Estes Termos regem o uso do Dailify ("serviço"), operado por [Nome da
            empresa/responsável] ("nós"). Ao criar uma conta ou usar o serviço, você concorda com
            estes Termos.
          </p>

          <section className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold">1. O serviço</h2>
            <p className="text-muted-foreground">
              O Dailify é um app de gerenciamento de tarefas com recursos gratuitos e pagos (planos
              Free, Pro e Pro+AI). Podemos alterar ou descontinuar funcionalidades, com aviso quando
              razoável.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold">2. Conta</h2>
            <p className="text-muted-foreground">
              Você é responsável por manter suas credenciais seguras e por toda atividade na sua
              conta. A autenticação é feita via nosso provedor de identidade (Clerk).
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold">3. Planos, cobrança e cancelamento</h2>
            <ul className="list-disc pl-6 text-muted-foreground flex flex-col gap-1">
              <li>
                Os planos pagos são cobrados via Stripe, de forma recorrente (mensal ou anual).
              </li>
              <li>
                Você pode cancelar a qualquer momento; o acesso premium permanece até o fim do
                período já pago. Não há reembolso proporcional, salvo quando exigido por lei.
              </li>
              <li>Os limites de cada plano estão descritos na página de planos.</li>
            </ul>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold">4. Uso aceitável</h2>
            <p className="text-muted-foreground">
              Você concorda em não usar o serviço para fins ilegais, não tentar burlar limites de
              plano, não abusar dos recursos de IA/voz e não comprometer a segurança ou a
              disponibilidade do sistema.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold">5. Recursos de IA</h2>
            <p className="text-muted-foreground">
              A criação de tarefas por voz usa serviços de IA de terceiros (OpenAI). As
              interpretações são automáticas e podem conter erros; revise as tarefas geradas.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold">6. Conteúdo do usuário</h2>
            <p className="text-muted-foreground">
              Você mantém a titularidade das suas tarefas e dados. Concede a nós apenas a licença
              necessária para operar o serviço (armazenar e processar seus dados para você).
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold">7. Limitação de responsabilidade</h2>
            <p className="text-muted-foreground">
              O serviço é fornecido "no estado em que se encontra". Na máxima extensão permitida em
              lei, não nos responsabilizamos por danos indiretos ou perda de dados decorrentes do
              uso do serviço.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold">8. Alterações e contato</h2>
            <p className="text-muted-foreground">
              Podemos atualizar estes Termos; mudanças relevantes serão comunicadas. Foro:
              [cidade/UF]. Dúvidas: [e-mail de contato]. Veja também nossa{" "}
              <Link to="/privacidade" className="text-primary hover:underline">
                Política de Privacidade
              </Link>
              .
            </p>
          </section>

          <div className="pt-4">
            <Link to="/" className="text-primary hover:underline">
              ← Voltar ao início
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
