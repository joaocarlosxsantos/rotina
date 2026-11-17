import Link from "next/link";
import { AuthForm } from "./auth-form";
import { Logo } from "./brand";
export function AuthPage({ signup = false, notice = false }: { signup?: boolean; notice?: boolean }) {
  return <>
    <a className="skip" href="#acesso">Pular para o formulário</a>
    <header className="topbar auth-topbar"><Link href="/entrar" className="brand" aria-label="Rotina Pet"><Logo size={32} /></Link></header>
    <main className="auth-page" id="acesso">
      <h1>{signup ? "Seu primeiro passo." : "Bom ter você aqui."}</h1>
      <p>{signup ? "Crie sua conta para cuidar da sua rotina e do seu companheiro." : "Entre para continuar sua rotina, no seu ritmo."}</p>
      {notice && <p className="notice" role="status">Confira seu e-mail e entre para continuar. Se necessário, confirme o cadastro pelo link recebido.</p>}
      <AuthForm signup={signup} />
    </main>
  </>;
}
