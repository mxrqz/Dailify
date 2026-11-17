import { copy } from "@/components/dashboard/copy";
import { LegalPage, Placeholder } from "@/components/legal-page";

// NOTE: template app-specific de Política de Privacidade. Preencha os campos [entre colchetes]
// e faça uma revisão jurídica antes de considerar isto final.
export default function PrivacyPage() {
  return (
    <LegalPage
      pageTitle="Mewki - Política de Privacidade"
      bar={copy.legal.privacy.bar}
      title="Política de Privacidade"
      updated="Última atualização: 3 de agosto de 2026"
      intro={
        <>
          Esta Política descreve como a Mewki ("nós") coleta, usa e protege seus dados pessoais, em
          conformidade com a Lei Geral de Proteção de Dados (LGPD, Lei nº 13.709/2018). Controlador
          dos dados: <Placeholder>[Nome da empresa/responsável]</Placeholder>, contato:{" "}
          <Placeholder>[e-mail de contato]</Placeholder>.
        </>
      }
      contact={copy.legal.privacy.contact}
      contactEmail={<Placeholder>[e-mail de contato]</Placeholder>}
      sections={[
        {
          title: "Dados que coletamos",
          body: (
            <ul>
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
          ),
        },
        {
          title: "Como usamos os dados",
          body: (
            <p>
              Para operar e melhorar o serviço, autenticar você, processar pagamentos, gerar tarefas
              por voz e cumprir obrigações legais. A base legal inclui execução do contrato,
              consentimento (voz) e legítimo interesse.
            </p>
          ),
        },
        {
          title: "Compartilhamento com terceiros",
          body: (
            <p>
              Compartilhamos dados apenas com os operadores necessários ao funcionamento: Clerk
              (identidade), Stripe (pagamentos), OpenAI (transcrição de voz) e Cloudflare
              (hospedagem e banco de dados). Cada um trata os dados conforme suas próprias
              políticas.
            </p>
          ),
        },
        {
          title: "Retenção e exclusão",
          body: (
            <p>
              Mantemos seus dados enquanto sua conta estiver ativa. Você pode solicitar a exclusão a
              qualquer momento; alguns registros podem ser retidos pelo período exigido por lei.
            </p>
          ),
        },
        {
          title: "Seus direitos (LGPD)",
          body: (
            <p>
              Você pode solicitar acesso, correção, portabilidade, anonimização ou exclusão dos seus
              dados, além de revogar consentimentos. Para exercer esses direitos, contate{" "}
              <Placeholder>[e-mail de contato]</Placeholder>.
            </p>
          ),
        },
        {
          title: "Segurança",
          body: (
            <p>
              Adotamos medidas técnicas e organizacionais para proteger seus dados, incluindo
              criptografia em trânsito e controle de acesso por usuário. Nenhum sistema é 100%
              seguro, mas trabalhamos para minimizar riscos.
            </p>
          ),
        },
        {
          title: "Alterações",
          body: (
            <p>
              Podemos atualizar esta Política periodicamente. Mudanças relevantes serão comunicadas
              no app ou por e-mail.
            </p>
          ),
        },
      ]}
    />
  );
}
