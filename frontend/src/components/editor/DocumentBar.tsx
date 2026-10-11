import React, { useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CopyPlus, MoreHorizontal, ReceiptText, Save } from "lucide-react";
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
  // Phones: name + Save, with Save as / Generate in a "more" menu
  compact?: boolean;
}> = ({ templateId, name, onNameChange, dirty, saving, onSave, compact = false }) => {
  const gstInvoice = useEditorStore((state) => state.documentType === "gst_invoice");
  const navigate = useNavigate();
  const nameId = useId();
  const [saveAsOpen, setSaveAsOpen] = useState(false);
  const [saveAsName, setSaveAsName] = useState("");

  const status = saving ? "Saving…" : dirty ? "Unsaved changes" : templateId ? "All changes saved" : "Not saved yet";
  const canGenerate = Boolean(templateId) && !dirty;
  const generate = () => templateId && navigate(`/generate/${templateId}`);
  const saveAsForm = (
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
  );
  const onSaveAsOpen = (open: boolean) => {
    setSaveAsOpen(open);
    if (open) setSaveAsName(`${name.trim() || "Untitled receipt"} (copy)`);
  };

  if (compact) {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <label htmlFor={nameId} className="sr-only">Template name</label>
        <Input id={nameId} value={name} onChange={(e) => onNameChange(e.target.value)} maxLength={TEMPLATE_NAME_MAX_LENGTH} className="h-8 min-w-0 flex-1 font-medium" />
        <span role="status" aria-label="Save status" className="sr-only">{status}</span>
        <Button type="button" size="sm" disabled={saving} onClick={() => onSave()} aria-label={`Save (${status})`}>
          <Save />
          {saving ? "…" : "Save"}
          {dirty && !saving && <span className="size-1.5 rounded-full bg-amber-400" aria-hidden="true" />}
        </Button>
        <Popover open={saveAsOpen} onOpenChange={onSaveAsOpen}>
          <PopoverTrigger asChild>
            <Button type="button" size="icon-sm" variant="outline" aria-label="More actions">
              <MoreHorizontal />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" collisionPadding={8} className="w-72 space-y-3">
            <p className="text-xs text-muted-foreground">{status}</p>
            <Button type="button" size="sm" variant="outline" className="w-full" disabled={!canGenerate} onClick={generate}>
              <ReceiptText />
              {gstInvoice ? "Generate invoice" : "Generate receipt"}
            </Button>
            {!canGenerate && <p className="text-xs text-muted-foreground">Save the template first.</p>}
            {saveAsForm}
          </PopoverContent>
        </Popover>
      </div>
    );
  }

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
      <Popover open={saveAsOpen} onOpenChange={onSaveAsOpen}>
        <PopoverTrigger asChild>
          <Button type="button" size="sm" variant="outline" disabled={saving}>
            <CopyPlus />
            Save as…
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72">{saveAsForm}</PopoverContent>
      </Popover>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!canGenerate}
        title={canGenerate ? "Fill in a receipt from this template" : "Save the template first"}
        onClick={generate}
      >
        <ReceiptText />
        {gstInvoice ? "Generate invoice" : "Generate receipt"}
      </Button>
    </div>
  );
};
