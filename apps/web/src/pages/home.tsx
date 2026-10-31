import { DayList } from "@/components/dashboard/day-list";
import { UndatedColumn, useUndatedOpen } from "@/components/dashboard/undated-column";
import { WeekStrip } from "@/components/dashboard/week-strip";
import { CreateFab } from "@/components/dashboard/create-fab";
import { useCreateTask } from "@/hooks/useCreateTask";

/** O dashboard: agenda (faixa da semana + lista) e, no desktop, a coluna lateral. */
export default function Home() {
  const { create, submitting } = useCreateTask();

  const [undatedOpen, setUndatedOpen] = useUndatedOpen();

  return (
    // Shell (md+): fundo preto com a agenda e a coluna lateral como painéis lado a lado.
    <div className="flex min-w-0 flex-1 md:bg-surface-shell md:p-1">
      <div className="relative min-w-0 flex-1 md:flex md:flex-col md:rounded-field md:bg-surface-card">
        <div className="px-gutter pt-6 pb-10" id="main">
          <WeekStrip />

          <div className="mt-10">
            <DayList />
          </div>
        </div>

        <CreateFab submitting={submitting} onSubmit={({ parsed }) => void create(parsed)} />
      </div>

      <UndatedColumn open={undatedOpen} onOpenChange={setUndatedOpen} />
    </div>
  );
}
