import { copy } from "@/components/dashboard/copy";
import { ActionSheet } from "@/components/kit/action-sheet";

/**
 * Escolha entre a ocorrência e a série — usada ao editar e ao excluir uma tarefa recorrente.
 * "Só esta" vem primeiro por ser o caso comum (remarcar ou pular um dia), e é a ação em destaque.
 */
export function RecurrenceScopeDialog({
  open,
  onOpenChange,
  description,
  destructive = false,
  onOccurrence,
  onSeries,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  description: string;
  /** Excluir pinta as duas opções de destrutivo: as duas tiram tarefa da tela. */
  destructive?: boolean;
  onOccurrence: () => void;
  onSeries: () => void;
}): JSX.Element {
  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      title={copy.form.scopeTitle}
      description={description}
      actions={[
        { label: copy.form.scopeOccurrence, onSelect: onOccurrence, primary: true },
        { label: copy.form.scopeSeries, onSelect: onSeries, destructive },
      ]}
    />
  );
}
