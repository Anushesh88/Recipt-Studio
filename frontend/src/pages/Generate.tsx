import React, { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { useTemplate } from "../api/templates";
import { apiErrorMessage } from "../api/client";
import { canvasSchema } from "../schema/templateSchema";
import { GenerateForm } from "../components/generate/GenerateForm";

// /generate/:templateId — fill in a receipt from a saved template
export const Generate: React.FC = () => {
  const { templateId } = useParams();
  const query = useTemplate(templateId);
  const parsed = useMemo(() => (query.data ? canvasSchema.safeParse(query.data.canvas) : null), [query.data]);

  let body: React.ReactNode;
  if (query.data && parsed?.success && templateId) {
    body = <GenerateForm key={templateId} templateId={templateId} templateName={query.data.name} canvas={parsed.data} />;
  } else if (query.isError) {
    body = <p className="p-8 text-sm text-destructive">{apiErrorMessage(query.error, "Couldn't load this template.")}</p>;
  } else if (parsed && !parsed.success) {
    body = <p className="p-8 text-sm text-destructive">This template is invalid; open it in the editor to fix it.</p>;
  } else {
    body = <p className="p-8 text-sm text-muted-foreground">Loading template…</p>;
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border bg-white px-4 py-2">
        <Link to="/templates" className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
          <ChevronLeft className="size-4" />
          Templates
        </Link>
        <div className="h-6 w-px bg-gray-300" />
        <h1 className="min-w-0 truncate text-base font-semibold sm:text-lg">Generate receipt{query.data ? ` · ${query.data.name}` : ""}</h1>
        {templateId && (
          <Link to={`/editor/${templateId}`} className="ml-auto text-sm text-blue-600 hover:underline">Edit template</Link>
        )}
      </header>
      {body}
    </div>
  );
};
