"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Check, Mail, ShieldCheck } from "lucide-react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { api, ApiError } from "@/lib/api";
import type { User } from "@/lib/types";
import { useShop } from "../providers";
import { Button } from "../ui/button";
import { AuthShell } from "./auth-shell";
type Kind = "signup" | "login" | "forgot" | "reset" | "verify";
type Delivery = { message: string; mailMode?: string; devLink?: string };
const emailRule = Yup.string()
  .email("Invalid email. Use a format like example@gmail.com.")
  .max(254)
  .required("Please enter your email address.");
const passwordRule = Yup.string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Use no more than 72 characters.")
  .matches(/[a-zA-Z]/, "Include at least one letter.")
  .matches(/[0-9]/, "Include at least one number.")
  .matches(/[^a-zA-Z0-9]/, "Include at least one symbol.")
  .required("Please enter a password.");
export function AuthScreen({
  kind,
  token = "",
}: {
  kind: Kind;
  token?: string;
}) {
  const router = useRouter(),
    { setUser, notify } = useShop();
  const [step, setStep] = useState<"email" | "password" | "sent" | "done">(
      "email",
    ),
    [show, setShow] = useState(false),
    [error, setError] = useState(""),
    [delivery, setDelivery] = useState<Delivery | null>(null),
    [cooldown, setCooldown] = useState(0),
    [resending, setResending] = useState(false),
    [unverified, setUnverified] = useState(false),
    [checking, setChecking] = useState(kind === "reset"),
    [tokenValid, setTokenValid] = useState(false),
    [verifying, setVerifying] = useState(false);
  const creatingPassword =
    (kind === "signup" && step === "password") || kind === "reset";
  const schema = Yup.object({
    email: kind === "reset" || kind === "verify" ? Yup.string() : emailRule,
    password: creatingPassword
      ? passwordRule
      : kind === "login"
        ? Yup.string().required("Please enter your password.")
        : Yup.string(),
    confirm: creatingPassword
      ? Yup.string()
          .oneOf(
            [Yup.ref("password")],
            "Those passwords didn’t match. Try again.",
          )
          .required("Please confirm your password.")
      : Yup.string(),
  });
  const form = useFormik({
    initialValues: { email: "", password: "", confirm: "" },
    validationSchema: schema,
    onSubmit: async (values) => {
      setError("");
      setUnverified(false);
      if (kind === "signup" && step === "email") {
        setStep("password");
        return;
      }
      try {
        if (kind === "login") {
          const result = await api<{ user: User }>("/auth/sign-in", {
            method: "POST",
            body: JSON.stringify({
              email: values.email,
              password: values.password,
            }),
          });
          setUser(result.user);
          notify("Welcome back! Your next favorite is waiting.");
          router.push("/");
          router.refresh();
        }
        if (kind === "signup") {
          const result = await api<Delivery>("/auth/sign-up", {
            method: "POST",
            body: JSON.stringify({
              email: values.email,
              password: values.password,
            }),
          });
          setDelivery(result);
          setStep("sent");
          setCooldown(60);
          form.setFieldValue("password", "");
          form.setFieldValue("confirm", "");
        }
        if (kind === "forgot") {
          const result = await api<Delivery>("/auth/reset-password-request", {
            method: "POST",
            body: JSON.stringify({ email: values.email }),
          });
          setDelivery(result);
          setStep("sent");
          setCooldown(60);
        }
        if (kind === "reset") {
          await api("/auth/reset-password", {
            method: "POST",
            body: JSON.stringify({ token, password: values.password }),
          });
          setStep("done");
          form.resetForm();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Please try again.");
        if (e instanceof ApiError && e.status === 403) setUnverified(true);
      }
    },
  });
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  useEffect(() => {
    if (kind !== "reset") return;
    if (!token) {
      setError("This reset link is missing its token. Request a new link.");
      setChecking(false);
      return;
    }
    let active = true;
    api<{ valid: boolean }>(
      `/auth/verify-reset-password-request?token=${encodeURIComponent(token)}`,
    )
      .then(() => {
        if (active) setTokenValid(true);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, [kind, token]);
  const resend = async () => {
    if (cooldown || resending) return;
    setError("");
    setResending(true);
    try {
      const result = await api<Delivery>(
        kind === "forgot"
          ? "/auth/reset-password-request"
          : "/auth/resend-verification",
        { method: "POST", body: JSON.stringify({ email: form.values.email }) },
      );
      setDelivery(result);
      setStep("sent");
      setCooldown(60);
      setUnverified(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setResending(false);
    }
  };
  const field = (
    name: "email" | "password" | "confirm",
    placeholder: string,
  ) => (
    <div className="auth-field">
      <label className="sr-only" htmlFor={name}>
        {placeholder}
      </label>
      <input
        id={name}
        name={name}
        type={name === "email" ? "email" : show ? "text" : "password"}
        className={`auth-input ${form.touched[name] && form.errors[name] ? "invalid" : ""}`}
        placeholder={placeholder}
        value={form.values[name]}
        onChange={(e) => {
          form.handleChange(e);
          setError("");
        }}
        onBlur={form.handleBlur}
        autoComplete={
          name === "email"
            ? "email"
            : kind === "login"
              ? "current-password"
              : "new-password"
        }
        aria-invalid={!!(form.touched[name] && form.errors[name])}
        aria-describedby={
          form.touched[name] && form.errors[name] ? `${name}-error` : undefined
        }
      />
      {form.touched[name] && form.errors[name] && (
        <p className="field-error" id={`${name}-error`}>
          {form.errors[name]}
        </p>
      )}
    </div>
  );
  const showPassword = (
    <label className="auth-checkbox">
      <input
        type="checkbox"
        checked={show}
        onChange={(e) => setShow(e.target.checked)}
      />
      Show password
    </label>
  );
  const back = (
    <Link
      className="auth-back"
      href={kind === "signup" && step === "password" ? "/signup" : "/"}
      aria-label="Go back"
      onClick={(e) => {
        if (kind === "signup" && step === "password") {
          e.preventDefault();
          setStep("email");
          setError("");
        }
      }}
    >
      <ChevronLeft size={17} />
    </Link>
  );
  if (kind === "verify")
    return (
      <AuthShell>
        {back}
        <div className="verify-icon">
          {step === "done" ? <Check size={27} /> : <ShieldCheck size={27} />}
        </div>
        <h1>{step === "done" ? "Email verified!" : "Verify your email"}</h1>
        <p className="auth-subtitle">
          {step === "done"
            ? "Your account is ready. Log in to explore your favorite dishes."
            : "Confirm your email address to activate your NomNom account."}
        </p>
        {error && (
          <div className="auth-error" role="alert">
            {error}
          </div>
        )}
        {step === "done" ? (
          <Button asChild className="w-full">
            <Link href="/login">Log in</Link>
          </Button>
        ) : (
          <>
            <Button
              className="w-full"
              disabled={!token || verifying}
              onClick={async () => {
                setError("");
                setVerifying(true);
                try {
                  await api("/auth/verify-email", {
                    method: "POST",
                    body: JSON.stringify({ token }),
                  });
                  setStep("done");
                } catch (e) {
                  setError(
                    e instanceof Error ? e.message : "Verification failed.",
                  );
                } finally {
                  setVerifying(false);
                }
              }}
            >
              {verifying ? "Verifying…" : "Verify email"}
            </Button>
            <p className="auth-switch">
              <Link href="/login">Back to log in</Link>
            </p>
          </>
        )}
      </AuthShell>
    );
  if (step === "done")
    return (
      <AuthShell>
        {back}
        <div className="verify-icon">
          <Check size={27} />
        </div>
        <h1>Password updated</h1>
        <p className="auth-subtitle">
          Your new password is ready. Log in to continue.
        </p>
        <Button className="w-full" asChild>
          <Link href="/login">Log in</Link>
        </Button>
      </AuthShell>
    );
  if (step === "sent")
    return (
      <AuthShell>
        {back}
        <div className="verify-icon">
          <Mail size={27} />
        </div>
        <h1>
          {kind === "forgot" ? "Check your email" : "Please verify your email"}
        </h1>
        <p className="auth-subtitle">
          {delivery?.mailMode === "development"
            ? "Your local development link is ready below. No email was sent."
            : kind === "forgot"
              ? "If your email is registered, a password reset link will arrive shortly."
              : "Check your inbox and follow the link to activate your account."}
        </p>
        <span className="auth-email-value">{form.values.email}</span>
        {delivery?.devLink && (
          <div className="dev-mail">
            <b>Development email preview</b>SMTP is not configured. This link is
            only available in local development.
            <Link href={delivery.devLink}>
              {kind === "forgot"
                ? "Open password reset link"
                : "Open email verification link"}{" "}
              →
            </Link>
          </div>
        )}
        {error && (
          <div className="auth-error" role="alert">
            {error}
          </div>
        )}
        <Button
          className="w-full"
          onClick={resend}
          disabled={cooldown > 0 || resending}
        >
          {resending
            ? "Sending…"
            : cooldown
              ? `Resend available in ${cooldown}s`
              : "Resend email"}
        </Button>
        <p className="auth-switch">
          Already verified?<Link href="/login">Log in</Link>
        </p>
      </AuthShell>
    );
  if (kind === "reset" && (checking || !tokenValid))
    return (
      <AuthShell>
        {back}
        <h1>Reset your password</h1>
        {checking ? (
          <p className="auth-subtitle" role="status">
            Checking your reset link…
          </p>
        ) : (
          <>
            <div className="auth-error" role="alert">
              {error || "This reset link is invalid."}
            </div>
            <Button asChild className="w-full">
              <Link href="/forgot-password">Request a new link</Link>
            </Button>
          </>
        )}
      </AuthShell>
    );
  const title =
    kind === "login"
      ? "Log in"
      : kind === "forgot"
        ? "Reset your password"
        : kind === "reset"
          ? "Create new password"
          : step === "email"
            ? "Create your account"
            : "Create a strong password";
  const subtitle =
    kind === "login"
      ? "Log in to enjoy your favorite dishes."
      : kind === "forgot"
        ? "Enter your email to receive a password reset link."
        : creatingPassword
          ? "Create a strong password with letters, numbers, and symbols."
          : "Sign up to explore your favorite dishes.";
  return (
    <AuthShell>
      {back}
      <h1>{title}</h1>
      <p className="auth-subtitle">{subtitle}</p>
      <form onSubmit={form.handleSubmit} noValidate>
        {!creatingPassword && field("email", "Enter your email address")}
        {(creatingPassword || kind === "login") &&
          field("password", "Password")}
        {creatingPassword && field("confirm", "Confirm password")}
        {(creatingPassword || kind === "login") && showPassword}
        {kind === "login" && (
          <Link href="/forgot-password" className="auth-forgot">
            Forgot password?
          </Link>
        )}
        {error && (
          <div className="auth-error" role="alert">
            {error}
          </div>
        )}
        {unverified && (
          <Button
            variant="outline"
            type="button"
            className="w-full mb-4"
            onClick={resend}
            disabled={resending}
          >
            Resend verification email
          </Button>
        )}
        <Button
          type="submit"
          className="w-full"
          disabled={
            form.isSubmitting ||
            !schema.isValidSync(form.values) ||
            (!creatingPassword && !form.values.email) ||
            (creatingPassword &&
              (!form.values.password || !form.values.confirm)) ||
            (kind === "login" && !form.values.password)
          }
        >
          {form.isSubmitting
            ? "Please wait…"
            : kind === "forgot"
              ? "Send link"
              : kind === "reset"
                ? "Create password"
                : "Let’s Go"}
        </Button>
      </form>
      <p className="auth-switch">
        {kind === "signup"
          ? "Already have an account?"
          : "Don’t have an account?"}
        <Link href={kind === "signup" ? "/login" : "/signup"}>
          {kind === "signup" ? "Log in" : "Sign up"}
        </Link>
      </p>
    </AuthShell>
  );
}
