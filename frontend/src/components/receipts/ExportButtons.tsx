import React, { useState } from "react";
import { FileDown, ImageDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadReceipt, type ExportFormat } from "../../api/exports";

// Download buttons for one stored receipt (rendered server-side)
export const ExportButtons: React.FC<{ receiptId: string; receiptNumber: string; size?: "xs" | "sm" }> = ({
  receiptId,
  receiptNumber,
  size = "sm",
}) => {
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);

  const download = async (format: ExportFormat) => {
    setBusy(format);
    setError(null);
    try {
      await downloadReceipt(receiptId, format, receiptNumber);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <Button type="button" size={size} disabled={busy !== null} onClick={() => download("pdf")} aria-label={`Download ${receiptNumber} as PDF`}>
          <FileDown />
          {busy === "pdf" ? "Preparing…" : "PDF"}
        </Button>
        <Button type="button" size={size} variant="outline" disabled={busy !== null} onClick={() => download("png")} aria-label={`Download ${receiptNumber} as PNG`}>
          <ImageDown />
          {busy === "png" ? "Preparing…" : "PNG"}
        </Button>
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    </div>
  );
};
