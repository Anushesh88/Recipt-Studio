import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { INVOICING_OPTIONS, accountKeys, updateAccount, useAccount, type Account, type AccountChanges } from "../api/account";
import { apiErrorMessage } from "../api/client";
import { BUSINESS_NAME_MAX_LENGTH } from "../lib/units";
import { GSTIN_LENGTH, gstinProblem, stateLabel } from "../lib/gst";
import { ADDRESS_MAX_LENGTH } from "../components/generate/formModel";

// The GST details are optional here: they can be added later in Settings
const schema = z.object({
  invoicing_mode: z.enum(["receipts", "gst", "both"]),
  business_name: z.string().trim().max(BUSINESS_NAME_MAX_LENGTH),
  gstin: z.string().trim().toUpperCase().superRefine((gstin, ctx) => {
    const problem = gstin === "" ? null : gstinProblem(gstin);
    if (problem) ctx.addIssue({ code: "custom", message: problem });
  }),
  business_address: z.string().trim().max(ADDRESS_MAX_LENGTH),
});
type WelcomeValues = z.infer<typeof schema>;

const WelcomeForm: React.FC<{ account: Account }> = ({ account }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, control, formState } = useForm<WelcomeValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      invoicing_mode: "receipts",
      business_name: account.business_name ?? "",
      gstin: account.gstin ?? "",
      business_address: account.business_address ?? "",
    },
  });
  const [mode, gstin] = useWatch({ control, name: ["invoicing_mode", "gstin"] });
  const gst = mode !== "receipts";
  const gstinState = gstin && !gstinProblem(gstin.trim().toUpperCase()) ? stateLabel(gstin.trim().slice(0, 2)) : null;

  const save = async (changes: AccountChanges) => {
    setError(null);
    try {
      queryClient.setQueryData(accountKeys.me, await updateAccount(changes));
      navigate("/templates", { replace: true });
    } catch (e) {
      setError(apiErrorMessage(e, "Couldn't save your answer."));
    }
  };

  const onSubmit = (values: WelcomeValues) =>
    save({
      invoicing_mode: values.invoicing_mode,
      ...(values.business_name ? { business_name: values.business_name } : {}),
      ...(gst && values.gstin ? { gstin: values.gstin } : {}),
      ...(gst && values.business_address ? { business_address: values.business_address } : {}),
    });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6 rounded-lg border border-border bg-white p-6" data-welcome="">
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium">What will you mostly create?</legend>
        {INVOICING_OPTIONS.map((option) => (
          <label key={option.value} className="flex cursor-pointer items-start gap-2 rounded-md border border-border p-3 has-[:checked]:border-primary">
            <input type="radio" value={option.value} className="mt-1" {...register("invoicing_mode")} />
            <span>
              <span className="block text-sm font-medium">{option.label}</span>
              <span className="block text-xs text-muted-foreground">{option.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="welcome-business-name">Business name</Label>
        <Input id="welcome-business-name" maxLength={BUSINESS_NAME_MAX_LENGTH} {...register("business_name")} />
      </div>

      {gst && (
        <div className="space-y-4" data-welcome-gst="">
          <p className="text-xs text-muted-foreground">
            Printed on your GST invoices. You can skip these and add them in Settings later.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="welcome-gstin">GSTIN</Label>
            <Input id="welcome-gstin" maxLength={GSTIN_LENGTH} className="uppercase" autoComplete="off" aria-invalid={Boolean(formState.errors.gstin)} {...register("gstin")} />
            {formState.errors.gstin ? (
              <p className="text-xs text-destructive">{formState.errors.gstin.message}</p>
            ) : (
              gstinState && <p className="text-xs text-muted-foreground">Registered in {gstinState}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="welcome-address">Business address</Label>
            <Textarea id="welcome-address" rows={3} maxLength={ADDRESS_MAX_LENGTH} {...register("business_address")} />
          </div>
        </div>
      )}

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={formState.isSubmitting}>{formState.isSubmitting ? "Saving…" : "Continue"}</Button>
        <Button type="button" variant="ghost" onClick={() => save({ invoicing_mode: "both" })}>Skip for now</Button>
      </div>
      <p className="text-xs text-muted-foreground">This only sets defaults; you can change it in Settings and make either kind any time.</p>
    </form>
  );
};

// /welcome: asked once after sign-up (Templates sends anyone not asked yet here)
export const Welcome: React.FC = () => {
  const { data: account, isError, error } = useAccount();
  return (
    <div className="mx-auto max-w-xl p-4 sm:p-8">
      <h1 className="mb-2 text-3xl font-bold">Welcome to Receipt Studio</h1>
      <p className="mb-6 text-sm text-muted-foreground">One question so we can set things up for you.</p>
      {isError && <p role="alert" className="text-sm text-destructive">{apiErrorMessage(error, "Couldn't load your account.")}</p>}
      {account ? <WelcomeForm key={account.id} account={account} /> : !isError && <p className="text-sm text-muted-foreground">Loading…</p>}
    </div>
  );
};
