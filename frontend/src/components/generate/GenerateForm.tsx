import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useFieldArray, useForm, useWatch, type FieldErrors, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Canvas } from "../../schema/templateSchema";
import {
  createReceipt,
  receiptApiError,
  receiptKeys,
  requestFieldErrors,
  useNextNumber,
  type ReceiptApiError,
  type ReceiptRecord,
} from "../../api/receipts";
import { catalogKeys, findByDescription, findByName, useSavedCustomers, useSavedItems } from "../../api/catalog";
import { apiErrorMessage } from "../../api/client";
import { hasGstProfile, useAccount } from "../../api/account";
import { variableLabel, CUSTOM_PREFIX } from "../../lib/variables";
import { COMMON_GST_RATES, COMMON_UNITS, STATE_OPTIONS, UNIT_MAX_LENGTH, gstinState, stateLabel } from "../../lib/gst";
import { ReceiptPreview } from "../preview/ReceiptPreview";
import { ExportButtons } from "../receipts/ExportButtons";
import { useElementWidth } from "./useElementWidth";
import {
  CURRENCY_CODE_LENGTH,
  CUSTOM_VALUE_MAX_LENGTH,
  MAX_LINE_ITEMS,
  PREVIEW_MAX_WIDTH_PX,
  RECEIPT_NUMBER_MAX_LENGTH,
  SHORT_TEXT_MAX_LENGTH,
} from "../../lib/units";
import {
  buildFormModel,
  emptyLineItem,
  FIELD_MAX_LENGTH,
  GST_CURRENCY,
  previewFromForm,
  previewFromReceipt,
  REQUIRED_ON_INVOICE,
  toPayload,
  type BuiltinField,
  type GenerateValues,
} from "./formModel";

const COMMON_CURRENCIES = ["USD", "EUR", "GBP", "INR", "CAD", "AUD", "JPY", "CHF", "SGD", "AED"];
const PAYMENT_METHODS = ["Cash", "Card", "Bank transfer", "UPI", "Mobile wallet", "Cheque"];
const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

// errors["customer"]["name"] for "customer.name"
function errorAt(errors: FieldErrors<GenerateValues>, path: string): string | undefined {
  let node: unknown = errors;
  for (const part of path.split(".")) node = (node as Record<string, unknown> | undefined)?.[part];
  const message = (node as { message?: unknown } | undefined)?.message;
  return typeof message === "string" ? message : undefined;
}

// What to show at each field the server named
function fieldMessage(apiError: ReceiptApiError, field: string): string {
  if (apiError.code === "MISSING_VARIABLES") return `${variableLabel(field)} is required`;
  if (apiError.code === "QR_CONTENT_TOO_LONG") return "Too long for the QR code";
  if (apiError.code === "GST_DETAILS_REQUIRED") return REQUIRED_ON_INVOICE;
  return apiError.message;
}

// The "Bill to" fields of a GST invoice
const GST_PARTY_KEYS = new Set<BuiltinField>(["customer.name", "customer.gstin", "customer.address", "receipt.place_of_supply", "receipt.reverse_charge"]);

// Codes whose message also goes above the submit button
const FORM_LEVEL_CODES = new Set(["MISSING_VARIABLES", "QR_CONTENT_TOO_LONG", "GST_DETAILS_REQUIRED", "GST_PROFILE_INCOMPLETE"]);

const FieldError: React.FC<{ message?: string }> = ({ message }) =>
  message ? <p className="text-xs text-destructive">{message}</p> : null;

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-3 rounded-lg border border-border bg-white p-4">
    <h2 className="text-sm font-semibold">{title}</h2>
    {children}
  </section>
);

export const GenerateForm: React.FC<{
  templateId: string;
  templateName: string;
  canvas: Canvas;
  // "Use again": values to start from (another receipt's)
  initial?: GenerateValues;
}> = ({ templateId, templateName, canvas, initial }) => {
  const queryClient = useQueryClient();
  const model = useMemo(() => buildFormModel(canvas), [canvas]);
  const { gst } = model;
  const account = useAccount();
  const savedCustomers = useSavedCustomers();
  const savedItems = useSavedItems();
  const [previewRef, previewWidth] = useElementWidth<HTMLDivElement>();
  const [created, setCreated] = useState<ReceiptRecord | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const kind = gst ? "invoice" : "receipt";

  // Errors show from the first submit on (then update as you type). Validating on
  // blur made messages appear mid-click and shift buttons out from under the pointer.
  const form = useForm<GenerateValues>({ resolver: zodResolver(model.schema), defaultValues: initial ?? model.defaults });
  const { register, control, handleSubmit, formState, setError, reset, getValues, setValue } = form;
  const items = useFieldArray({ control, name: "items" });
  const watched = useWatch({ control }) as GenerateValues;

  // Business name comes from Settings unless the user already typed one (on a
  // GST invoice it always does); a GST sale is in the seller's state by default
  const profile = account.data;
  useEffect(() => {
    if (!gst && profile?.business_name && !getValues("business.name")) setValue("business.name", profile.business_name);
    const supplierState = profile?.gstin ? gstinState(profile.gstin) : null;
    if (gst && supplierState && !getValues("receipt.place_of_supply")) setValue("receipt.place_of_supply", supplierState);
  }, [gst, profile, getValues, setValue]);

  const nextNumber = useNextNumber(canvas.documentType, gst ? watched.receipt?.date : undefined);
  const autoNumber = nextNumber.data && nextNumber.data.mode !== "nanoid" ? nextNumber.data.next_number : null;
  const preview = created ? previewFromReceipt(created) : previewFromForm(watched, autoNumber, gst, profile);
  // Fit the page to the preview column (narrow on phones), never above 100%
  const fitWidth = previewWidth > 0 ? Math.min(previewWidth, PREVIEW_MAX_WIDTH_PX) : PREVIEW_MAX_WIDTH_PX;
  const scale = Math.min(1, fitWidth / canvas.page.width);
  const err = (path: string) => errorAt(formState.errors, path);
  const gstBlocked = gst && account.isSuccess && !hasGstProfile(profile);

  // Fills empty fields from a saved customer / item when one is picked
  const fillEmpty = (path: Path<GenerateValues>, value: string | null | undefined) => {
    if (value && !getValues(path)) setValue(path, value, { shouldDirty: true });
  };
  const onCustomerName = (name: string) => {
    const saved = findByName(savedCustomers.data, name);
    if (!saved) return;
    fillEmpty("customer.email", saved.email);
    fillEmpty("customer.address", saved.address);
    fillEmpty("customer.gstin", saved.gstin);
    if (gst && saved.state_code) setValue("receipt.place_of_supply", saved.state_code);
  };
  const onCustomerGstin = (gstin: string) => {
    const state = gstinState(gstin.trim().toUpperCase());
    if (gst && state) setValue("receipt.place_of_supply", state);
  };
  const onItemDescription = (index: number, description: string) => {
    const saved = findByDescription(savedItems.data, description);
    if (!saved) return;
    fillEmpty(`items.${index}.unit_price`, saved.unit_price);
    if (gst) {
      fillEmpty(`items.${index}.hsn`, saved.hsn);
      fillEmpty(`items.${index}.unit`, saved.unit);
      fillEmpty(`items.${index}.gst_rate`, saved.gst_rate === null ? null : String(Number(saved.gst_rate)));
    }
  };

  // A name typed before the saved lists arrived is matched once they do
  const matchedOnLoad = React.useRef({ customers: false, items: false });
  useEffect(() => {
    if (!savedCustomers.data || matchedOnLoad.current.customers) return;
    matchedOnLoad.current.customers = true;
    onCustomerName(getValues("customer.name") ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the list first loads
  }, [savedCustomers.data]);
  useEffect(() => {
    if (!savedItems.data || matchedOnLoad.current.items) return;
    matchedOnLoad.current.items = true;
    (getValues("items") ?? []).forEach((item, index) => onItemDescription(index, item.description));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the list first loads
  }, [savedItems.data]);

  const onSubmit = async (values: GenerateValues) => {
    setFormError(null);
    try {
      const receipt = await createReceipt(templateId, toPayload(values, model));
      setCreated(receipt);
      void queryClient.invalidateQueries({ queryKey: receiptKeys.all });
      void queryClient.invalidateQueries({ queryKey: catalogKeys.customers });
      void queryClient.invalidateQueries({ queryKey: catalogKeys.items });
    } catch (e) {
      const apiError = receiptApiError(e);
      const invalid = requestFieldErrors(e);
      if (apiError && (apiError.fields.length > 0 || FORM_LEVEL_CODES.has(apiError.code))) {
        // The API names fields with the same dotted paths as the form
        for (const field of apiError.fields) {
          setError(field as Path<GenerateValues>, { message: fieldMessage(apiError, field) }, { shouldFocus: true });
        }
        if (FORM_LEVEL_CODES.has(apiError.code)) setFormError(apiError.message);
      } else if (invalid.length > 0) {
        for (const { field, message } of invalid) {
          setError(field as Path<GenerateValues>, { message }, { shouldFocus: true });
        }
        setFormError("Some values weren't accepted; see the highlighted fields.");
      } else {
        setFormError(apiErrorMessage(e, `Couldn't create the ${kind}. Please try again.`));
      }
    }
  };

  const startAnother = () => {
    const previous = getValues();
    // Keep who's issuing it and how; clear what's specific to the last receipt
    reset({
      ...model.defaults,
      business: previous.business,
      receipt: {
        ...model.defaults.receipt,
        currency: previous.receipt.currency,
        payment_method: previous.receipt.payment_method,
        place_of_supply: gst ? (profile?.gstin ? gstinState(profile.gstin) ?? "" : "") : "",
      },
      tax_percent: previous.tax_percent,
    });
    setCreated(null);
  };

  const builtinInput = (key: BuiltinField) => {
    const id = `field-${key}`;
    const label = (gst && key === "receipt.date" ? "Invoice date" : variableLabel(key)) + (key === "receipt.notes" ? " (optional)" : "");
    const path = key as Path<GenerateValues>;
    if (key === "receipt.reverse_charge") {
      return (
        <div key={key} className="flex items-center gap-2">
          <input id={id} type="checkbox" className="size-4" {...register("receipt.reverse_charge")} />
          <Label htmlFor={id} className="font-normal">Tax payable on reverse charge</Label>
        </div>
      );
    }
    let control: React.ReactNode;
    if (key === "receipt.notes" || key === "customer.address") {
      control = <Textarea id={id} rows={2} maxLength={FIELD_MAX_LENGTH[key]} aria-invalid={Boolean(err(key))} {...register(path)} />;
    } else if (key === "receipt.place_of_supply") {
      control = (
        <select id={id} className={SELECT_CLASS} aria-invalid={Boolean(err(key))} {...register(path)}>
          <option value="">Pick a state…</option>
          {STATE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    } else {
      const handlers =
        key === "customer.name" ? { onChange: (e: React.ChangeEvent<HTMLInputElement>) => onCustomerName(e.target.value) }
        : key === "customer.gstin" ? { onChange: (e: React.ChangeEvent<HTMLInputElement>) => onCustomerGstin(e.target.value) }
        : {};
      control = (
        <Input
          id={id}
          type={key === "customer.email" ? "email" : key === "receipt.date" ? "date" : "text"}
          maxLength={FIELD_MAX_LENGTH[key]}
          list={key === "receipt.payment_method" ? "payment-methods" : key === "customer.name" ? "saved-customers" : undefined}
          className={key === "customer.gstin" ? "uppercase placeholder:normal-case" : undefined}
          placeholder={key === "customer.gstin" && gst ? "Blank if the buyer isn't registered" : undefined}
          autoComplete="off"
          aria-invalid={Boolean(err(key))}
          {...register(path, handlers)}
        />
      );
    }
    return (
      <div key={key} className="space-y-1.5">
        <Label htmlFor={id}>{label}</Label>
        {control}
        <FieldError message={err(key)} />
      </div>
    );
  };

  const customFields = model.customKeys.map((key) => {
    const path = `custom.${key}`;
    return (
      <div key={key} className="space-y-1.5">
        <Label htmlFor={`field-custom-${key}`}>{variableLabel(CUSTOM_PREFIX + key)}</Label>
        <Input
          id={`field-custom-${key}`}
          maxLength={CUSTOM_VALUE_MAX_LENGTH}
          aria-invalid={Boolean(err(path))}
          {...register(path as Path<GenerateValues>)}
        />
        <FieldError message={err(path)} />
      </div>
    );
  });

  const partyFields = model.builtinFields.filter((key) => gst && GST_PARTY_KEYS.has(key));
  const otherFields = model.builtinFields.filter((key) => !(gst && (GST_PARTY_KEYS.has(key) || key === "receipt.date")));

  const description = (index: number) => (
    <>
      <Input
        aria-label={`Item ${index + 1} description`}
        placeholder="Description"
        list="saved-items"
        autoComplete="off"
        maxLength={SHORT_TEXT_MAX_LENGTH}
        {...register(`items.${index}.description`, { onChange: (e) => onItemDescription(index, e.target.value) })}
      />
      <FieldError message={err(`items.${index}.description`)} />
    </>
  );

  const miniField = (index: number, name: "hsn" | "qty" | "unit" | "unit_price" | "discount" | "gst_rate", label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="space-y-1">
      <span className="block text-[11px] text-muted-foreground" aria-hidden="true">{label}</span>
      <Input aria-label={`Item ${index + 1} ${label}`} className="h-8 px-2" autoComplete="off" {...extra} {...register(`items.${index}.${name}`)} />
      <FieldError message={err(`items.${index}.${name}`)} />
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
      <div className="w-full border-b border-border bg-gray-50 p-4 lg:w-[34rem] lg:shrink-0 lg:overflow-y-auto lg:border-r lg:border-b-0">
        <datalist id="saved-customers">{savedCustomers.data?.map((c) => <option key={c.id} value={c.name} />)}</datalist>
        <datalist id="saved-items">{savedItems.data?.map((i) => <option key={i.id} value={i.description} />)}</datalist>
        {created ? (
          <div className="space-y-4">
            <Section title={gst ? "Invoice created" : "Receipt created"}>
              <div className="flex items-start gap-3" role="status">
                <CheckCircle2 className="mt-0.5 size-5 text-green-600" />
                <div>
                  <p className="font-medium">{gst ? "Invoice" : "Receipt"} {created.receipt_number} saved</p>
                  <p className="text-sm text-muted-foreground">
                    Total {created.currency} {created.total_amount}, from “{templateName}”. Amounts were computed by the server.
                  </p>
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Download or share</p>
                <ExportButtons receiptId={created.id} receiptNumber={created.receipt_number} receipt={{ ...created, customer_name: created.data.customer.name ?? null }} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={startAnother}>Generate another</Button>
                <Button asChild variant="outline"><Link to="/history">Receipt history</Link></Button>
                <Button asChild variant="ghost"><Link to="/templates">Back to templates</Link></Button>
              </div>
            </Section>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate data-generate-form="">
            {gst && (
              <Section title="From">
                {hasGstProfile(profile) ? (
                  <div className="space-y-0.5 text-sm" data-supplier="">
                    <p className="font-medium">{profile.business_name}</p>
                    <p className="whitespace-pre-line text-muted-foreground">{profile.business_address}</p>
                    <p className="text-muted-foreground">
                      GSTIN {profile.gstin} · {stateLabel(profile.gstin!.slice(0, 2))}
                    </p>
                    <Link to="/settings" className="text-xs text-blue-600 hover:underline">Change in Settings</Link>
                  </div>
                ) : account.isSuccess ? (
                  <p role="alert" className="text-sm text-destructive">
                    Add your business name, address and GSTIN in{" "}
                    <Link to="/settings" className="underline">Settings</Link> to issue GST invoices.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Loading your business details…</p>
                )}
              </Section>
            )}

            <Section title={gst ? "Invoice" : "Receipt"}>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="field-receipt-number">{gst ? "Invoice number" : "Receipt number"}</Label>
                  <Input
                    id="field-receipt-number"
                    maxLength={RECEIPT_NUMBER_MAX_LENGTH}
                    placeholder={autoNumber ?? (nextNumber.data?.mode === "nanoid" ? "Random ID" : "Automatic")}
                    aria-invalid={Boolean(err("receipt.number"))}
                    {...register("receipt.number")}
                  />
                  {err("receipt.number") ? (
                    <FieldError message={err("receipt.number")} />
                  ) : (
                    <p className="text-xs text-muted-foreground">Leave blank to use the next number.</p>
                  )}
                </div>
                {gst ? builtinInput("receipt.date") : (
                  <div className="space-y-1.5">
                    <Label htmlFor="field-currency">Currency</Label>
                    <Input id="field-currency" list="currencies" maxLength={CURRENCY_CODE_LENGTH} className="uppercase" {...register("receipt.currency")} />
                    <FieldError message={err("receipt.currency")} />
                  </div>
                )}
              </div>
              {gst && <p className="text-xs text-muted-foreground">GST invoices are in {GST_CURRENCY}. Numbers restart each financial year (April to March).</p>}
              <datalist id="currencies">{COMMON_CURRENCIES.map((c) => <option key={c} value={c} />)}</datalist>
              <datalist id="payment-methods">{PAYMENT_METHODS.map((m) => <option key={m} value={m} />)}</datalist>
            </Section>

            {gst && (
              <Section title="Bill to">
                {partyFields.map(builtinInput)}
                <p className="text-xs text-muted-foreground">
                  A registered buyer needs their GSTIN, name and address; an unregistered one their name and address
                  from a taxable value of ₹50,000.
                </p>
              </Section>
            )}

            {(otherFields.length > 0 || model.customKeys.length > 0) && (
              <Section title={gst ? "Other details" : "Details used by this template"}>
                {otherFields.map(builtinInput)}
                {customFields}
              </Section>
            )}

            <Section title="Line items">
              {gst ? (
                <div className="space-y-2">
                  <datalist id="gst-rates">{COMMON_GST_RATES.map((r) => <option key={r} value={r} />)}</datalist>
                  <datalist id="units">{COMMON_UNITS.map((u) => <option key={u} value={u} />)}</datalist>
                  {items.fields.map((field, index) => (
                    <div key={field.id} className="space-y-2 rounded-md border border-border p-2" data-line-item={index}>
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">{description(index)}</div>
                        <p className="pt-2 text-right text-sm tabular-nums" aria-label={`Item ${index + 1} taxable value`}>
                          {preview.rows[index]?.taxable_value ?? "—"}
                        </p>
                        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove item ${index + 1}`} onClick={() => items.remove(index)}>
                          <Trash2 />
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                        {miniField(index, "hsn", "HSN/SAC", { inputMode: "numeric", maxLength: 8 })}
                        {miniField(index, "qty", "Qty", { inputMode: "decimal" })}
                        {miniField(index, "unit", "Unit", { list: "units", maxLength: UNIT_MAX_LENGTH, className: "h-8 px-2 uppercase" })}
                        {miniField(index, "unit_price", "Price", { inputMode: "decimal", placeholder: "0.00" })}
                        {miniField(index, "discount", "Discount", { inputMode: "decimal", placeholder: "0" })}
                        {miniField(index, "gst_rate", "GST %", { inputMode: "decimal", list: "gst-rates" })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="hidden grid-cols-[1fr_4.5rem_6rem_5rem_2rem] gap-2 text-xs text-muted-foreground sm:grid">
                    <span>Description</span><span>Qty</span><span>Unit price</span><span className="text-right">Total</span>
                  </div>
                  {items.fields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-[4.5rem_6rem_1fr_2rem] items-start gap-2 sm:grid-cols-[1fr_4.5rem_6rem_5rem_2rem]" data-line-item={index}>
                      {/* full width on phones, first column from sm up */}
                      <div className="col-span-4 sm:col-span-1">{description(index)}</div>
                      <div>
                        <Input aria-label={`Item ${index + 1} quantity`} inputMode="decimal" {...register(`items.${index}.qty`)} />
                        <FieldError message={err(`items.${index}.qty`)} />
                      </div>
                      <div>
                        <Input aria-label={`Item ${index + 1} unit price`} inputMode="decimal" placeholder="0.00" {...register(`items.${index}.unit_price`)} />
                        <FieldError message={err(`items.${index}.unit_price`)} />
                      </div>
                      <p className="pt-2 text-right text-sm tabular-nums" aria-label={`Item ${index + 1} total`}>{preview.rows[index]?.line_total ?? "—"}</p>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove item ${index + 1}`} onClick={() => items.remove(index)}>
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <Button type="button" variant="outline" size="sm" disabled={items.fields.length >= MAX_LINE_ITEMS} onClick={() => items.append(emptyLineItem())}>
                <Plus />
                Add item
              </Button>
              {/* list-level errors (too many items, total too large) live at items.root */}
              <FieldError message={err("items") ?? err("items.root")} />
            </Section>

            {gst ? (
              <Section title="Tax">
                <dl className="grid grid-cols-2 gap-y-1 text-sm" aria-label="Totals">
                  <dt>Taxable value</dt><dd className="text-right tabular-nums">{preview.totals.taxable}</dd>
                  {preview.taxRows?.map((row) => (
                    <React.Fragment key={row.key}>
                      <dt>{row.label}</dt><dd className="text-right tabular-nums" data-tax={row.key}>{preview.totals[row.key]}</dd>
                    </React.Fragment>
                  ))}
                  <dt className="font-semibold">Total</dt><dd className="text-right font-semibold tabular-nums" data-total="">{preview.totals.total}</dd>
                </dl>
                <p className="text-xs text-muted-foreground">
                  CGST + SGST when the place of supply is your state, IGST otherwise. Discounts and GST rates are per item.
                </p>
              </Section>
            ) : (
              <Section title="Tax and discount">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="field-tax">Tax rate (%)</Label>
                    <Input id="field-tax" inputMode="decimal" {...register("tax_percent")} />
                    <FieldError message={err("tax_percent")} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="field-discount">Discount (amount)</Label>
                    <Input id="field-discount" inputMode="decimal" {...register("discount")} />
                    <FieldError message={err("discount")} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">The discount comes off the subtotal before tax.</p>
                <dl className="grid grid-cols-2 gap-y-1 text-sm" aria-label="Totals">
                  <dt>Subtotal</dt><dd className="text-right tabular-nums">{preview.totals.subtotal}</dd>
                  <dt>Discount</dt><dd className="text-right tabular-nums">{preview.totals.discount}</dd>
                  <dt>Tax</dt><dd className="text-right tabular-nums">{preview.totals.tax}</dd>
                  <dt className="font-semibold">Total</dt><dd className="text-right font-semibold tabular-nums" data-total="">{preview.totals.total}</dd>
                </dl>
              </Section>
            )}

            {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
            <Button type="submit" className="w-full" disabled={formState.isSubmitting || gstBlocked}>
              {formState.isSubmitting ? "Creating…" : gst ? "Create invoice" : "Create receipt"}
            </Button>
          </form>
        )}
      </div>

      <div ref={previewRef} className="flex flex-1 justify-center bg-gray-100 p-4 lg:overflow-auto lg:p-8">
        <ReceiptPreview canvas={canvas} scale={scale} values={preview.values} rows={preview.rows} totals={preview.totals} taxRows={preview.taxRows} />
      </div>
    </div>
  );
};
