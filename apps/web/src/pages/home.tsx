import { useState } from "react";

import { DayList } from "@/components/dashboard/day-list";
import { MobilePager } from "@/components/dashboard/mobile-pager";
import { UndatedList } from "@/components/dashboard/undated-list";
import { UndatedColumn, useUndatedOpen } from "@/components/dashboard/undated-column";
import { WeekStrip } from "@/components/dashboard/week-strip";
import { CreateFab } from "@/components/dashboard/create-fab";
import type { ComposerValues } from "@/components/dashboard/task-composer";
import { useCreateTask } from "@/hooks/useCreateTask";
import { useMediaQuery } from "@/hooks/useMediaQuery";

/** O dashboard: agenda (faixa da semana + lista) e a Sem data ao lado, ou em outra tela no mobile. */
export default function Home() {
  const { create, submitting } = useCreateTask();

  const desktop = useMediaQuery("(min-width: 768px)");

  const [undatedOpen, setUndatedOpen] = useUndatedOpen();
  const [page, setPage] = useState<0 | 1>(0);

  const handleCompose = ({ parsed, undatedOnly }: ComposerValues) =>
    void create(parsed, { undatedOnly });

  const agenda = (
    <div className="pt-6 pb-10 md:px-gutter" id="main">
      <WeekStrip />

      <div className="mt-10">
        <DayList />
      </div>
    </div>
  );

  return (
    // Shell (md+): fundo preto com a agenda e a coluna Sem data como painéis lado a lado.
    <div className="flex min-w-0 flex-1 md:bg-surface-shell md:p-1">
      <div className="relative min-w-0 flex-1 md:rounded-field md:bg-surface-card">
        {desktop ? (
          agenda
        ) : (
          <MobilePager
            pages={[
              <div key="today" className="px-gutter">
                {agenda}
              </div>,
              <UndatedList key="undated" className="px-gutter py-4.5" />,
            ]}
            index={page}
            onIndexChange={setPage}
          />
        )}

        <CreateFab
          submitting={submitting}
          onSubmit={handleCompose}
          undatedOnly={!desktop && page === 1}
        />
      </div>

      <UndatedColumn open={undatedOpen} onOpenChange={setUndatedOpen} />
    </div>
  );
}
