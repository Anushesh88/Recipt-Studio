import React from "react";
import { Link } from "react-router-dom";
import { BarChart3, ChevronLeft, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReceipts } from "../api/receipts";
import { apiErrorMessage } from "../api/client";
import { ExportButtons } from "../components/receipts/ExportButtons";
import { useIsMobile } from "../lib/useIsMobile";

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "";

// /history: every receipt generated, newest first, with re-download
export const History: React.FC = () => {
  const { data: receipts, isLoading, isError, error } = useReceipts();
  const isMobile = useIsMobile();

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link to="/templates" className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
          <ChevronLeft className="size-4" />
          Templates
        </Link>
        <h1 className="text-2xl font-bold sm:text-3xl">Receipt history</h1>
        <Button asChild variant="outline" size="sm" className="ml-auto">
          <Link to="/reports"><BarChart3 />Sales report</Link>
        </Button>
      </div>

      {isError && <p role="alert" className="text-sm text-destructive">{apiErrorMessage(error, "Couldn't load your receipts.")}</p>}
      {isLoading && <p className="text-sm text-muted-foreground">Loading receipts…</p>}
      {receipts && receipts.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No receipts yet. Pick a template on the <Link to="/templates" className="text-blue-600 hover:underline">Templates</Link> page and generate one.
        </p>
      )}

      {/* Phones: one card per receipt instead of a wide table */}
      {receipts && receipts.length > 0 && isMobile && (
        <ul className="space-y-3">
          {receipts.map((r) => (
            <li key={r.id} data-receipt-card={r.receipt_number} className="rounded-lg border border-border bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {r.receipt_number}
                    {r.document_type === "gst_invoice" && <span className="ml-1.5 rounded bg-emerald-50 px-1 text-xs font-medium text-emerald-800">GST</span>}
                  </p>
                  <p className="truncate text-sm text-gray-700">{r.customer_name ?? "No customer name"}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(r.created_at)}</p>
                </div>
                <p className="shrink-0 font-semibold tabular-nums">{r.currency} {r.total_amount}</p>
              </div>
              <div className="mt-3">
                <ExportButtons receiptId={r.id} receiptNumber={r.receipt_number} size="sm" receipt={r} layout="card">
                  {r.template_id && (
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/generate/${r.template_id}?from=${r.id}`} aria-label={`Use ${r.receipt_number} again`}><Repeat />Use again</Link>
                    </Button>
                  )}
                </ExportButtons>
              </div>
            </li>
          ))}
        </ul>
      )}
      {receipts && receipts.length > 0 && !isMobile && (
        <div className="overflow-x-auto rounded-lg border border-border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Number</th>
                <th className="px-4 py-2 font-medium">Customer</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
                <th className="px-4 py-2 font-medium">Created</th>
                <th className="px-4 py-2 font-medium">Download</th>
                <th className="px-4 py-2 font-medium"><span className="sr-only">Use again</span></th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((r) => (
                <tr key={r.id} data-receipt-row={r.receipt_number} className="border-t border-border align-top">
                  <td className="px-4 py-3 font-medium">
                    {r.receipt_number}
                    {r.document_type === "gst_invoice" && <span className="ml-1.5 rounded bg-emerald-50 px-1 text-xs font-medium text-emerald-800">GST</span>}
                  </td>
                  <td className="px-4 py-3">{r.customer_name ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.currency} {r.total_amount}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(r.created_at)}</td>
                  <td className="px-4 py-3"><ExportButtons receiptId={r.id} receiptNumber={r.receipt_number} size="xs" receipt={r} /></td>
                  <td className="px-4 py-3">
                    {/* a new receipt with the same customer and items (new number and date) */}
                    {r.template_id ? (
                      <Button asChild size="xs" variant="ghost">
                        <Link to={`/generate/${r.template_id}?from=${r.id}`} aria-label={`Use ${r.receipt_number} again`}><Repeat />Use again</Link>
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground" title="Its template was deleted">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
