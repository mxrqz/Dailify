import type { Task, Repeat } from "@dailify/shared";

export type {
  Task as TaskProps,
  Entitlements,
  Permissions as PermissionsProps,
  PaymentDetails as PaymentDetailsProps,
  Invoice as InvoicesProps,
} from "@dailify/shared";

export interface PriorityPickerProps {
  onSelectedPriority: (selectedPriority: number) => void;
  task?: Task;
}

export interface TagsPickerProps {
  onSelectedTags: (selectedTags: string[]) => void;
  task?: Task;
}

export interface RepeatPickerProps {
  onSelectedRepeat: (selectedRepeat: Repeat) => void;
  task?: Task;
}

export interface FormDataValues {
  firstName: string;
  lastName: string;
  username: string;
}
