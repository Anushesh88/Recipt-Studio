import React, { useState } from "react";
import { FileDown, ImageDown, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { canShareFiles, downloadReceipt, shareReceipt, type ExportFormat } from "../../api/exports";
import type { ReceiptSummary } from "../../api/receipts";
import { WhatsAppButton } from "./WhatsAppButton";
import { PrintButton } from "./PrintButton";

// Download buttons for one stored receipt (rendered server-side)
// `receipt` (when given) adds the WhatsApp button; `layout="card"` puts PDF
// full width with the rest in two even columns (`children` join them)
export const ExportButtons: React.FC<{
  receiptId: string;
  receiptNumber: string;
  size?: "xs" | "sm";
  receipt?: ReceiptSummary;
  layout?: "row" | "card";
  children?: React.ReactNode;
}> = ({ receiptId, receiptNumber, size = "sm", receipt, layout = "row", children }) => {
  const [busy, setBusy] = useState<ExportFormat | "share" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shareable] = useState(canShareFiles);

  const run = async (what: ExportFormat | "share", action: () => Promise<unknown>) => {
    setBusy(what);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };
  const download = (format: ExportFormat) => run(format, () => downloadReceipt(receiptId, format, receiptNumber));

  return (
    <div className="space-y-1">
      <div className={layout === "card" ? "grid grid-cols-2 gap-2 *:w-full [&>*>button]:w-full [&>*:last-child:nth-child(even)]:col-span-2" : "flex flex-wrap gap-2"}>
        <Button type="button" size={size} className={layout === "card" ? "col-span-2" : undefined} disabled={busy !== null} onClick={() => download("pdf")} aria-label={`Download ${receiptNumber} as PDF`}>
          <FileDown />
          {busy === "pdf" ? "Preparing…" : "PDF"}
        </Button>
        <Button type="button" size={size} variant="outline" disabled={busy !== null} onClick={() => download("png")} aria-label={`Download ${receiptNumber} as PNG`}>
          <ImageDown />
          {busy === "png" ? "Preparing…" : "PNG"}
        </Button>
        {shareable && (
          <Button type="button" size={size} variant="outline" disabled={busy !== null} onClick={() => run("share", () => shareReceipt(receiptId, receiptNumber))} aria-label={`Share ${receiptNumber} as PDF`}>
            <Share2 />
            {busy === "share" ? "Preparing…" : "Share"}
          </Button>
        )}
        {receipt && <WhatsAppButton receipt={receipt} size={size} />}
        <PrintButton receiptId={receiptId} receiptNumber={receiptNumber} size={size} />
        {children}
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
};
