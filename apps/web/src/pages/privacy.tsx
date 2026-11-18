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
      updated="Última atualização: 17 de novembro de 2026"
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
                <strong>Conta e autenticação:</strong> nome, e-mail, foto (quando você entra com o
                Google), plano e as sessões ativas (endereço IP e navegador/dispositivo, para você
                ver e encerrar cada uma). O login é feito por link enviado ao seu e-mail ou pelo
                Google; a autenticação é nossa, rodando na nossa infraestrutura (Cloudflare).
              </li>
              <li>
                <strong>Tarefas e preferências:</strong> títulos, descrições, datas, prioridades e
                demais dados que você cria no app, além de preferências como fuso horário e início
                da semana, armazenados na nossa base (Cloudflare D1).
              </li>
              <li>
                <strong>Pagamentos:</strong> processados pela Stripe. Não armazenamos dados de
                cartão; recebemos apenas metadados da assinatura (plano, status, últimos dígitos).
              </li>
              <li>
                <strong>Recursos de IA:</strong> quando você cria tarefas por voz ou por texto com
                IA, o áudio ou o texto é enviado à OpenAI para transcrição e interpretação. Esses
                dados não são usados para treinar modelos e são processados apenas para gerar sua
                tarefa.
              </li>
              <li>
                <strong>Google Agenda (opcional):</strong> se você conectar sua agenda, pedimos
                acesso para ver, criar, alterar e excluir eventos nas agendas que são suas (escopo{" "}
                <code>calendar.events.owned</code>), usado só para sincronizar suas tarefas. Os
                tokens de acesso ficam cifrados (AES-256-GCM) na nossa base. Você pode desconectar a
                qualquer momento.
              </li>
              <li>
                <strong>Notificações:</strong> se você ativar lembretes, guardamos o endereço de
                entrega do seu navegador ou dispositivo para enviar as notificações push.
              </li>
            </ul>
          ),
        },
        {
          title: "Como usamos os dados",
          body: (
            <p>
              Para operar e melhorar o serviço, autenticar você, enviar o link de acesso e os
              lembretes, processar pagamentos, gerar tarefas com IA, sincronizar sua agenda e
              cumprir obrigações legais. A base legal inclui execução do contrato, consentimento
              (IA, notificações e integrações) e legítimo interesse (segurança e prevenção de
              abuso).
            </p>
          ),
        },
        {
          title: "Compartilhamento com terceiros",
          body: (
            <>
              <p>
                Compartilhamos dados apenas com os operadores necessários ao funcionamento:
                Cloudflare (hospedagem, banco de dados, envio de e-mails e verificação anti-robô),
                Stripe (pagamentos), OpenAI (IA de voz e texto), Google (login e Google Agenda,
                quando você usa) e o serviço de push do seu navegador ou sistema (entrega das
                notificações). Cada um trata os dados conforme suas próprias políticas. Não vendemos
                seus dados.
              </p>
              <p>
                O uso e a transferência de informações recebidas das APIs do Google seguem a{" "}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noreferrer"
                >
                  Política de Dados do Usuário dos Serviços de API do Google
                </a>
                , incluindo os requisitos de Uso Limitado.
              </p>
            </>
          ),
        },
        {
          title: "Retenção e exclusão",
          body: (
            <p>
              Mantemos seus dados enquanto sua conta estiver ativa. Você pode excluir a conta a
              qualquer momento pelo próprio app: isso apaga suas tarefas e dados, cancela a
              assinatura e revoga as integrações conectadas. Registros de cobrança podem ser retidos
              pela Stripe pelo período exigido por lei.
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
              Adotamos medidas técnicas e organizacionais para proteger seus dados: criptografia em
              trânsito, tokens de integrações cifrados em repouso, links de acesso de uso único que
              expiram em 10 minutos, sessões que você pode encerrar a qualquer momento e controle de
              acesso por usuário. Nenhum sistema é 100% seguro, mas trabalhamos para minimizar
              riscos.
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
