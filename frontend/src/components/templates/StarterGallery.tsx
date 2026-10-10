import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { createTemplate, templateKeys } from "../../api/templates";
import { apiErrorMessage } from "../../api/client";
import type { InvoicingMode } from "../../api/account";
import { STARTER_TEMPLATES, type StarterTemplate } from "../../lib/starterTemplates";
import { PAGE_PRESET_LABELS, type DocumentType } from "../../lib/units";
import { ReceiptPreview } from "../preview/ReceiptPreview";
import { useElementWidth } from "../generate/useElementWidth";
import { starterPreview } from "./starterPreview";

const THUMBNAIL_HEIGHT = 240;
const COLLAPSED_COUNT = 4;
const TABS: { value: DocumentType; label: string }[] = [
  { value: "receipt", label: "Receipts" },
  { value: "gst_invoice", label: "GST tax invoices" },
];

// The template filled with its sample business, scaled to the card's width
const Thumbnail: React.FC<{ starter: StarterTemplate }> = ({ starter }) => {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const preview = useMemo(() => starterPreview(starter), [starter]);
  const scale = width > 0 ? Math.min(1, width / starter.canvas.page.width) : 0;
  return (
    <div ref={ref} aria-hidden="true" className="pointer-events-none relative w-full overflow-hidden rounded-t-lg bg-gray-100" style={{ height: THUMBNAIL_HEIGHT }}>
      {scale > 0 && (
        <div className="flex justify-center">
          <ReceiptPreview canvas={starter.canvas} scale={scale} imagePlaceholders {...preview} />
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-gray-100 to-transparent" />
    </div>
  );
};

// A ready-made template, copied into the account and opened in the editor
const StarterCard: React.FC<{ starter: StarterTemplate; onError: (message: string) => void }> = ({ starter, onError }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const start = async () => {
    setBusy(true);
    try {
      const created = await createTemplate(starter.name, starter.canvas);
      await queryClient.invalidateQueries({ queryKey: templateKeys.all, exact: true });
      navigate(`/editor/${created.id}`);
    } catch (e) {
      onError(apiErrorMessage(e, "Couldn't create the template."));
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      data-starter={starter.id}
      disabled={busy}
      onClick={start}
      aria-label={`Use the ${starter.name} template`}
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-white text-left shadow-sm transition-colors hover:border-gray-400 disabled:opacity-60"
    >
      <Thumbnail starter={starter} />
      <span className="flex flex-1 flex-col gap-1 p-3">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium">{starter.name}</span>
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">{starter.business}</span>
        </span>
        <span className="text-xs text-muted-foreground">{PAGE_PRESET_LABELS[starter.canvas.page.preset]}</span>
        <span className="text-sm text-muted-foreground">{starter.description}</span>
        <span className="mt-auto pt-1 text-sm font-medium text-primary group-hover:underline">{busy ? "Creating…" : "Use this template"}</span>
      </span>
    </button>
  );
};

// Ten receipts and ten GST invoices; GST users see the invoices first
export const StarterGallery: React.FC<{ mode: InvoicingMode | null | undefined; onError: (message: string) => void }> = ({ mode, onError }) => {
  const [chosen, setTab] = useState<DocumentType | null>(null);
  const [expanded, setExpanded] = useState(false);
  const tab = chosen ?? (mode === "gst" ? "gst_invoice" : "receipt");
  const starters = STARTER_TEMPLATES.filter((s) => s.canvas.documentType === tab);
  const shown = expanded ? starters : starters.slice(0, COLLAPSED_COUNT);

  return (
    <section className="mb-8" aria-labelledby="starters-heading">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="starters-heading" className="text-sm font-semibold text-muted-foreground">Start from a ready-made template</h2>
        <div role="tablist" aria-label="Template kind" className="inline-flex rounded-md border border-border bg-white p-0.5">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              onClick={() => setTab(t.value)}
              className="rounded px-3 py-1 text-sm aria-selected:bg-gray-900 aria-selected:text-white"
            >
              {t.label} ({STARTER_TEMPLATES.filter((s) => s.canvas.documentType === t.value).length})
            </button>
          ))}
        </div>
      </div>
      <div role="tabpanel" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {shown.map((starter) => <StarterCard key={starter.id} starter={starter} onError={onError} />)}
      </div>
      {starters.length > COLLAPSED_COUNT && (
        <div className="mt-3 text-center">
          <Button variant="outline" size="sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? "Show fewer" : `Show all ${starters.length}`}
          </Button>
        </div>
      )}
    </section>
  );
};
