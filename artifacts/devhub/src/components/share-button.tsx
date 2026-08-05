import React from "react";
import { Share2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { shareWithFeedback, type SharePayload } from "@/lib/share";

type ShareButtonProps = {
  payload: SharePayload;
  /** Icon-only by default; set label for text buttons */
  label?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
  title?: string;
  /** Stop click bubbling (cards / list rows) */
  stopPropagation?: boolean;
};

/**
 * Opens the OS share sheet (WhatsApp, Email, Messenger, …)
 * or copies the content if share is unavailable.
 */
export function ShareButton({
  payload,
  label,
  variant = "ghost",
  size = "icon",
  className,
  title = "Share",
  stopPropagation = true,
}: ShareButtonProps) {
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    if (stopPropagation) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (busy) return;
    setBusy(true);
    try {
      await shareWithFeedback(payload);
      setDone(true);
      window.setTimeout(() => setDone(false), 1800);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn(
        size === "icon" && "text-muted-foreground hover:text-foreground",
        label && "gap-2",
        className,
      )}
      onClick={handleClick}
      disabled={busy}
      title={title}
      aria-label={title}
    >
      {done ? (
        <Check className={cn("w-4 h-4 text-emerald-500", size === "icon" && "w-3.5 h-3.5")} />
      ) : (
        <Share2 className={cn("w-4 h-4", size === "icon" && "w-3.5 h-3.5")} />
      )}
      {label ? <span>{done ? "Shared" : label}</span> : null}
    </Button>
  );
}
