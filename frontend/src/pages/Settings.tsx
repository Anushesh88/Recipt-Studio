import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { accountKeys, updateAccount, useAccount, type Account } from "../api/account";
import { receiptKeys, useNextNumber } from "../api/receipts";
import { apiErrorMessage } from "../api/client";
import { BUSINESS_NAME_MAX_LENGTH, RECEIPT_PREFIX_MAX_LENGTH, RECEIPT_PREFIX_PATTERN } from "../lib/units";

const schema = z.object({
  business_name: z.string().trim().max(BUSINESS_NAME_MAX_LENGTH, `Use at most ${BUSINESS_NAME_MAX_LENGTH} characters`),
  receipt_prefix: z
    .string()
    .max(RECEIPT_PREFIX_MAX_LENGTH, `Use at most ${RECEIPT_PREFIX_MAX_LENGTH} characters`)
    .regex(RECEIPT_PREFIX_PATTERN, "Use letters, digits, spaces and - _ / # . only"),
  numbering_mode: z.enum(["sequential", "nanoid"]),
});
type SettingsValues = z.infer<typeof schema>;

const NUMBERING_OPTIONS = [
  { value: "sequential", label: "Sequential", hint: "Counts up: R-0001, R-0002, …" },
  { value: "nanoid", label: "Random ID", hint: "A 10-character code such as 7KQ2M9XW3A, hard to guess" },
] as const;

const SettingsForm: React.FC<{ account: Account }> = ({ account }) => {
  const queryClient = useQueryClient();
  const nextNumber = useNextNumber();
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const form = useForm<SettingsValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      business_name: account.business_name ?? "",
      receipt_prefix: account.receipt_prefix,
      numbering_mode: account.numbering_mode,
    },
  });
  const { register, handleSubmit, formState, control, reset } = form;
  const [prefix, mode] = useWatch({ control, name: ["receipt_prefix", "numbering_mode"] });

  // The next sequence number with whatever prefix is being typed
  const digits = nextNumber.data?.next_number?.slice(account.receipt_prefix.length) ?? null;
  const preview = mode === "nanoid" ? "a random 10-character ID" : digits !== null ? `${prefix}${digits}` : null;

  const onSubmit = async (values: SettingsValues) => {
    setStatus(null);
    try {
      const saved = await updateAccount(values);
      queryClient.setQueryData(accountKeys.me, saved);
      await queryClient.invalidateQueries({ queryKey: receiptKeys.nextNumber });
      reset({ business_name: saved.business_name ?? "", receipt_prefix: saved.receipt_prefix, numbering_mode: saved.numbering_mode });
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
    </div>
  );
};
