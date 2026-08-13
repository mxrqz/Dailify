import { toast } from "sonner";

import { AppHeader } from "@/components/app-header";
import { DayList } from "@/components/dashboard/day-list";
import { DaySummary } from "@/components/dashboard/day-summary";
import { TaskComposer } from "@/components/dashboard/task-composer";

/**
 * O shell do app. Declara `bg-surface-page` explicitamente: o `body` é `bg-canvas`
 * (`global.css:323`), que no dark é 6,5 pontos de L mais claro e tingido de azul — a landing escapa
 * pelo mesmo motivo, declarando a superfície no seu `<main>`.
 *
 * Quem rola é a página: nada aqui tem altura fixa nem scroll próprio.
 */
export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col bg-surface-page text-foreground" id="main">
      <AppHeader className="px-gutter" />

      <div className="flex flex-col gap-5 px-gutter py-6">
        <DaySummary />

        {/* ponytail: onSubmit só ecoa o que foi digitado — interpretar "terça às 10" exige a IA
            do Pro+AI, que ainda não existe neste caminho. */}
        <TaskComposer
          onSubmit={(values) =>
            toast.message(values.text, { description: values.date?.toString() ?? values.when })
          }
        />

        <DayList />
      </div>
    </main>
  );
}
