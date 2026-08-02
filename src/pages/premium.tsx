import { useState } from "react"
import { Check, CheckCircle2, Sparkles, Zap } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Link } from "react-router-dom"
import Header from "@/components/header"
import { serverURL, PLAN_ID } from "@/consts/conts"
import { useAuth, useUser } from "@clerk/clerk-react"

export default function PremiumPage() {
    const { user } = useUser()
    const { getToken } = useAuth()
    const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly")

    const handleSelectPlan = async (plan: string) => {
        toast.info(`Plano ${plan} selecionado`)

        const token = await getToken();

        const productName = billingCycle === "yearly" ? `${plan}-year` : plan

        const data = {
            productName,
            customer_email: user?.primaryEmailAddress?.emailAddress,
        }

        const response = await fetch(`${serverURL}checkout`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(data)
        })

        const { url } = await response.json()

        window.location = url
    }

    const plans = [
        {
            id: "pro",
            name: "Pro",
            description: "Produtividade avançada sem IA",
            monthlyPrice: "R$ 9,90",
            yearlyPrice: "R$ 99,90",
            yearlyDiscount: "Economize R$ 19,80",
            features: [
                "Limite de 300 tarefas por mês",
                "Tarefas recorrentes",
                "Acesso a anexos e imagens",
                "Categorias ilimitadas",
                "Priorização avançada",
                "Exportação de dados",
                "Suporte prioritário",
            ],
            icon: <Zap className="h-5 w-5" />,
            color: "bg-blue-500",
            popular: false,
        },
        {
            id: "pro+ai",
            name: "Pro + IA",
            description: "Automação inteligente com IA",
            monthlyPrice: "R$ 19,90",
            yearlyPrice: "R$ 199,90",
            yearlyDiscount: "Economize R$ 38,80",
            features: [
                "Tudo do plano Pro",
                "Criar tarefas por voz",
                "Transcrição de áudio",
                "IA que sugere e organiza tarefas",
                "Resumos inteligentes de tarefas",
                "Análise de produtividade",
                "Integração com calendários",
            ],
            icon: <Sparkles className="h-5 w-5" />,
            color: "bg-purple-500",
            popular: true,
        },
    ]

    const faqs = [
        {
            question: "Posso mudar de plano depois?",
            answer:
                "Sim, você pode fazer upgrade ou downgrade do seu plano a qualquer momento. As mudanças entrarão em vigor no próximo ciclo de cobrança.",
        },
        {
            question: "Como funciona o período de teste?",
            answer:
                "Oferecemos um período de teste gratuito de 7 dias para todos os novos usuários. Você pode experimentar todos os recursos do plano escolhido sem compromisso.",
        },
        {
            question: "Quais métodos de pagamento são aceitos?",
            answer:
                "Aceitamos cartões de crédito (Visa, Mastercard, American Express), PayPal e Pix para pagamentos no Brasil.",
        },
        {
            question: "Posso cancelar minha assinatura a qualquer momento?",
            answer:
                "Sim, você pode cancelar sua assinatura a qualquer momento através da página de configurações da sua conta. Você continuará tendo acesso aos recursos premium até o final do período pago.",
        },
        {
            question: "O que acontece se eu exceder o limite de tarefas?",
            answer:
                "Se você atingir o limite de tarefas do seu plano, ainda poderá visualizar e gerenciar suas tarefas existentes, mas não poderá criar novas até o próximo ciclo de renovação ou até fazer upgrade para um plano superior.",
        },
    ]

    return (
        <>
            <Header className="px-[clamp(1rem,5vw,24rem)]" />

            <div className="px-[clamp(1rem,5vw,24rem)] min-h-screen bg-gradient-to-br from-background to-foreground/5">
                <div className="py-12 px-4 sm:px-6 lg:py-16 lg:px-8">
                    <div className="text-center mb-12">
                        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Escolha o plano perfeito para você</h1>
                        <p className="mt-4 text-xl text-muted-foreground mx-auto">
                            Aumente sua produtividade com recursos premium e desbloqueie todo o potencial do Dailify.
                        </p>
                    </div>

                    {/* Seletor de ciclo de cobrança */}
                    <div className="flex justify-center mb-12">
                        <div className="inline-flex items-center rounded-full border p-1 bg-background">
                            <Button
                                variant={billingCycle === "monthly" ? "default" : "ghost"}
                                size="sm"
                                className="rounded-full"
                                onClick={() => setBillingCycle("monthly")}
                            >
                                Mensal
                            </Button>

                            <Button
                                variant={billingCycle === "yearly" ? "default" : "ghost"}
                                size="sm"
                                className="rounded-full"
                                onClick={() => setBillingCycle("yearly")}
                            >
                                Anual

                                <Badge variant="outline" className="ml-2 bg-green-100 text-green-800 border-green-200">
                                    -15%
                                </Badge>
                            </Button>
                        </div>
                    </div>

                    {/* Cards de planos */}
                    <div className="grid md:grid-cols-2 gap-8 mb-16">
                        {plans.map((plan) => (
                            <Card
                                key={plan.id}
                                className={`relative overflow-hidden border-2 ${plan.popular
                                    ? "border-purple-200 dark:border-purple-900"
                                    : "border-border"} transition-all hover:shadow-md`}
                            >
                                {plan.popular && (
                                    <div className="absolute top-0 right-0">
                                        <div className="bg-purple-500 text-white px-4 py-1 rounded-bl-lg text-xs font-medium">
                                            Mais popular
                                        </div>
                                    </div>
                                )}

                                <CardHeader>
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${plan.color} text-white`}>
                                            {plan.icon}
                                        </div>

                                        <CardTitle className="text-2xl">{plan.name}</CardTitle>
                                    </div>

                                    <CardDescription className="text-base">{plan.description}</CardDescription>

                                    <div className="mt-4">
                                        <div className="flex items-end">
                                            <span className="text-3xl font-bold">
                                                {billingCycle === "monthly" ? plan.monthlyPrice : plan.yearlyPrice}
                                            </span>
                                            <span className="text-muted-foreground ml-2">/{billingCycle === "monthly" ? "mês" : "ano"}</span>
                                        </div>

                                        {billingCycle === "yearly" && (
                                            <p className="text-sm text-green-600 dark:text-green-400 mt-1">{plan.yearlyDiscount}</p>
                                        )}
                                    </div>
                                </CardHeader>

                                <CardContent className="space-y-4">
                                    <ul className="space-y-3">
                                        {plan.features.map((feature, index) => (
                                            <li key={index} className="flex items-start">
                                                <CheckCircle2 className="h-5 w-5 text-green-500 mr-2 shrink-0 mt-0.5" />
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>

                                <CardFooter>
                                    <Button
                                        className={`w-full ${plan.popular ? "bg-purple-500 hover:bg-purple-600" : ""}`}
                                        onClick={() => handleSelectPlan(plan.id)}
                                    >
                                        Escolher {plan.name}
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>

                    {/* Comparação de recursos */}
                    <div className="mb-16">
                        <h2 className="text-2xl font-bold text-center mb-8">Comparação detalhada de recursos</h2>
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="border-b">
                                        <th className="py-4 px-6 text-left">Recurso</th>
                                        <th className="py-4 px-6 text-center">Gratuito</th>
                                        <th className="py-4 px-6 text-center">Pro</th>
                                        <th className="py-4 px-6 text-center">Pro + IA</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr className="border-b">
                                        <td className="py-4 px-6">Limite de tarefas</td>
                                        <td className="py-4 px-6 text-center">50 / mês</td>
                                        <td className="py-4 px-6 text-center">300 / mês</td>
                                        <td className="py-4 px-6 text-center">300 / mês</td>
                                    </tr>
                                    <tr className="border-b">
                                        <td className="py-4 px-6">Tarefas recorrentes</td>
                                        <td className="py-4 px-6 text-center">Básico</td>
                                        <td className="py-4 px-6 text-center">
                                            <Check className="h-5 w-5 text-green-500 mx-auto" />
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <Check className="h-5 w-5 text-green-500 mx-auto" />
                                        </td>
                                    </tr>
                                    <tr className="border-b">
                                        <td className="py-4 px-6">Anexos e imagens</td>
                                        <td className="py-4 px-6 text-center">—</td>
                                        <td className="py-4 px-6 text-center">
                                            <Check className="h-5 w-5 text-green-500 mx-auto" />
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <Check className="h-5 w-5 text-green-500 mx-auto" />
                                        </td>
                                    </tr>
                                    <tr className="border-b">
                                        <td className="py-4 px-6">Criar tarefas por voz</td>
                                        <td className="py-4 px-6 text-center">—</td>
                                        <td className="py-4 px-6 text-center">—</td>
                                        <td className="py-4 px-6 text-center">
                                            <Check className="h-5 w-5 text-green-500 mx-auto" />
                                        </td>
                                    </tr>
                                    <tr className="border-b">
                                        <td className="py-4 px-6">Transcrição de áudio</td>
                                        <td className="py-4 px-6 text-center">—</td>
                                        <td className="py-4 px-6 text-center">—</td>
                                        <td className="py-4 px-6 text-center">
                                            <Check className="h-5 w-5 text-green-500 mx-auto" />
                                        </td>
                                    </tr>
                                    <tr className="border-b">
                                        <td className="py-4 px-6">IA que sugere tarefas</td>
                                        <td className="py-4 px-6 text-center">—</td>
                                        <td className="py-4 px-6 text-center">—</td>
                                        <td className="py-4 px-6 text-center">
                                            <Check className="h-5 w-5 text-green-500 mx-auto" />
                                        </td>
                                    </tr>
                                    <tr className="border-b">
                                        <td className="py-4 px-6">Suporte</td>
                                        <td className="py-4 px-6 text-center">Email</td>
                                        <td className="py-4 px-6 text-center">Prioritário</td>
                                        <td className="py-4 px-6 text-center">Prioritário</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Perguntas frequentes */}
                    <div className="max-w-3xl mx-auto">
                        <h2 className="text-2xl font-bold text-center mb-8">Perguntas frequentes</h2>
                        <Accordion type="single" collapsible className="w-full">
                            {faqs.map((faq, index) => (
                                <AccordionItem key={index} value={`item-${index}`}>
                                    <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                                    <AccordionContent>{faq.answer}</AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    </div>

                    {/* CTA final */}
                    <div className="text-center mt-16">
                        <h2 className="text-2xl font-bold mb-4">Pronto para aumentar sua produtividade?</h2>
                        <p className="text-muted-foreground mb-6">
                            Experimente gratuitamente por 7 dias. Cancele a qualquer momento.
                        </p>
                        <div className="flex flex-col sm:flex-row justify-center gap-4">
                            <Button size="lg" onClick={() => handleSelectPlan(PLAN_ID.pro)}>
                                Começar com Pro
                            </Button>

                            <Button size="lg" variant="outline" onClick={() => handleSelectPlan(PLAN_ID.proAi)}>
                                Experimentar Pro + IA
                            </Button>
                        </div>
                        <p className="text-sm text-muted-foreground mt-4">
                            Já tem uma conta?{" "}

                            <Link to="/login" className="text-primary hover:underline">
                                Faça login
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </>
    )
}
