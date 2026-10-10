import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { accountKeys, updateAccount, useAccount, type Account } from "../api/account";
import { receiptKeys, useNextNumber } from "../api/receipts";
import { catalogKeys, forgetCustomer, forgetItem, useSavedCustomers, useSavedItems } from "../api/catalog";
import { apiErrorMessage } from "../api/client";
import { BUSINESS_NAME_MAX_LENGTH, RECEIPT_PREFIX_MAX_LENGTH, RECEIPT_PREFIX_PATTERN } from "../lib/units";
import { GSTIN_LENGTH, INVOICE_PREFIX_MAX_LENGTH, INVOICE_PREFIX_PATTERN, gstinProblem, stateLabel } from "../lib/gst";
import { ADDRESS_MAX_LENGTH } from "../components/generate/formModel";
import { INVOICING_OPTIONS } from "../api/account";

const schema = z.object({
  business_name: z.string().trim().max(BUSINESS_NAME_MAX_LENGTH, `Use at most ${BUSINESS_NAME_MAX_LENGTH} characters`),
  receipt_prefix: z
    .string()
    .max(RECEIPT_PREFIX_MAX_LENGTH, `Use at most ${RECEIPT_PREFIX_MAX_LENGTH} characters`)
    .regex(RECEIPT_PREFIX_PATTERN, "Use letters, digits, spaces and - _ / # . only"),
  numbering_mode: z.enum(["sequential", "nanoid"]),
  invoicing_mode: z.enum(["receipts", "gst", "both"]),
  // GST tax invoices (backend AccountUpdate)
  business_address: z.string().trim().max(ADDRESS_MAX_LENGTH, `Use at most ${ADDRESS_MAX_LENGTH} characters`),
  gstin: z.string().trim().toUpperCase().superRefine((gstin, ctx) => {
    const problem = gstin === "" ? null : gstinProblem(gstin);
    if (problem) ctx.addIssue({ code: "custom", message: problem });
  }),
  invoice_prefix: z
    .string()
    .max(INVOICE_PREFIX_MAX_LENGTH, `Use at most ${INVOICE_PREFIX_MAX_LENGTH} characters`)
    .regex(INVOICE_PREFIX_PATTERN, "Use letters, digits, - and / only"),
});
type SettingsValues = z.infer<typeof schema>;

const NUMBERING_OPTIONS = [
  { value: "sequential", label: "Sequential", hint: "Counts up: R-0001, R-0002, …" },
  { value: "nanoid", label: "Random ID", hint: "A 10-character code such as 7KQ2M9XW3A, hard to guess" },
] as const;

const SettingsForm: React.FC<{ account: Account }> = ({ account }) => {
  const queryClient = useQueryClient();
  const nextNumber = useNextNumber();
  const nextInvoice = useNextNumber("gst_invoice");
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const form = useForm<SettingsValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      business_name: account.business_name ?? "",
      receipt_prefix: account.receipt_prefix,
      numbering_mode: account.numbering_mode,
      invoicing_mode: account.invoicing_mode ?? "both",
      business_address: account.business_address ?? "",
      gstin: account.gstin ?? "",
      invoice_prefix: account.invoice_prefix,
    },
  });
  const { register, handleSubmit, formState, control, reset } = form;
  const [prefix, mode, invoicePrefix, gstin] = useWatch({ control, name: ["receipt_prefix", "numbering_mode", "invoice_prefix", "gstin"] });

  // The next sequence number with whatever prefix is being typed
  const digits = nextNumber.data?.next_number?.slice(account.receipt_prefix.length) ?? null;
  const preview = mode === "nanoid" ? "a random 10-character ID" : digits !== null ? `${prefix}${digits}` : null;
  // e.g. "26-27/0001" after the prefix
  const invoiceSuffix = nextInvoice.data?.next_number?.slice(account.invoice_prefix.length) ?? null;
  const gstinState = gstin && !gstinProblem(gstin.trim().toUpperCase()) ? stateLabel(gstin.trim().slice(0, 2)) : null;

  const onSubmit = async (values: SettingsValues) => {
    setStatus(null);
    try {
      const saved = await updateAccount(values);
      queryClient.setQueryData(accountKeys.me, saved);
      await queryClient.invalidateQueries({ queryKey: receiptKeys.nextNumber });
      reset({
        business_name: saved.business_name ?? "",
        receipt_prefix: saved.receipt_prefix,
        numbering_mode: saved.numbering_mode,
        invoicing_mode: saved.invoicing_mode ?? "both",
        business_address: saved.business_address ?? "",
        gstin: saved.gstin ?? "",
        invoice_prefix: saved.invoice_prefix,
      });
      setStatus({ ok: true, message: "Settings saved." });
    } catch (e) {
      setStatus({ ok: false, message: apiErrorMessage(e, "Couldn't save your settings.") });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6 rounded-lg border border-border bg-white p-6">
      <div className="space-y-1.5">
        <Label htmlFor="business-name">Business name</Label>
        <Input id="business-name" maxLength={BUSINESS_NAME_MAX_LENGTH} {...register("business_name")} />
        <p className="text-xs text-muted-foreground">Fills in the Business name field when you generate a receipt.</p>
        {formState.errors.business_name && <p className="text-xs text-destructive">{formState.errors.business_name.message}</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="invoicing-mode">You mostly create</Label>
        <select
          id="invoicing-mode"
          className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-xs"
          {...register("invoicing_mode")}
        >
          {INVOICING_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <p className="text-xs text-muted-foreground">Sets which starter templates come first and what a new blank template is.</p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Receipt numbers</legend>
        {NUMBERING_OPTIONS.map((option) => (
          <label key={option.value} className="flex cursor-pointer items-start gap-2 rounded-md border border-border p-3 has-[:checked]:border-primary">
            <input type="radio" value={option.value} className="mt-1" {...register("numbering_mode")} />
            <span>
              <span className="block text-sm font-medium">{option.label}</span>
              <span className="block text-xs text-muted-foreground">{option.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="receipt-prefix">Prefix for sequential numbers</Label>
        <Input
          id="receipt-prefix"
          maxLength={RECEIPT_PREFIX_MAX_LENGTH}
          disabled={mode === "nanoid"}
          aria-invalid={Boolean(formState.errors.receipt_prefix)}
          {...register("receipt_prefix")}
        />
        {formState.errors.receipt_prefix ? (
          <p className="text-xs text-destructive">{formState.errors.receipt_prefix.message}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            New receipts only; the count carries on. {preview && <>Next receipt: <strong data-next-number="">{preview}</strong></>}
          </p>
        )}
      </div>

      <fieldset className="space-y-4 rounded-md border border-border p-4">
        <legend className="px-1 text-sm font-medium">GST tax invoices</legend>
        <p className="text-xs text-muted-foreground">
          Printed on your GST invoices as the supplier. For GST-registered businesses with turnover up to ₹5 crore.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="gstin">GSTIN</Label>
          <Input id="gstin" maxLength={GSTIN_LENGTH} className="uppercase" autoComplete="off" aria-invalid={Boolean(formState.errors.gstin)} {...register("gstin")} />
          {formState.errors.gstin ? (
            <p className="text-xs text-destructive">{formState.errors.gstin.message}</p>
          ) : (
            gstinState && <p className="text-xs text-muted-foreground">Registered in {gstinState}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="business-address">Business address</Label>
          <Textarea id="business-address" rows={3} maxLength={ADDRESS_MAX_LENGTH} {...register("business_address")} />
          {formState.errors.business_address && <p className="text-xs text-destructive">{formState.errors.business_address.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="invoice-prefix">Invoice number prefix</Label>
          <Input id="invoice-prefix" maxLength={INVOICE_PREFIX_MAX_LENGTH} aria-invalid={Boolean(formState.errors.invoice_prefix)} {...register("invoice_prefix")} />
          {formState.errors.invoice_prefix ? (
            <p className="text-xs text-destructive">{formState.errors.invoice_prefix.message}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Invoices count up within each financial year, at most 16 characters.{" "}
              {invoiceSuffix && <>Next invoice: <strong data-next-invoice="">{`${invoicePrefix}${invoiceSuffix}`}</strong></>}
            </p>
          )}
        </div>
      </fieldset>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={formState.isSubmitting || !formState.isDirty}>
          {formState.isSubmitting ? "Saving…" : "Save settings"}
        </Button>
        {status && (
          <p role={status.ok ? "status" : "alert"} className={`text-sm ${status.ok ? "text-green-700" : "text-destructive"}`}>
            {status.message}
          </p>
        )}
      </div>
    </form>
  );
};

// /settings: business name and how receipt numbers are made
export const Settings: React.FC = () => {
  const { data: account, isError, error } = useAccount();
  return (
    <div className="mx-auto max-w-2xl p-4 sm:p-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link to="/templates" className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
          <ChevronLeft className="size-4" />
          Templates
        </Link>
        <h1 className="text-3xl font-bold">Settings</h1>
      </div>
      {account && <p className="mb-4 text-sm text-muted-foreground">Signed in as {account.email}</p>}
      {isError && <p role="alert" className="text-sm text-destructive">{apiErrorMessage(error, "Couldn't load your settings.")}</p>}
      {/* keyed by account so the form never keeps another account's values */}
      {account ? <SettingsForm key={account.id} account={account} /> : !isError && <p className="text-sm text-muted-foreground">Loading…</p>}
      {account && <SavedLists />}
    </div>
  );
};

// Customers and items remembered from past receipts (they fill in the Generate
// form as you type); anything outdated can be removed here
const SavedLists: React.FC = () => {
  const queryClient = useQueryClient();
  const customers = useSavedCustomers();
  const items = useSavedItems();
  const [problem, setProblem] = useState<string | null>(null);

  const forget = async (action: () => Promise<void>, key: readonly string[]) => {
    setProblem(null);
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: key });
    } catch (e) {
      setProblem(apiErrorMessage(e, "Couldn't remove it."));
    }
  };

  return (
    <section className="mt-6 space-y-4 rounded-lg border border-border bg-white p-6">
      <div>
        <h2 className="text-lg font-semibold">Saved customers and items</h2>
        <p className="text-sm text-muted-foreground">
          Remembered from your receipts. Typing a saved name in the Generate form fills in the rest.
        </p>
      </div>
      {problem && <p role="alert" className="text-sm text-destructive">{problem}</p>}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-medium">Customers</h3>
          {customers.data?.length ? (
            <ul className="divide-y divide-border text-sm" data-saved-customers="">
              {customers.data.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-2 py-1.5">
                  <span className="min-w-0">
                    <span className="block truncate">{c.name}</span>
                    {c.gstin && <span className="block text-xs text-muted-foreground">{c.gstin}</span>}
                  </span>
                  <Button type="button" variant="ghost" size="icon-xs" aria-label={`Forget ${c.name}`} onClick={() => forget(() => forgetCustomer(c.id), catalogKeys.customers)}>
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">None yet.</p>
          )}
        </div>
        <div>
          <h3 className="mb-2 text-sm font-medium">Items</h3>
          {items.data?.length ? (
            <ul className="divide-y divide-border text-sm" data-saved-items="">
              {items.data.map((i) => (
                <li key={i.id} className="flex items-start justify-between gap-2 py-1.5">
                  <span className="min-w-0">
                    <span className="block truncate">{i.description}</span>
                    <span className="block text-xs text-muted-foreground">
                      {i.unit_price}{i.hsn ? ` · HSN ${i.hsn}` : ""}{i.gst_rate !== null ? ` · GST ${Number(i.gst_rate)}%` : ""}
                    </span>
                  </span>
                  <Button type="button" variant="ghost" size="icon-xs" aria-label={`Forget ${i.description}`} onClick={() => forget(() => forgetItem(i.id), catalogKeys.items)}>
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">None yet.</p>
          )}
        </div>
      </div>
    </section>
  );
};
