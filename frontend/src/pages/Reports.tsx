import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, FileDown, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSalesReport, type SalesReport } from "../api/reports";
import { apiErrorMessage } from "../api/client";
import { DOCUMENT_TYPE_LABELS, OBJECT_URL_REVOKE_DELAY_MS, type DocumentType } from "../lib/units";
import { PERIOD_PRESETS, formatQuantity, reportCsv, type Period } from "../lib/report";
import { currencyPrefix } from "../lib/whatsapp";

const SELECT_CLASS = "h-8 rounded-lg border border-input bg-white px-2 text-sm";

const money = (amount: string, currency: string) => {
  const value = Number(amount);
  const digits = Math.abs(value).toLocaleString(currency === "INR" ? "en-IN" : "en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${value < 0 ? "−" : ""}${currencyPrefix(currency)}${digits}`;
};

function downloadCsv(report: SalesReport) {
  const url = URL.createObjectURL(new Blob(["﻿" + reportCsv(report)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `sales-${report.start}-to-${report.end}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), OBJECT_URL_REVOKE_DELAY_MS);
}

const TotalRow: React.FC<{ label: string; value: string; currency: string; strong?: boolean }> = ({ label, value, currency, strong }) => (
  <tr className={strong ? "border-t border-gray-300 text-base font-bold" : ""} data-total={label}>
    <td colSpan={4} className="px-4 py-1.5 text-right">{label}</td>
    <td className="px-4 py-1.5 text-right tabular-nums">{money(value, currency)}</td>
  </tr>
);

const ReportTable: React.FC<{ report: SalesReport }> = ({ report }) => {
  const currency = report.currency ?? "INR";
  const { totals } = report;
  const otherTax = (Number(totals.tax) - Number(totals.cgst) - Number(totals.sgst) - Number(totals.igst)).toFixed(2);
  const shown = (v: string) => Number(v) !== 0;
  const gstSplit = shown(totals.cgst) || shown(totals.igst);
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-white">
      <table className="w-full text-sm" data-sales-report="">
        <thead className="bg-gray-50 text-left text-xs uppercase text-gray-600">
          <tr>
            <th className="px-4 py-2">Item</th>
            <th className="px-4 py-2">Unit</th>
            <th className="px-4 py-2 text-right">Qty sold</th>
            <th className="px-4 py-2 text-right">On receipts</th>
            <th className="px-4 py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {report.items.map((item) => (
            <tr key={`${item.description}|${item.unit}`} className="border-t border-gray-100" data-report-item={item.description}>
              <td className="px-4 py-2">{item.description}</td>
              <td className="px-4 py-2 text-gray-600">{item.unit ?? ""}</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatQuantity(item.quantity)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{item.receipts}</td>
              <td className="px-4 py-2 text-right tabular-nums">{money(item.amount, currency)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-gray-200 bg-gray-50/60">
          <TotalRow label="Subtotal" value={totals.subtotal} currency={currency} />
          {shown(totals.discount) && <TotalRow label="Discount" value={`-${totals.discount}`} currency={currency} />}
          <TotalRow label="Taxable value" value={totals.taxable} currency={currency} />
          {/* The GST split, when there is one; otherwise just the tax */}
          {gstSplit && shown(totals.cgst) && <TotalRow label="CGST" value={totals.cgst} currency={currency} />}
          {gstSplit && shown(totals.sgst) && <TotalRow label="SGST / UTGST" value={totals.sgst} currency={currency} />}
          {gstSplit && shown(totals.igst) && <TotalRow label="IGST" value={totals.igst} currency={currency} />}
          {gstSplit && shown(otherTax) && <TotalRow label="Other tax (receipts)" value={otherTax} currency={currency} />}
          <TotalRow label={gstSplit ? "Total tax" : "Tax"} value={totals.tax} currency={currency} />
          <TotalRow label="Total sales" value={totals.total} currency={currency} strong />
        </tfoot>
      </table>
    </div>
  );
};

// The preset's dates as of today
const presetPeriod = (id: string) => PERIOD_PRESETS.find((p) => p.id === id)!.period(new Date());
const thisMonth = () => presetPeriod("this-month");

// /reports: what sold over a period, item by item, with the sales and tax totals
export const Reports: React.FC = () => {
  const [presetId, setPresetId] = useState("this-month");
  const [period, setPeriod] = useState<Period>(thisMonth);
  const [documentType, setDocumentType] = useState<DocumentType | "">("");
  const [currency, setCurrency] = useState("");
  const valid = Boolean(period.start && period.end && period.start <= period.end);
  const { data: report, isFetching, isError, error } = useSalesReport(
    { ...period, ...(currency ? { currency } : {}), ...(documentType ? { document_type: documentType } : {}) },
    valid,
  );

  const pickPreset = (id: string) => {
    setPresetId(id);
    setPeriod(presetPeriod(id));
  };
  const setDate = (key: keyof Period, value: string) => {
    setPresetId("custom");
    setPeriod((p) => ({ ...p, [key]: value }));
  };

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-8 print:p-0">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/templates" className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 print:hidden">
            <ChevronLeft className="size-4" />
            Templates
          </Link>
          <h1 className="text-3xl font-bold">Sales report</h1>
        </div>
        {report && report.receipt_count > 0 && (
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={() => downloadCsv(report)}><FileDown />Download CSV</Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}><Printer />Print</Button>
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5 print:hidden" role="group" aria-label="Period">
        {PERIOD_PRESETS.map((p) => (
          <Button key={p.id} size="sm" variant={presetId === p.id ? "default" : "outline"} aria-pressed={presetId === p.id} onClick={() => pickPreset(p.id)}>
            {p.label}
          </Button>
        ))}
      </div>
      <div className="mb-6 flex flex-wrap items-end gap-4 print:hidden">
        <div className="space-y-1">
          <Label htmlFor="report-start">From</Label>
          <Input id="report-start" type="date" value={period.start} onChange={(e) => setDate("start", e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="report-end">To</Label>
          <Input id="report-end" type="date" value={period.end} onChange={(e) => setDate("end", e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="report-type">Include</Label>
          <select id="report-type" className={SELECT_CLASS} value={documentType} onChange={(e) => setDocumentType(e.target.value as DocumentType | "")}>
            <option value="">Receipts and GST invoices</option>
            {(Object.keys(DOCUMENT_TYPE_LABELS) as DocumentType[]).map((t) => <option key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}s only</option>)}
          </select>
        </div>
        {report && report.currencies.length > 1 && (
          <div className="space-y-1">
            <Label htmlFor="report-currency">Currency</Label>
            <select id="report-currency" className={SELECT_CLASS} value={report.currency ?? ""} onChange={(e) => setCurrency(e.target.value)}>
              {report.currencies.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}
      </div>

      {!valid && <p role="alert" className="text-sm text-destructive">Pick a start date on or before the end date.</p>}
      {isError && <p role="alert" className="text-sm text-destructive">{apiErrorMessage(error, "Couldn't load the report.")}</p>}
      {valid && !report && isFetching && <p className="text-sm text-muted-foreground">Adding up your sales…</p>}

      {valid && report && (
        <div className={isFetching ? "opacity-60 transition-opacity" : ""}>
          <p className="mb-3 text-sm text-muted-foreground" data-report-period="">
            {report.start} to {report.end} · {report.receipt_count} {report.receipt_count === 1 ? "receipt" : "receipts"}
            {report.currencies.length > 1 && report.currency ? ` in ${report.currency}` : ""} · by receipt date
          </p>
          {report.receipt_count === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-muted-foreground">
              No receipts in this period.
            </p>
          ) : (
            <>
              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  ["Total sales", report.totals.total],
                  ["Total tax", report.totals.tax],
                  ["Receipts", String(report.receipt_count)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-border bg-white p-4">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-2xl font-bold tabular-nums">{label === "Receipts" ? value : money(value, report.currency ?? "INR")}</p>
                  </div>
                ))}
              </div>
              <ReportTable report={report} />
              <p className="mt-2 text-xs text-muted-foreground">
                Amount is quantity × price, before discounts and tax; receipt-wide discounts and tax are in the totals.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
};
