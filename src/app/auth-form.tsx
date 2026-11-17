"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { authenticate, type AuthState } from "./auth-actions";

export function AuthForm({ signup = false }: { signup?: boolean }) {
  const [state, action, pending] = useActionState(authenticate.bind(null, signup ? "signup" : "signin"), {} as AuthState);
  const [show, setShow] = useState(false);
  return (
    <form action={action} className="auth-form" aria-busy={pending}>
      {state.error && <p className="notice error" role="alert" id="auth-error">{state.error}</p>}
      {signup && <div><label htmlFor="auth-name">Seu nome</label><input id="auth-name" name="name" autoComplete="name" required minLength={2} maxLength={80} defaultValue={state.name} /></div>}
      <div><label htmlFor="auth-email">E-mail</label><input id="auth-email" name="email" type="email" autoComplete="username" spellCheck={false} required maxLength={254} defaultValue={state.email} aria-describedby={state.error ? "auth-error" : undefined} /></div>
      <div>
        <label htmlFor="auth-password">Senha</label>
        <input id="auth-password" name="password" type={show ? "text" : "password"} autoComplete={signup ? "new-password" : "current-password"} required minLength={8} maxLength={128} aria-describedby="password-help" />
        <div className="password-tools"><span className="hint" id="password-help">De 8 a 128 caracteres.</span><button type="button" className="password-toggle" aria-controls="auth-password" aria-pressed={show} onClick={() => setShow(!show)}>{show ? "Ocultar senha" : "Mostrar senha"}</button></div>
      </div>
      <button type="submit" disabled={pending}>{pending ? (signup ? "Criando conta…" : "Entrando…") : (signup ? "Criar conta" : "Entrar")}</button>
      <p className="auth-alternative">{signup ? "Já tem uma conta?" : "Ainda não tem uma conta?"} <Link href={signup ? "/entrar" : "/criar-conta"}>{signup ? "Entrar" : "Criar conta"}</Link></p>
    </form>
  );
}
