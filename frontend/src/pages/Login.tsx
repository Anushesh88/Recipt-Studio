import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuthStore } from '../store/authStore';
import { apiClient, apiErrorMessage } from '../api/client';
import { utf8ByteLength } from '../lib/text';
import { PASSWORD_MAX_BYTES, PASSWORD_MIN_LENGTH } from '../lib/units';
import { Logo } from '../components/brand/Logo';
import { GoogleSignInButton } from '../components/auth/GoogleSignInButton';

const email = z.string().trim().min(1, 'Enter your email').pipe(z.email('Enter a valid email address'));

const signInSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password'),
});

// Same rules as the backend's UserCreate
const registerSchema = z.object({
  email,
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
    .refine((p) => utf8ByteLength(p) <= PASSWORD_MAX_BYTES, `Use at most ${PASSWORD_MAX_BYTES} characters`),
});

type Credentials = z.infer<typeof signInSchema>;

function CredentialsForm({ isRegister }: { isRegister: boolean }) {
  const setToken = useAuthStore((state) => state.setToken);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<Credentials>({
    resolver: zodResolver(isRegister ? registerSchema : signInSchema),
    defaultValues: { email: '', password: '' },
  });
  const { errors, isSubmitting } = formState;

  const onSubmit = async ({ email, password }: Credentials) => {
    setError(null);
    try {
      if (isRegister) {
        await apiClient.post('/auth/register', { email, password });
      }
      const params = new URLSearchParams({ username: email, password });
      const res = await apiClient.post('/auth/login', params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      setToken(res.data.access_token);
    } catch (e) {
      setError(apiErrorMessage(e, isRegister ? "Couldn't create your account." : "Couldn't sign you in."));
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="space-y-1.5">
        <Label htmlFor="login-email">Email</Label>
        <Input id="login-email" type="email" autoComplete="email" placeholder="Email" aria-invalid={Boolean(errors.email)} {...register('email')} />
        {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="login-password">Password</Label>
        <Input
          id="login-password"
          type="password"
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          placeholder="Password"
          aria-invalid={Boolean(errors.password)}
          {...register('password')}
        />
        {errors.password ? (
          <p className="text-xs text-destructive">{errors.password.message}</p>
        ) : (
          isRegister && <p className="text-xs text-muted-foreground">At least {PASSWORD_MIN_LENGTH} characters.</p>
        )}
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? (isRegister ? 'Creating account…' : 'Signing in…') : isRegister ? 'Sign Up' : 'Sign In'}
      </Button>
    </form>
  );
}

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-indigo-50 to-gray-100 p-4">
      <Logo className="mb-2 text-2xl" markClassName="size-10" />
      <p className="mb-6 text-center text-sm text-muted-foreground">Receipts and GST invoices in your own design.</p>
      <div className="w-full max-w-sm rounded-lg border border-border bg-white p-8 shadow-sm">
        <h1 className="mb-4 text-2xl font-bold">{isRegister ? 'Create your account' : 'Sign in'}</h1>
        <div className="mb-4">
          <GoogleSignInButton signUp={isRegister} />
        </div>
        {/* keyed so switching modes starts a fresh form with the right rules */}
        <CredentialsForm key={isRegister ? 'register' : 'login'} isRegister={isRegister} />
        <Button type="button" variant="link" className="mt-4 h-auto p-0" onClick={() => setIsRegister(!isRegister)}>
          {isRegister ? 'Already have an account? Login' : "Don't have an account? Register"}
        </Button>
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        {isRegister && 'By creating an account you agree to the '}
        <Link to="/terms" className="hover:underline">Terms of Service</Link>
        {isRegister ? ' and ' : ' · '}
        <Link to="/privacy" className="hover:underline">Privacy Policy</Link>
        {isRegister && '.'}
      </p>
    </div>
  );
}
