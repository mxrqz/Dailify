import { Timestamp } from "firebase/firestore";

export interface TaskProps {
  id: string;
  title: string;
  description: string;
  completed: Date[] | Timestamp[];
  duration: string;
  priority: number;
  repeat: "Off" | "Daily" | "Monthly" | "Yearly" | { Weekly: string[] | undefined };
  date: Date | Timestamp;
  alert?: Date | Timestamp;
  tags?: string[];
}

export interface DailyTasksProps {
  day: Date;
}

export interface SelectDayProps {
  onSelectedDay: (selectedDate: Date) => void;
}

export interface DatePickerProps {
  onSelectedDate: (selectedDate: Date) => void;
  id: string;
  currentSelectedDate: Date;
}

export interface TimePickerProps {
  onSelectedTime: (selectedTime: Date) => void;
  selectedDate: Date;
  task?: TaskProps;
}

export interface DurationPickerProps {
  onSelectedDuration: (selectedDuration: string) => void;
  task?: TaskProps;
}

export interface PriorityPickerProps {
  onSelectedPriority: (selectedPriority: number) => void;
  task?: TaskProps;
}

export interface TagsPickerProps {
  onSelectedTags: (selectedTags: string[]) => void;
  task?: TaskProps;
}

export interface RepeatPickerProps {
  onSelectedRepeat: (
    selectedRepeat: "Off" | "Daily" | "Monthly" | "Yearly" | { Weekly: string[] | undefined },
  ) => void;
  task?: TaskProps;
}

export interface NewTaskProps {
  onNewTask: (newTask: TaskProps) => void;
  // currentSelectedDate: Date,
}

export interface FormDataValues {
  firstName: string;
  lastName: string;
  username: string;
}

export type PermissionsProps = {
  taskLimits: {
    daily: number;
    monthly: number;
    recurring: number;
  };
  features: {
    voiceCreation: boolean;
  };
  whatsapp: {
    weeklyLimit: number;
    canRead: boolean;
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    voiceCreation: boolean;
  };
};

// Capability flags derived from PermissionsProps — gate on these, never on the plan name.
export type Entitlements = {
  loading: boolean; // permissions not fetched yet
  voice: boolean; // can create tasks by voice
  recurrence: boolean; // can use recurring tasks
  monthlyLimit: number; // -1 = unlimited
  unlimited: boolean; // monthlyLimit < 0
  tasksUsed: number; // distinct base tasks this month
  remaining: number; // Infinity when unlimited
  canCreateTask: boolean;
};

export type InvoicesProps = {
  amount_paid: number;
  currency: string;
  status: "draft" | "open" | "paid" | "uncollectible" | "void" | null;
  created: number;
  hosted_invoice_url: string | null | undefined;
  recurring: "year" | "month";
  brandName: string;
  cardLast4: number;
  walletType: string;
  paymentMethodType: string;
};

export type PaymentDetailsProps = {
  amount: number;
  currency: string;
  start: number;
  recurring: string;
};
