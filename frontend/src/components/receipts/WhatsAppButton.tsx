import React, { useId, useState } from "react";
import { FileDown, ImageDown, Link2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { canShareFiles, createShareLink, fetchReceiptFile, saveBlob } from "../../api/exports";
import { useQueryClient } from "@tanstack/react-query";
import { accountQuery } from "../../api/account";
import type { ReceiptSummary } from "../../api/receipts";
import { receiptMessage, whatsappNumber, whatsappUrl } from "../../lib/whatsapp";
import { useIsMobile } from "../../lib/useIsMobile";

type SendAs = "pdf" | "png" | "link";

const OPTIONS: { value: SendAs; label: string; icon: React.ReactNode }[] = [
  { value: "pdf", label: "PDF", icon: <FileDown /> },
  { value: "png", label: "PNG", icon: <ImageDown /> },
  { value: "link", label: "Link", icon: <Link2 /> },
];

// Sends the customer the receipt on WhatsApp as a PDF, an image or a link.
// A wa.me link can only carry text, so files go one of two ways: phones hand
// the file to WhatsApp through the share sheet (pick WhatsApp, then the
// contact); computers download it and open WhatsApp with the message, and the
// user attaches the file. A link needs nothing attached.
export const WhatsAppButton: React.FC<{ receipt: ReceiptSummary; size?: "xs" | "sm" }> = ({ receipt, size = "sm" }) => {
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [sendAs, setSendAs] = useState<SendAs>("pdf");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const phoneId = useId();
  const messageId = useId();

  const viaShareSheet = sendAs !== "link" && isMobile && canShareFiles();

  // The account may still be loading: wait for it, for the business name. The
  // file is fetched now so tapping Send acts at once (the share sheet needs it)
  const prepare = async (as: SendAs) => {
    setError(null);
    setMessage(null);
    setFile(null);
    try {
      const [account, link, fetched] = await Promise.all([
        queryClient.ensureQueryData(accountQuery),
        as === "link" ? createShareLink(receipt.id) : null,
        as === "link" ? null : fetchReceiptFile(receipt.id, as, receipt.receipt_number),
      ]);
      setFile(fetched);
      setMessage(receiptMessage({
        customerName: receipt.customer_name, businessName: account.business_name,
        kind: receipt.document_type === "gst_invoice" ? "invoice" : "receipt",
        number: receipt.receipt_number, total: receipt.total_amount, currency: receipt.currency, link,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next && message === null) void prepare(sendAs);
  };
  const choose = (as: SendAs) => {
    if (as === sendAs) return;
    setSendAs(as);
    void prepare(as);
  };

  const send = async () => {
    if (message === null) return;
    if (viaShareSheet) {
      if (!file) return;
      try {
        await navigator.share({ files: [file], text: message });
        setOpen(false);
      } catch (e) {
        if (!(e instanceof DOMException && e.name === "AbortError")) setError("Couldn't open the share sheet. Try sending a link.");
      }
      return;
    }
    if (file) saveBlob(file, file.name);
    window.open(whatsappUrl(phone, message), "_blank", "noopener,noreferrer");
    setOpen(false);
  };

  const badNumber = !viaShareSheet && phone.trim() !== "" && whatsappNumber(phone) === "";
  const ready = message !== null && !badNumber && (sendAs === "link" || file !== null);
  const hint = sendAs === "link"
    ? "Anyone with the link can open this receipt's PDF."
    : viaShareSheet
      ? "Tap Send, choose WhatsApp, then pick the customer."
      : `The ${sendAs === "pdf" ? "PDF" : "image"} downloads and WhatsApp opens: attach it with the paperclip, then send.`;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button type="button" size={size} variant="outline" aria-label={`Send ${receipt.receipt_number} on WhatsApp`}>
          <MessageCircle />
          WhatsApp
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={8}
        // Scrolls rather than running off a phone screen
        className="max-h-(--radix-popover-content-available-height) w-[min(20rem,calc(100vw-1rem))] space-y-3 overflow-y-auto"
        data-whatsapp=""
      >
        <div className="space-y-1.5">
          <p className="text-sm font-medium" id={`${messageId}-as`}>Send as</p>
          <div role="radiogroup" aria-labelledby={`${messageId}-as`} className="grid grid-cols-3 gap-1 rounded-md bg-muted p-1">
            {OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={sendAs === option.value}
                onClick={() => choose(option.value)}
                className="flex items-center justify-center gap-1 rounded px-2 py-1.5 text-sm text-muted-foreground aria-checked:bg-white aria-checked:font-medium aria-checked:text-foreground aria-checked:shadow-sm [&_svg]:size-4"
              >
                {option.icon}
                {option.label}
              </button>
            ))}
          </div>
        </div>
        {!viaShareSheet && (
          <div className="space-y-1.5">
            <Label htmlFor={phoneId}>Customer's WhatsApp number</Label>
            <Input id={phoneId} type="tel" inputMode="tel" autoComplete="off" placeholder="e.g. 98765 43210" value={phone}
              aria-invalid={badNumber} onChange={(e) => setPhone(e.target.value)} />
            <p className={badNumber ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
              {badNumber ? "Enter a 10-digit mobile number, or one with its country code." : "Optional: leave it empty to pick the contact in WhatsApp. +91 is added to 10-digit numbers."}
            </p>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor={messageId}>Message</Label>
          {message === null && !error ? (
            <p className="text-sm text-muted-foreground">{sendAs === "link" ? "Making a link to the receipt…" : "Preparing the file…"}</p>
          ) : (
            <Textarea id={messageId} rows={4} value={message ?? ""} onChange={(e) => setMessage(e.target.value)} disabled={message === null} />
          )}
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
        <Button className="w-full bg-[#25D366] text-white hover:bg-[#1ebe5b]" disabled={!ready} onClick={() => void send()}>
          <MessageCircle />
          {viaShareSheet ? `Send ${sendAs === "pdf" ? "PDF" : "image"} on WhatsApp` : "Open WhatsApp"}
        </Button>
      </PopoverContent>
    </Popover>
  );
};
