// Email and password rules shared by the sign-in, sign-up and reset forms
// (same as the backend's UserCreate / ResetPassword)
import { z } from "zod";
import { utf8ByteLength } from "./text";
import { PASSWORD_MAX_BYTES, PASSWORD_MIN_LENGTH } from "./units";

export const emailField = z.string().trim().min(1, "Enter your email").pipe(z.email("Enter a valid email address"));

export const newPasswordField = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
  .refine((p) => utf8ByteLength(p) <= PASSWORD_MAX_BYTES, `Use at most ${PASSWORD_MAX_BYTES} characters`);
