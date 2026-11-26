"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { getDictionary, type Locale } from "../lib/i18n";
import { authenticate, type AuthState } from "./auth-actions";

export function AuthForm({
  signup = false,
  locale = "pt",
}: {
  signup?: boolean;
  locale?: Locale;
}) {
  const t = getDictionary(locale).auth;
  const [state, action, pending] = useActionState(
    authenticate.bind(null, signup ? "signup" : "signin"),
    {} as AuthState,
  );
  const [show, setShow] = useState(false);

  return (
    <form action={action} className="auth-form" aria-busy={pending}>
      {state.error && (
        <p className="notice error" role="alert" id="auth-error">
          {state.error}
        </p>
      )}
      {signup && (
        <div className="auth-field">
          <label htmlFor="auth-name">{t.nameLabel}</label>
          <input
            id="auth-name"
            name="name"
            type="text"
            autoComplete="name"
            required
            minLength={2}
            maxLength={80}
            defaultValue={state.name}
            placeholder={t.namePlaceholder}
            disabled={pending}
          />
        </div>
      )}
      <div className="auth-field">
        <label htmlFor="auth-email">{t.emailLabel}</label>
        <input
          id="auth-email"
          name="email"
          type="email"
          autoComplete="email"
          spellCheck={false}
          required
          maxLength={254}
          defaultValue={state.email}
          placeholder={t.emailPlaceholder}
          disabled={pending}
          aria-describedby={state.error ? "auth-error" : undefined}
        />
      </div>
      <div className="auth-field">
        <label htmlFor="auth-password">{t.passwordLabel}</label>
        <div className="password-input-group">
          <input
            id="auth-password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete={signup ? "new-password" : "current-password"}
            required
            minLength={8}
            maxLength={128}
            placeholder={signup ? t.passwordPlaceholderSignUp : t.passwordPlaceholderSignIn}
            disabled={pending}
            aria-describedby="password-help"
          />
        </div>
        <div className="password-tools">
          <span className="hint" id="password-help">
            {t.passwordHint}
          </span>
          <button
            type="button"
            className="password-toggle"
            aria-controls="auth-password"
            aria-pressed={show}
            aria-label={show ? t.hidePasswordAria : t.showPasswordAria}
            onClick={() => setShow(!show)}
          >
            {show ? t.hidePassword : t.showPassword}
          </button>
        </div>
      </div>
      <button type="submit" disabled={pending}>
        {pending
          ? signup
            ? t.creatingAccount
            : t.signingIn
          : signup
            ? t.createAccountBtn
            : t.signInBtn}
      </button>
      <p className="auth-alternative">
        {signup ? t.alreadyHaveAccount : t.noAccountYet}{" "}
        <Link href={signup ? "/entrar" : "/criar-conta"}>
          {signup ? t.goToSignIn : t.goToSignUp}
        </Link>
      </p>
    </form>
  );
}
