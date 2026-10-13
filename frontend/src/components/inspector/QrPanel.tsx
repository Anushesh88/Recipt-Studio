import React from "react";
import type { CanvasElement } from "../../schema/templateSchema";
import { VariableTextarea } from "../variables/VariableTextarea";
import { Section, SelectField } from "./fields";
import { usePropUpdater } from "./usePropUpdater";
import { qrFits, qrTooLongMessage } from "../../lib/qr";
import { Link } from "react-router-dom";
import { IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccount } from "../../api/account";
import { UPI_QR_CONTENT } from "../../lib/upi";

type QrElement = Extract<CanvasElement, { type: "qr" }>;

const ERROR_CORRECTION_OPTIONS = [
  { value: "L", label: "Low (7%)" },
  { value: "M", label: "Medium (15%)" },
  { value: "Q", label: "Quartile (25%)" },
  { value: "H", label: "High (30%)" },
] as const;

export const QrPanel: React.FC<{ element: QrElement }> = ({ element }) => {
  const set = usePropUpdater(element);
  const { props } = element;
  const { data: account } = useAccount();
  const isUpi = props.content.trim() === UPI_QR_CONTENT;
  return (
    <Section title="QR code">
      <div className="space-y-1.5 rounded-md border border-border p-2" data-upi-qr="">
        {isUpi ? (
          <p className="text-xs font-medium text-emerald-800">Pay by UPI: customers scan it and the bill amount is filled in.</p>
        ) : (
          <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => set("content", UPI_QR_CONTENT)}>
            <IndianRupee />
            Make it a Pay by UPI code
          </Button>
        )}
        {isUpi && account && !account.upi_id ? (
          <p className="text-xs text-amber-700">
            Add your UPI ID in <Link to="/settings" className="underline">Settings</Link>. Until then this code is left off receipts.
          </p>
        ) : (
          !isUpi && <p className="text-xs text-muted-foreground">Opens any UPI app with your UPI ID, the bill amount and the receipt number.</p>
        )}
      </div>
      <VariableTextarea id="qr-content" label="Encoded content" value={props.content} onChange={(v) => set("content", v)} rows={2} />
      {qrFits(props.content, props.errorCorrection) ? (
        <p className="text-xs text-muted-foreground">The canvas encodes sample values; exports encode the real ones.</p>
      ) : (
        <p role="alert" className="text-xs text-destructive">{qrTooLongMessage(props.errorCorrection)}</p>
      )}
      <SelectField
        id="qr-error-correction"
        label="Error correction"
        value={props.errorCorrection}
        options={ERROR_CORRECTION_OPTIONS}
        onChange={(v) => set("errorCorrection", v)}
        hint="Higher survives more damage but makes a denser code."
      />
    </Section>
  );
};
