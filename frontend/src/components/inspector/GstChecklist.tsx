import React, { useMemo } from "react";
import { CheckCircle2, CircleAlert, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEditorStore } from "../../store/editorStore";
import {
  REQUIRED_COLUMNS,
  REQUIRED_TOTALS,
  REQUIRED_VARIABLES,
  SIGNATURE_REQUIREMENT,
  missingParticulars,
} from "../../lib/gst";

const ALL_PARTICULARS = [
  ...Object.values(REQUIRED_VARIABLES),
  ...Object.values(REQUIRED_COLUMNS),
  ...Object.values(REQUIRED_TOTALS),
  SIGNATURE_REQUIREMENT,
];

// Rule 46's particulars, ticked off as the template shows them. Saving waits
// until all are there; "Add missing fields" places whatever is left.
export const GstChecklist: React.FC = () => {
  const elements = useEditorStore((s) => s.elements);
  const addGstRequirements = useEditorStore((s) => s.addGstRequirements);
  const missing = useMemo(() => new Set(missingParticulars(elements)), [elements]);

  return (
    <div className="space-y-2" data-gst-checklist="">
      <p className={`text-xs font-medium ${missing.size ? "text-amber-700" : "text-green-700"}`} role="status">
        {missing.size
          ? `${missing.size} of ${ALL_PARTICULARS.length} required details missing`
          : "Shows everything a GST tax invoice needs"}
      </p>
      {missing.size > 0 && (
        <Button type="button" size="xs" onClick={addGstRequirements}>
          <Wand2 />
          Add missing fields
        </Button>
      )}
      <ul className="space-y-0.5 text-xs">
        {ALL_PARTICULARS.map((label) => {
          const ok = !missing.has(label);
          return (
            <li key={label} data-particular={label} data-ok={ok} className={`flex items-center gap-1.5 ${ok ? "text-muted-foreground" : "text-amber-800"}`}>
              {ok ? <CheckCircle2 className="size-3.5 shrink-0 text-green-600" /> : <CircleAlert className="size-3.5 shrink-0 text-amber-600" />}
              {label}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        For GST-registered businesses with turnover up to ₹5 crore. Above that, B2B invoices also need an IRN from the
        e-invoice portal, which this app doesn't issue.
      </p>
    </div>
  );
};
