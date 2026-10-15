import React, { useState } from "react";
import { Bluetooth, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fetchReceiptFile } from "../../api/exports";
import { fitToPaper, rasterCommands, toGrey, type PaperWidth } from "../../lib/escpos";
import { bluetoothSupported, choosePrinter, connectedPrinter, forgetPrinter, PrinterError, sendToPrinter } from "../../lib/bluetoothPrinter";

const PAPER_KEY = "printer-paper";
const readPaper = (): PaperWidth => {
  try {
    return localStorage.getItem(PAPER_KEY) === "80" ? 80 : 58;
  } catch {
    return 58;
  }
};

// The receipt's PNG (the server's rendering), as printer bytes for the paper
async function printerBytes(receiptId: string, receiptNumber: string, paper: PaperWidth): Promise<Uint8Array> {
  const file = await fetchReceiptFile(receiptId, "png", receiptNumber);
  const image = await createImageBitmap(file);
  const { width, height } = fitToPaper(image.width, image.height, paper);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new PrinterError("Couldn't prepare the receipt for printing.");
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, width, height);
  return rasterCommands(toGrey(ctx.getImageData(0, 0, width, height).data, width, height));
}

// Print: to a Bluetooth thermal printer (58 or 80 mm), or any printer the
// phone or computer already knows, through its print dialog
export const PrintButton: React.FC<{ receiptId: string; receiptNumber: string; size?: "xs" | "sm"; thermal?: boolean }> = ({
  receiptId, receiptNumber, size = "sm", thermal = true,
}) => {
  const [open, setOpen] = useState(false);
  const [paper, setPaper] = useState<PaperWidth>(readPaper);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [printerName, setPrinterName] = useState(() => connectedPrinter()?.name ?? null);
  const supported = bluetoothSupported();

  const choosePaper = (width: PaperWidth) => {
    setPaper(width);
    try {
      localStorage.setItem(PAPER_KEY, String(width));
    } catch {
      // a convenience only
    }
  };

  const printBluetooth = async (pickAnother = false) => {
    setBusy(true);
    setStatus(null);
    try {
      if (pickAnother) forgetPrinter();
      // The browser only shows its device list straight after a tap, so the
      // printer is picked before the (slower) receipt image is fetched
      if (!connectedPrinter()) setPrinterName((await choosePrinter()).name ?? "Printer");
      setStatus({ ok: true, message: "Preparing the receipt…" });
      const bytes = await printerBytes(receiptId, receiptNumber, paper);
      await sendToPrinter(bytes, (f) => setStatus({ ok: true, message: `Printing… ${Math.round(f * 100)}%` }));
      setStatus({ ok: true, message: "Sent to the printer." });
    } catch (e) {
      setStatus({ ok: false, message: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  // Any printer the device already has (Wi-Fi, USB, or Android print apps)
  const printOtherwise = async () => {
    setBusy(true);
    setStatus(null);
    const tab = window.open("", "_blank");
    try {
      const file = await fetchReceiptFile(receiptId, "pdf", receiptNumber);
      const url = URL.createObjectURL(file);
      if (tab) tab.location.href = url;
      else window.location.href = url;
      setStatus({ ok: true, message: "Opened the PDF: use its Print button." });
    } catch (e) {
      tab?.close();
      setStatus({ ok: false, message: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" size={size} variant="outline" aria-label={`Print ${receiptNumber}`}>
          <Printer />
          Print
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" collisionPadding={8} className="w-[min(20rem,calc(100vw-1rem))] space-y-3" data-print="">
        <div className="space-y-1.5">
          <p className="text-sm font-medium" id={`paper-${receiptId}`}>Receipt printer paper</p>
          <div role="radiogroup" aria-labelledby={`paper-${receiptId}`} className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
            {([58, 80] as const).map((width) => (
              <button
                key={width}
                type="button"
                role="radio"
                aria-checked={paper === width}
                onClick={() => choosePaper(width)}
                className="rounded px-2 py-1.5 text-sm text-muted-foreground aria-checked:bg-white aria-checked:font-medium aria-checked:text-foreground aria-checked:shadow-sm"
              >
                {width} mm
              </button>
            ))}
          </div>
          {!thermal && <p className="text-xs text-amber-700">This template is a full page, so it prints small on a receipt printer.</p>}
        </div>

        {supported ? (
          <div className="space-y-1.5">
            <Button type="button" className="w-full" disabled={busy} onClick={() => void printBluetooth()}>
              <Bluetooth />
              {printerName ? `Print on ${printerName}` : "Print on a Bluetooth printer"}
            </Button>
            {printerName ? (
              <button type="button" className="w-full text-center text-xs text-muted-foreground underline" disabled={busy} onClick={() => void printBluetooth(true)}>
                Use a different printer
              </button>
            ) : (
              <p className="text-xs text-muted-foreground">Turn the printer on, then pick it from the list. Most 58 and 80 mm printers that support Bluetooth LE work.</p>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground" data-no-bluetooth="">
            This browser can't reach Bluetooth printers. Open Receipt Studio in <strong>Chrome on Android</strong> or on a computer, or print the PDF below.
          </p>
        )}

        <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={() => void printOtherwise()}>
          <Printer />
          Print the PDF another way
        </Button>
        {status && <p role={status.ok ? "status" : "alert"} className={`text-xs ${status.ok ? "text-muted-foreground" : "text-destructive"}`}>{status.message}</p>}
      </PopoverContent>
    </Popover>
  );
};
