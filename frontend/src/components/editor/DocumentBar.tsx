import React, { useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CopyPlus, ReceiptText, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TEMPLATE_NAME_MAX_LENGTH } from "../../lib/units";
import { useEditorStore } from "../../store/editorStore";

// Template name, save state and the Save / Save as / Generate actions
export const DocumentBar: React.FC<{
  templateId: string | undefined;
  name: string;
  onNameChange: (name: string) => void;
  dirty: boolean;
  saving: boolean;
  onSave: (asNew?: { name: string }) => void;
}> = ({ templateId, name, onNameChange, dirty, saving, onSave }) => {
  const gstInvoice = useEditorStore((state) => state.documentType === "gst_invoice");
  const navigate = useNavigate();
  const nameId = useId();
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [saveAsName, setSaveAsName] = useState("");

  const status = saving ? "Saving…" : dirty ? "Unsaved changes" : templateId ? "All changes saved" : "Not saved yet";

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={nameId} className="sr-only">Template name</label>
      <Input
        id={nameId}
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        maxLength={TEMPLATE_NAME_MAX_LENGTH}
        className="h-8 w-56 font-medium"
      />
      <span role="status" aria-label="Save status" className={`text-xs whitespace-nowrap ${dirty ? "text-amber-700" : "text-muted-foreground"}`}>
        {status}
      </span>
      <Button type="button" size="sm" disabled={saving} onClick={() => onSave()} title="Save (Ctrl+S)">
        <Save />
        Save
      </Button>
      <Popover
        open={saveAsOpen}
        onOpenChange={(open) => {
          setSaveAsOpen(open);
          if (open) setSaveAsName(`${name.trim() || "Untitled receipt"} (copy)`);
        }}
      >
        <PopoverTrigger asChild>
          <Button type="button" size="sm" variant="outline" disabled={saving}>
            <CopyPlus />
            Save as…
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72">
          <form
            className="space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              setSaveAsOpen(false);
              onSave({ name: saveAsName });
            }}
          >
            <label htmlFor={`${nameId}-save-as`} className="text-xs font-medium">Save a copy as</label>
            <Input id={`${nameId}-save-as`} value={saveAsName} maxLength={TEMPLATE_NAME_MAX_LENGTH} onChange={(e) => setSaveAsName(e.target.value)} />
            <Button type="submit" size="sm" className="w-full">Save copy</Button>
          </form>
        </PopoverContent>
      </Popover>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!templateId || dirty}
        title={!templateId || dirty ? "Save the template first" : "Fill in a receipt from this template"}
        onClick={() => templateId && navigate(`/generate/${templateId}`)}
      >
        <ReceiptText />
        {gstInvoice ? "Generate invoice" : "Generate receipt"}
      </Button>
    </div>
  );
};
