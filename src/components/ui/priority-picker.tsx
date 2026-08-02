import { priorityBgColor, prioritySelectedBgColor } from "@/consts/conts";
import { ToggleGroup, ToggleGroupItem } from "./toggle-group";
import { PriorityPickerProps } from "@/types/types";
import { useEffect, useState } from "react";

export default function PriorityPicker({ onSelectedPriority, task }: PriorityPickerProps) {
  const [priority, setPriority] = useState<number>(task ? task.priority : 0);

  useEffect(() => {
    if (priority === null) return;
    onSelectedPriority(priority);
  }, [priority]);

  return (
    <ToggleGroup
      type="single"
      className="w-full"
      variant="outline"
      size="sm"
      id="priority"
      onValueChange={(e) => {
        setPriority(Number(e));
      }}
      defaultValue={String(priority)}
    >
      {Array.from({ length: 5 }).map((_, index) => (
        <ToggleGroupItem
          value={String(index)}
          key={index}
          className={`${priorityBgColor[index]} ${prioritySelectedBgColor[index]}`}
        >
          {index + 1}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
