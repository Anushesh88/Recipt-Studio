import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient, apiErrorMessage } from "../api/client";
import { useAuthStore } from "../store/authStore";
import { Logo } from "../components/brand/Logo";
import { emailField, newPasswordField } from "../lib/authRules";
import { PASSWORD_MIN_LENGTH } from "../lib/units";

// /forgot-password and /reset-password?token=…: a password reset by email
// (backend POST /auth/forgot-password and /auth/reset-password)

const Card: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-indigo-50 to-gray-100 p-4">
    <Logo className="mb-6 text-2xl" markClassName="size-10" />
    <div className="w-full max-w-sm rounded-lg border border-border bg-white p-8 shadow-sm">
      <h1 className="mb-4 text-2xl font-bold">{title}</h1>
      {children}
      <Link to="/login" className="mt-4 inline-block text-sm text-indigo-700 hover:underline">Back to sign in</Link>
    </div>
  </div>
);

const forgotSchema = z.object({ email: emailField });

export const ForgotPassword: React.FC = () => {
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof forgotSchema>>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async ({ email }: { email: string }) => {
    setError(null);
    try {
      const res = await apiClient.post<{ message: string }>("/auth/forgot-password", { email });
      setSent(res.data.message);
    } catch (e) {
      setError(apiErrorMessage(e, "Couldn't send the email. Please try again."));
    }
  };

  return (
    <Card title="Forgot password">
      {sent ? (
        <div role="status" className="space-y-2 text-sm">
          <p>{sent}</p>
          <p className="text-muted-foreground">Check your inbox (and spam folder). The link works for an hour.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">Enter your account's email and we'll send you a link to set a new password.</p>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="space-y-1.5">
            <Label htmlFor="forgot-email">Email</Label>
            <Input id="forgot-email" type="email" autoComplete="email" aria-invalid={Boolean(formState.errors.email)} {...register("email")} />
            {formState.errors.email && <p className="text-xs text-destructive">{formState.errors.email.message}</p>}
          </div>
          <Button type="submit" disabled={formState.isSubmitting}>{formState.isSubmitting ? "Sending…" : "Send reset link"}</Button>
        </form>
      )}
    </Card>
  );
};

const resetSchema = z
  .object({ password: newPasswordField, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "The passwords don't match" });

export const ResetPassword: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const setToken = useAuthStore((s) => s.setToken);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", confirm: "" },
  });

  const onSubmit = async ({ password }: { password: string }) => {
    setError(null);
    try {
      const res = await apiClient.post<{ access_token: string }>("/auth/reset-password", { token, password });
      setToken(res.data.access_token);
      navigate("/templates", { replace: true });
    } catch (e) {
      setError(apiErrorMessage(e, "Couldn't set the new password. Please try again."));
    }
  };

  if (!token) {
    return (
      <Card title="Set a new password">
        <p role="alert" className="text-sm text-destructive">This link is incomplete. Open the link from the email again, or <Link to="/forgot-password" className="underline">ask for a new one</Link>.</p>
      </Card>
    );
  }
  return (
    <Card title="Set a new password">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error} <Link to="/forgot-password" className="underline">Ask for a new link</Link>
          </p>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="reset-password">New password</Label>
          <Input id="reset-password" type="password" autoComplete="new-password" aria-invalid={Boolean(formState.errors.password)} {...register("password")} />
          {formState.errors.password
            ? <p className="text-xs text-destructive">{formState.errors.password.message}</p>
            : <p className="text-xs text-muted-foreground">At least {PASSWORD_MIN_LENGTH} characters.</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reset-confirm">Type it again</Label>
          <Input id="reset-confirm" type="password" autoComplete="new-password" aria-invalid={Boolean(formState.errors.confirm)} {...register("confirm")} />
          {formState.errors.confirm && <p className="text-xs text-destructive">{formState.errors.confirm.message}</p>}
        </div>
        <Button type="submit" disabled={formState.isSubmitting}>{formState.isSubmitting ? "Saving…" : "Save and sign in"}</Button>
      </form>
    </Card>
  );
};
