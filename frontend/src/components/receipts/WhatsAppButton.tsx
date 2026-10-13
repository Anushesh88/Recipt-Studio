import React, { useId, useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { canShareFiles, createShareLink, fetchReceiptFile } from "../../api/exports";
import { useQueryClient } from "@tanstack/react-query";
import { accountQuery } from "../../api/account";
import type { ReceiptSummary } from "../../api/receipts";
import { receiptMessage, whatsappNumber, whatsappUrl } from "../../lib/whatsapp";

// Sends the customer the receipt on WhatsApp. Phones send the PDF file itself
// through the share sheet (pick WhatsApp, then the contact). Elsewhere a wa.me
// link can only carry text, so the message has a private link to the PDF.
export const WhatsAppButton: React.FC<{ receipt: ReceiptSummary; size?: "xs" | "sm" }> = ({ receipt, size = "sm" }) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sendFile, setSendFile] = useState(canShareFiles);
  const [file, setFile] = useState<File | null>(null);
  const phoneId = useId();
  const messageId = useId();

  const prepare = async (asFile: boolean) => {
    setError(null);
    setMessage(null);
    try {
      // The account may still be loading: wait for it, for the business name.
      // The PDF is fetched now so tapping Send opens the share sheet at once.
      const [account, link, pdf] = await Promise.all([
        queryClient.ensureQueryData(accountQuery),
        asFile ? null : createShareLink(receipt.id),
        asFile ? fetchReceiptFile(receipt.id, "pdf", receipt.receipt_number) : null,
      ]);
      setFile(pdf);
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
    if (next && message === null) void prepare(sendFile);
  };
  const useLinkInstead = () => {
    setSendFile(false);
    void prepare(false);
  };
  const sharePdf = async () => {
    if (!file || message === null) return;
    try {
      await navigator.share({ files: [file], text: message });
      setOpen(false);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        setError("Couldn't open the share sheet. Send a link instead.");
      }
    }
  };
  const badNumber = phone.trim() !== "" && whatsappNumber(phone) === "";

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
        {sendFile ? (
          <>
            <div className="space-y-1.5">
              <Label htmlFor={messageId}>Message with the PDF</Label>
              {message === null && !error ? (
                <p className="text-sm text-muted-foreground">Preparing the PDF…</p>
              ) : (
                <Textarea id={messageId} rows={4} value={message ?? ""} onChange={(e) => setMessage(e.target.value)} disabled={message === null} />
              )}
              {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
              <p className="text-xs text-muted-foreground">Tap Send, choose WhatsApp, then pick the customer.</p>
            </div>
            <Button className="w-full bg-[#25D366] text-white hover:bg-[#1ebe5b]" disabled={!file || message === null} onClick={() => void sharePdf()}>
              <MessageCircle />
              Send PDF on WhatsApp
            </Button>
            <button type="button" className="w-full text-center text-xs text-muted-foreground underline" onClick={useLinkInstead}>
              Send a link instead
            </button>
          </>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor={phoneId}>Customer's WhatsApp number</Label>
              <Input id={phoneId} type="tel" inputMode="tel" autoComplete="off" placeholder="e.g. 98765 43210" value={phone}
                aria-invalid={badNumber} onChange={(e) => setPhone(e.target.value)} />
              <p className={badNumber ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                {badNumber ? "Enter a 10-digit mobile number, or one with its country code." : "Optional: leave it empty to pick the contact in WhatsApp. +91 is added to 10-digit numbers."}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={messageId}>Message</Label>
              {message === null && !error ? (
                <p className="text-sm text-muted-foreground">Making a link to the receipt…</p>
              ) : (
                <Textarea id={messageId} rows={4} value={message ?? ""} onChange={(e) => setMessage(e.target.value)} disabled={message === null} />
              )}
              {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
              <p className="text-xs text-muted-foreground">Anyone with the link can open this receipt's PDF.</p>
            </div>
            {message !== null && !badNumber ? (
              <Button asChild className="w-full bg-[#25D366] text-white hover:bg-[#1ebe5b]">
                <a href={whatsappUrl(phone, message)} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
                  <MessageCircle />
                  Open WhatsApp
                </a>
              </Button>
            ) : (
              <Button className="w-full" disabled>
                <MessageCircle />
                Open WhatsApp
              </Button>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
};
