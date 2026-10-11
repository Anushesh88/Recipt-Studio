import React, { useId, useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createShareLink } from "../../api/exports";
import { useQueryClient } from "@tanstack/react-query";
import { accountQuery } from "../../api/account";
import type { ReceiptSummary } from "../../api/receipts";
import { receiptMessage, whatsappNumber, whatsappUrl } from "../../lib/whatsapp";

// Sends the customer a WhatsApp message with a private link to the receipt's
// PDF. (A wa.me link can't attach a file; on phones, Share sends the PDF itself.)
export const WhatsAppButton: React.FC<{ receipt: ReceiptSummary; size?: "xs" | "sm" }> = ({ receipt, size = "sm" }) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const phoneId = useId();
  const messageId = useId();

  const onOpenChange = async (next: boolean) => {
    setOpen(next);
    if (!next || message !== null) return;
    setError(null);
    try {
      // The account may still be loading: wait for it, for the business name
      const [link, account] = await Promise.all([createShareLink(receipt.id), queryClient.ensureQueryData(accountQuery)]);
      setMessage(receiptMessage({
        customerName: receipt.customer_name, businessName: account.business_name,
        kind: receipt.document_type === "gst_invoice" ? "invoice" : "receipt",
        number: receipt.receipt_number, total: receipt.total_amount, currency: receipt.currency, link,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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
      <PopoverContent align="end" collisionPadding={8} className="w-80 space-y-3" data-whatsapp="">
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
            <Textarea id={messageId} rows={5} value={message ?? ""} onChange={(e) => setMessage(e.target.value)} disabled={message === null} />
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
      </PopoverContent>
    </Popover>
  );
};
