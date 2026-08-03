import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Clock,
  Calendar,
  Bell,
  BarChart2,
  Repeat,
  CheckCircle,
  AlertCircle,
  Edit,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { EditTask, EditTaskContent, EditTaskTrigger } from "./edit-task";
import { TaskProps } from "@/types/types";
import { priorityBgColor, priorityText, priorityTextColor } from "@/consts/conts";
import { deleteTask } from "@/functions/api";
import { useAuth } from "@clerk/clerk-react";

interface TaskDetailViewProps {
  task: TaskProps;
  className?: string;
}

export function TaskDetailView({ task, className }: TaskDetailViewProps) {
  const { getToken } = useAuth();
  // const [isExpanded, setIsExpanded] = useState(false)

  const taskDate = new Date(task.date);
  const formattedDate = format(taskDate, "PPP", { locale: ptBR });
  const formattedTime = format(taskDate, "HH:mm", { locale: ptBR });
  // const formattedFullDate = format(taskDate, "EEEE, d 'de' MMMM 'às' HH:mm", { locale: ptBR })

  const alertDate = new Date(task.alert ?? task.date);
  const alertTime = format(alertDate, "HH:mm", { locale: ptBR });

  const timeUntil = formatDistanceToNow(taskDate, { locale: ptBR, addSuffix: true });

  const getPriorityInfo = (priority: number) => {
    switch (priority) {
      case 4:
        return {
          label: priorityText[priority],
          color: `${priorityTextColor[priority]} ${priorityBgColor[priority]}`,
          icon: <AlertCircle className="h-4 w-4" />,
        };

      case 3:
        return {
          label: priorityText[priority],
          color: `${priorityTextColor[priority]} ${priorityBgColor[priority]}`,
          icon: <AlertCircle className="h-4 w-4" />,
        };

      case 2:
        return {
          label: priorityText[priority],
          color: `${priorityTextColor[priority]} ${priorityBgColor[priority]}`,
          icon: <AlertCircle className="h-4 w-4" />,
        };

      case 1:
        return {
          label: priorityText[priority],
          color: `${priorityTextColor[priority]} ${priorityBgColor[priority]}`,
          icon: <AlertCircle className="h-4 w-4" />,
        };

      case 0:
      default:
        return {
          label: priorityText[priority],
          color: `${priorityTextColor[priority]} ${priorityBgColor[priority]}`,
          icon: <CheckCircle className="h-4 w-4" />,
        };
    }
  };

  const priorityInfo = getPriorityInfo(task.priority);

  return (
    <Card
      className={cn(
        "overflow-hidden transition-all p-0 w-full bg-zinc-100 dark:bg-zinc-900",
        className,
      )}
    >
      <CardHeader className="p-4 border-b">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <h3 className="text-xl font-semibold">{task.title}</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>{formattedDate}</span>
              <span className="text-xs">•</span>
              <Clock className="h-4 w-4" />
              <span>{formattedTime}</span>
            </div>
          </div>

          <Badge className={priorityInfo.color}>
            <div className="flex items-center gap-1">
              {priorityInfo.icon}
              <span>{priorityInfo.label}</span>
            </div>
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-foreground/10 text-foreground">
              <Clock className="size-4" />
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Duração</p>
              <p className="font-medium">{task.duration}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-foreground/10 text-foreground">
              <Repeat className="size-4" />
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Repetição</p>
              <p className="font-medium">
                {typeof task.repeat === "string"
                  ? task.repeat
                  : typeof task.repeat === "object" && Object.values(task.repeat)[0]}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-foreground/10 text-foreground">
              <Bell className="size-4" />
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Alerta</p>
              <p className="font-medium">{alertTime}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-foreground/10 text-foreground">
              <BarChart2 className="size-4" />
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="font-medium">{timeUntil}</p>
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex justify-between p-4 pt-0 w-full">
        <EditTask>
          <EditTaskTrigger>
            <Button size="sm" className="w-full shrink">
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Button>
          </EditTaskTrigger>

          <EditTaskContent task={task} />
        </EditTask>

        <Button
          variant="outline"
          size="sm"
          className="w-full ml-2 text-red-500 hover:bg-red-500/10 hover:text-red-500 shrink"
          onClick={async () => {
            const token = await getToken();
            if (token) await deleteTask(token, task.id);
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Excluir
        </Button>
      </CardFooter>
    </Card>
  );
}
