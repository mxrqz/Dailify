/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { handleBack } from "./back-button";

function OpenDialog() {
  const [open, setOpen] = useState(true);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent aria-describedby={undefined}>
        <DialogTitle>Folha</DialogTitle>
      </DialogContent>
    </Dialog>
  );
}

describe("handleBack", () => {
  it("closes the top Radix layer first, without touching history", async () => {
    render(<OpenDialog />);
    const back = vi.spyOn(history, "back");
    const exit = vi.fn();
    handleBack(true, exit);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(back).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
    back.mockRestore();
  });

  it("goes back in history, or exits at the root", () => {
    const back = vi.spyOn(history, "back").mockImplementation(() => undefined);
    const exit = vi.fn();
    handleBack(true, exit);
    expect(back).toHaveBeenCalledOnce();
    handleBack(false, exit);
    expect(exit).toHaveBeenCalledOnce();
    back.mockRestore();
  });
});
