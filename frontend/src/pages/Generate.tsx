import React, { useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useTemplate } from "../api/templates";
import { useReceipt } from "../api/receipts";
import { apiErrorMessage } from "../api/client";
import { canvasSchema } from "../schema/templateSchema";
import { GenerateForm } from "../components/generate/GenerateForm";
import { buildFormModel, valuesFromReceipt } from "../components/generate/formModel";

// /generate/:templateId: fill in a receipt from a saved template.
// ?from=<receipt id> ("Use again" in History) starts from that receipt's details.
export const Generate: React.FC = () => {
  const { templateId } = useParams();
  const [search] = useSearchParams();
  const fromId = search.get("from");
  const query = useTemplate(templateId);
  const previous = useReceipt(fromId);
  const parsed = useMemo(() => (query.data ? canvasSchema.safeParse(query.data.canvas) : null), [query.data]);
  const initial = useMemo(
    () => (parsed?.success && previous.data ? valuesFromReceipt(previous.data, buildFormModel(parsed.data)) : undefined),
    [parsed, previous.data],
  );

  let body: React.ReactNode;
  if (query.data && parsed?.success && templateId && (!fromId || previous.data || previous.isError)) {
    body = (
      <GenerateForm
        key={`${templateId}:${fromId ?? ""}`}
        templateId={templateId}
        templateName={query.data.name}
        canvas={parsed.data}
        initial={initial}
      />
    );
  } else if (query.isError) {
    body = <p className="p-8 text-sm text-destructive">{apiErrorMessage(query.error, "Couldn't load this template.")}</p>;
  } else if (parsed && !parsed.success) {
    body = <p className="p-8 text-sm text-destructive">This template is invalid; open it in the editor to fix it.</p>;
  } else {
    body = <p className="p-8 text-sm text-muted-foreground">Loading template…</p>;
  }

  const gst = parsed?.success && parsed.data.documentType === "gst_invoice";
  return (
    <div className="flex h-screen flex-col">
      <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border bg-white px-4 py-2">
        <Link to="/templates" className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
          <ChevronLeft className="size-4" />
          Templates
        </Link>
        <div className="h-6 w-px bg-gray-300" />
        <h1 className="min-w-0 truncate text-base font-semibold sm:text-lg">
          {gst ? "Generate GST invoice" : "Generate receipt"}{query.data ? ` · ${query.data.name}` : ""}
        </h1>
        {templateId && (
          <Link to={`/editor/${templateId}`} className="ml-auto text-sm text-blue-600 hover:underline">Edit template</Link>
        )}
      </header>
      {fromId && previous.isError && (
        <p role="alert" className="border-b border-border bg-amber-50 px-4 py-2 text-sm text-amber-900">
          Couldn't load the receipt to start from; the form is blank.
        </p>
      )}
      {body}
    </div>
  );
};
