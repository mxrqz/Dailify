import { useEffect, useRef, useState } from "react";
import { Input } from "./input";
import { Button } from "./button";
import { PlusIcon } from "lucide-react";
import { Badge } from "./badge";
import { copy } from "@/components/dashboard/copy";
import { TagsPickerProps } from "@/types/types";

export default function TagsPicker({ onSelectedTags, task }: TagsPickerProps) {
  const [tags, setTags] = useState<string[]>(task && task.tags ? task.tags : []);
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = () => {
    if (!inputRef.current || inputRef.current.value.trim() === "") return;

    const newTag = inputRef.current.value;
    if (tags?.includes(newTag)) return;

    setTags((prevTags) => [...prevTags, newTag]);
    inputRef.current.value = "";
    inputRef.current.focus();
  };

  const removeTag = (tagToRemove: string) => {
    const updatedTags = tags.filter((tag) => tag !== tagToRemove);
    setTags(updatedTags);
  };

  useEffect(() => {
    if (!tags) return;
    onSelectedTags(tags);
  }, [tags]);

  return (
    <div id="tags" className="flex flex-col gap-1">
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          type="text"
          placeholder={copy.form.tagPlaceholder}
          onKeyDown={(e) => e.key === "Enter" && addTag()}
        />

        <Button variant="outline" size="icon" className="aspect-square" onClick={() => addTag()}>
          <PlusIcon />
        </Button>
      </div>

      {tags && (
        <ul className="flex flex-wrap gap-2">
          {tags?.map((tag, index) => (
            <li key={index}>
              <Badge variant={"outline"} onClick={(e) => removeTag(e.currentTarget.textContent!)}>
                {tag}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
