import React, { useId, useState } from "react";
import { useLocation } from "react-router-dom";
import { MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { sendFeedback } from "../api/feedback";
import { apiErrorMessage } from "../api/client";

const MAX_LENGTH = 2000;

// "Feedback" in the corner of every signed-in page (except the editor, which
// has its own toolbar): a message to the team, saved with the page it came from
export const FeedbackButton: React.FC = () => {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const fieldId = useId();
  if (pathname.startsWith("/editor")) return null;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("sending");
    setError(null);
    try {
      await sendFeedback(message.trim(), pathname);
      setMessage("");
      setState("sent");
    } catch (err) {
      setError(apiErrorMessage(err, "Couldn't send it. Please try again."));
      setState("idle");
    }
  };

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (next) setState("idle"); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="fixed right-4 bottom-4 z-40 flex items-center gap-1.5 rounded-full bg-indigo-700 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-indigo-800 print:hidden"
        >
          <MessageSquareText className="size-4" />
          Feedback
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" collisionPadding={8} className="w-80" data-feedback="">
        {state === "sent" ? (
          <div role="status" className="space-y-2 text-sm">
            <p className="font-medium">Thanks! Your feedback was sent.</p>
            <p className="text-muted-foreground">Every message is read, and it helps decide what gets built next.</p>
            <Button size="sm" variant="outline" onClick={() => setOpen(false)}>Close</Button>
          </div>
        ) : (
          <form onSubmit={send} className="space-y-2">
            <Label htmlFor={fieldId}>What's confusing, broken, or missing?</Label>
            <Textarea id={fieldId} rows={5} maxLength={MAX_LENGTH} value={message} onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. I couldn't find how to add my logo" />
            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
            <Button type="submit" size="sm" className="w-full" disabled={state === "sending" || message.trim() === ""}>
              {state === "sending" ? "Sending…" : "Send feedback"}
            </Button>
          </form>
        )}
      </PopoverContent>
    </Popover>
  );
};
