import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { SiteHeader } from "@/components/site-header";

// NOTE: template app-specific de Política de Privacidade. Preencha os campos [entre colchetes]
// e faça uma revisão jurídica antes de considerar isto final.
export default function PrivacyPage() {
  return (
    <>
      <Helmet>
        <title>Dailify - Política de Privacidade</title>
      </Helmet>

      <SiteHeader className="px-[clamp(1rem,5vw,24rem)]" />

      <main className="px-[clamp(1rem,5vw,24rem)] py-12 bg-background text-foreground">
        <div className="mx-auto max-w-3xl flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold">Política de Privacidade</h1>
            <p className="text-sm text-muted-foreground">Última atualização: 3 de agosto de 2026</p>
          </div>

          <p className="text-muted-foreground">
            Esta Política descreve como o Dailify ("nós") coleta, usa e protege seus dados pessoais,
            em conformidade com a Lei Geral de Proteção de Dados (LGPD, Lei nº 13.709/2018).
            Controlador dos dados: [Nome da empresa/responsável], contato: [e-mail de contato].
          </p>

          <section className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold">1. Dados que coletamos</h2>
            <ul className="list-disc pl-6 text-muted-foreground flex flex-col gap-1">
              <li>
                <strong>Conta e autenticação:</strong> nome, e-mail, sessões e metadados de plano,
                geridos pelo nosso provedor de identidade (Clerk).
              </li>
              <li>
                <strong>Tarefas:</strong> títulos, descrições, datas, prioridades e demais dados que
                você cria no app, armazenados na nossa base (Cloudflare D1).
              </li>
              <li>
                <strong>Pagamentos:</strong> processados pela Stripe. Não armazenamos dados de
                cartão; recebemos apenas metadados da assinatura (plano, status, últimos dígitos).
              </li>
              <li>
                <strong>Voz (planos com IA):</strong> quando você cria tarefas por voz, o áudio é
                enviado à OpenAI para transcrição e interpretação. O áudio não é usado para treinar
                modelos e é processado apenas para gerar sua tarefa.
              </li>
            </ul>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold">2. Como usamos os dados</h2>
            <p className="text-muted-foreground">
              Para operar e melhorar o serviço, autenticar você, processar pagamentos, gerar tarefas
              por voz e cumprir obrigações legais. A base legal inclui execução do contrato,
              consentimento (voz) e legítimo interesse.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold">3. Compartilhamento com terceiros</h2>
            <p className="text-muted-foreground">
              Compartilhamos dados apenas com os operadores necessários ao funcionamento: Clerk
              (identidade), Stripe (pagamentos), OpenAI (transcrição de voz) e Cloudflare
              (hospedagem e banco de dados). Cada um trata os dados conforme suas próprias
              políticas.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold">4. Retenção e exclusão</h2>
            <p className="text-muted-foreground">
              Mantemos seus dados enquanto sua conta estiver ativa. Você pode solicitar a exclusão a
              qualquer momento; alguns registros podem ser retidos pelo período exigido por lei.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold">5. Seus direitos (LGPD)</h2>
            <p className="text-muted-foreground">
              Você pode solicitar acesso, correção, portabilidade, anonimização ou exclusão dos seus
              dados, além de revogar consentimentos. Para exercer esses direitos, contate [e-mail de
              contato].
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold">6. Segurança</h2>
            <p className="text-muted-foreground">
              Adotamos medidas técnicas e organizacionais para proteger seus dados, incluindo
              criptografia em trânsito e controle de acesso por usuário. Nenhum sistema é 100%
              seguro, mas trabalhamos para minimizar riscos.
            </p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold">7. Alterações</h2>
            <p className="text-muted-foreground">
              Podemos atualizar esta Política periodicamente. Mudanças relevantes serão comunicadas
              no app ou por e-mail.
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
