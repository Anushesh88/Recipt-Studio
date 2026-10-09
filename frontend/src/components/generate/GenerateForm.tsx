import React, { useMemo, useState } from "react";
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
import { createReceipt, receiptApiError, receiptKeys, useNextNumber, type ReceiptRecord } from "../../api/receipts";
import { apiErrorMessage } from "../../api/client";
import { variableLabel, CUSTOM_PREFIX } from "../../lib/variables";
import { ReceiptPreview } from "../preview/ReceiptPreview";
import {
  buildFormModel,
  emptyLineItem,
  previewFromForm,
  previewFromReceipt,
  toPayload,
  MAX_LINE_ITEMS,
  type BuiltinField,
  type GenerateValues,
} from "./formModel";

const PREVIEW_MAX_WIDTH = 520;
const COMMON_CURRENCIES = ["USD", "EUR", "GBP", "INR", "CAD", "AUD", "JPY", "CHF", "SGD", "AED"];
const PAYMENT_METHODS = ["Cash", "Card", "Bank transfer", "UPI", "Mobile wallet", "Cheque"];

// errors["customer"]["name"] for "customer.name"
function errorAt(errors: FieldErrors<GenerateValues>, path: string): string | undefined {
  let node: unknown = errors;
  for (const part of path.split(".")) node = (node as Record<string, unknown> | undefined)?.[part];
  const message = (node as { message?: unknown } | undefined)?.message;
  return typeof message === "string" ? message : undefined;
}

const FieldError: React.FC<{ message?: string }> = ({ message }) =>
  message ? <p className="text-xs text-destructive">{message}</p> : null;

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-3 rounded-lg border border-border bg-white p-4">
    <h2 className="text-sm font-semibold">{title}</h2>
    {children}
  </section>
);

export const GenerateForm: React.FC<{ templateId: string; templateName: string; canvas: Canvas }> = ({
  templateId,
  templateName,
  canvas,
}) => {
  const queryClient = useQueryClient();
  const model = useMemo(() => buildFormModel(canvas), [canvas]);
  const nextNumber = useNextNumber();
  const [created, setCreated] = useState<ReceiptRecord | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Errors show from the first submit on (then update as you type). Validating on
  // blur made messages appear mid-click and shift buttons out from under the pointer.
  const form = useForm<GenerateValues>({ resolver: zodResolver(model.schema), defaultValues: model.defaults });
  const { register, control, handleSubmit, formState, setError, reset, getValues } = form;
  const items = useFieldArray({ control, name: "items" });
  const watched = useWatch({ control }) as GenerateValues;

  const autoNumber = nextNumber.data?.mode === "sequential" ? nextNumber.data.next_number : null;
  const preview = created ? previewFromReceipt(created) : previewFromForm(watched, autoNumber);
  const scale = Math.min(1, PREVIEW_MAX_WIDTH / canvas.page.width);
  const err = (path: string) => errorAt(formState.errors, path);

  const onSubmit = async (values: GenerateValues) => {
    setFormError(null);
    try {
      const receipt = await createReceipt(templateId, toPayload(values, model.customKeys));
      setCreated(receipt);
      void queryClient.invalidateQueries({ queryKey: receiptKeys.nextNumber });
    } catch (e) {
      const apiError = receiptApiError(e);
      if (apiError && apiError.fields.length > 0) {
        // The API names fields with the same dotted paths as the form
        for (const field of apiError.fields) {
          const message = apiError.code === "MISSING_VARIABLES" ? `${variableLabel(field)} is required` : apiError.message;
          setError(field as Path<GenerateValues>, { message }, { shouldFocus: true });
        }
        if (apiError.code === "MISSING_VARIABLES") setFormError(apiError.message);
      } else {
        setFormError(apiErrorMessage(e, "Couldn't create the receipt. Please try again."));
      }
    }
  };

  const startAnother = () => {
    const previous = getValues();
    // Keep who's issuing it and how; clear what's specific to the last receipt
    reset({
      ...model.defaults,
      business: previous.business,
      receipt: { ...model.defaults.receipt, currency: previous.receipt.currency, payment_method: previous.receipt.payment_method },
      tax_percent: previous.tax_percent,
    });
    setCreated(null);
  };

  const builtinInput = (key: BuiltinField) => {
    const id = `field-${key}`;
    const label = variableLabel(key) + (key === "receipt.notes" ? " (optional)" : "");
    const path = key as Path<GenerateValues>;
    return (
      <div key={key} className="space-y-1.5">
        <Label htmlFor={id}>{label}</Label>
        {key === "receipt.notes" ? (
          <Textarea id={id} rows={2} {...register(path)} />
        ) : (
          <Input
            id={id}
            type={key === "customer.email" ? "email" : key === "receipt.date" ? "date" : "text"}
            list={key === "receipt.payment_method" ? "payment-methods" : undefined}
            aria-invalid={Boolean(err(key))}
            {...register(path)}
          />
        )}
        <FieldError message={err(key)} />
      </div>
    );
  };

  return (
    <div className="flex min-h-0 flex-1">
      <div className="w-[34rem] shrink-0 overflow-y-auto border-r border-border bg-gray-50 p-4">
        {created ? (
          <div className="space-y-4">
            <Section title="Receipt created">
              <div className="flex items-start gap-3" role="status">
                <CheckCircle2 className="mt-0.5 size-5 text-green-600" />
                <div>
                  <p className="font-medium">Receipt {created.receipt_number} saved</p>
                  <p className="text-sm text-muted-foreground">
                    Total {created.currency} {created.total_amount}, from “{templateName}”. Amounts were computed by the server.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="button" onClick={startAnother}>Generate another</Button>
                <Button asChild variant="outline"><Link to="/templates">Back to templates</Link></Button>
              </div>
            </Section>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit(onSubmit)} noValidate data-generate-form="">
            <Section title="Receipt">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="field-receipt-number">Receipt number</Label>
                  <Input
                    id="field-receipt-number"
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
                <div className="space-y-1.5">
                  <Label htmlFor="field-currency">Currency</Label>
                  <Input id="field-currency" list="currencies" maxLength={3} className="uppercase" {...register("receipt.currency")} />
                  <FieldError message={err("receipt.currency")} />
                </div>
              </div>
              <datalist id="currencies">{COMMON_CURRENCIES.map((c) => <option key={c} value={c} />)}</datalist>
              <datalist id="payment-methods">{PAYMENT_METHODS.map((m) => <option key={m} value={m} />)}</datalist>
            </Section>

            {(model.builtinFields.length > 0 || model.customKeys.length > 0) && (
              <Section title="Details used by this template">
                {model.builtinFields.map(builtinInput)}
                {model.customKeys.map((key) => {
                  const path = `custom.${key}`;
                  return (
                    <div key={key} className="space-y-1.5">
                      <Label htmlFor={`field-custom-${key}`}>{variableLabel(CUSTOM_PREFIX + key)}</Label>
                      <Input id={`field-custom-${key}`} aria-invalid={Boolean(err(path))} {...register(path as Path<GenerateValues>)} />
                      <FieldError message={err(path)} />
                    </div>
                  );
                })}
              </Section>
            )}

            <Section title="Line items">
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_4.5rem_6rem_5rem_2rem] text-xs text-muted-foreground">
                  <span>Description</span><span>Qty</span><span>Unit price</span><span className="text-right">Total</span>
                </div>
                {items.fields.map((field, index) => {
                  const line = preview.rows[index]?.line_total ?? "—";
                  return (
                    <div key={field.id} className="grid grid-cols-[1fr_4.5rem_6rem_5rem_2rem] items-start gap-2" data-line-item={index}>
                      <div>
                        <Input aria-label={`Item ${index + 1} description`} placeholder="Description" {...register(`items.${index}.description`)} />
                        <FieldError message={err(`items.${index}.description`)} />
                      </div>
                      <div>
                        <Input aria-label={`Item ${index + 1} quantity`} inputMode="decimal" {...register(`items.${index}.qty`)} />
                        <FieldError message={err(`items.${index}.qty`)} />
                      </div>
                      <div>
                        <Input aria-label={`Item ${index + 1} unit price`} inputMode="decimal" placeholder="0.00" {...register(`items.${index}.unit_price`)} />
                        <FieldError message={err(`items.${index}.unit_price`)} />
                      </div>
                      <p className="pt-2 text-right text-sm tabular-nums" aria-label={`Item ${index + 1} total`}>{line}</p>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove item ${index + 1}`} onClick={() => items.remove(index)}>
                        <Trash2 />
                      </Button>
                    </div>
                  );
                })}
              </div>
              <Button type="button" variant="outline" size="sm" disabled={items.fields.length >= MAX_LINE_ITEMS} onClick={() => items.append(emptyLineItem())}>
                <Plus />
                Add item
              </Button>
              <FieldError message={err("items")} />
            </Section>

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

            {formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}
            <Button type="submit" className="w-full" disabled={formState.isSubmitting}>
              {formState.isSubmitting ? "Creating…" : "Create receipt"}
            </Button>
          </form>
        )}
      </div>

      <div className="flex flex-1 justify-center overflow-auto bg-gray-100 p-8">
        <ReceiptPreview canvas={canvas} scale={scale} values={preview.values} rows={preview.rows} totals={preview.totals} />
      </div>
    </div>
  );
};
