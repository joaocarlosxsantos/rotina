import Link from "next/link";
import { signOut } from "./auth-actions";
import { Logo } from "./brand";

type ActivePage = "hoje" | "rotinas" | "pets" | "calendario";

export interface HeaderProps {
  active: ActivePage;
  user: {
    email: string;
    name?: string | null;
  };
  mood?: "feliz" | "ok" | "triste";
}

export function IconHoje() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="10" cy="10" r="4" fill="currentColor" />
      <path
        d="M10 2v2m0 12v2M2 10h2m12 0h2m-3.05-4.95l-1.41 1.41m-7.08 7.08l-1.41 1.41m0-9.9l1.41 1.41m7.08 7.08l1.41 1.41"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconRotinas() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M4 5h2m-2 5h2m-2 5h2m4-10h8m-8 5h8m-8 5h8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconPets() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <ellipse cx="6" cy="6" rx="1.5" ry="2" fill="currentColor" />
      <ellipse cx="14" cy="6" rx="1.5" ry="2" fill="currentColor" />
      <ellipse cx="10" cy="4.5" rx="1.5" ry="2" fill="currentColor" />
      <path
        d="M6 10c-1.5 0-3 1.5-2 3.5 1 2 4 3.5 6 3.5s5-1.5 6-3.5c1-2-.5-3.5-2-3.5-1.2 0-2.2 1-4 1s-2.8-1-4-1z"
        fill="currentColor"
      />
    </svg>
  );
}

export function IconCalendario() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <rect
        x="3"
        y="4"
        width="14"
        height="13"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M3 8h14M7 2v3M13 2v3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="7" cy="11" r="1" fill="currentColor" />
      <circle cx="10" cy="11" r="1" fill="currentColor" />
      <circle cx="13" cy="11" r="1" fill="currentColor" />
      <circle cx="7" cy="14" r="1" fill="currentColor" />
      <circle cx="10" cy="14" r="1" fill="currentColor" />
    </svg>
  );
}

export function Header({ active, user, mood }: HeaderProps) {
  return (
    <>
      <header className="topbar app-topbar">
        <Link href="/" className="brand" aria-label="Rotina Pet">
          <Logo size={32} mood={mood} />
        </Link>
        <nav className="desktop-nav" aria-label="Principal">
          <Link
            href="/"
            aria-current={active === "hoje" ? "page" : undefined}
            className={active === "hoje" ? "active" : undefined}
          >
            Hoje
          </Link>
          <Link
            href="/rotinas"
            aria-current={active === "rotinas" ? "page" : undefined}
            className={active === "rotinas" ? "active" : undefined}
          >
            Rotinas
          </Link>
          <Link
            href="/pets"
            aria-current={active === "pets" ? "page" : undefined}
            className={active === "pets" ? "active" : undefined}
          >
            Pets
          </Link>
          <span
            className="nav-link-disabled"
            aria-disabled="true"
            title="Calendário (em breve na Fase 9)"
          >
            Calendário
            <span className="badge-soon">Em breve</span>
          </span>
        </nav>
        <div className="user-menu">
          <span className="user-email" title={user.email}>
            {user.email}
          </span>
          <form action={signOut}>
            <button className="logout" type="submit">
              Sair
            </button>
          </form>
        </div>
      </header>

      <nav className="mobile-tab-bar" aria-label="Navegação rápida">
        <Link
          href="/"
          className={`tab-item ${active === "hoje" ? "active" : ""}`}
          aria-current={active === "hoje" ? "page" : undefined}
        >
          <IconHoje />
          <span>Hoje</span>
        </Link>
        <Link
          href="/rotinas"
          className={`tab-item ${active === "rotinas" ? "active" : ""}`}
          aria-current={active === "rotinas" ? "page" : undefined}
        >
          <IconRotinas />
          <span>Rotinas</span>
        </Link>
        <Link
          href="/pets"
          className={`tab-item ${active === "pets" ? "active" : ""}`}
          aria-current={active === "pets" ? "page" : undefined}
        >
          <IconPets />
          <span>Pets</span>
        </Link>
        <span
          className="tab-item tab-disabled"
          aria-disabled="true"
          title="Calendário (em breve na Fase 9)"
        >
          <IconCalendario />
          <span>
            Calendário <small className="tab-badge">breve</small>
          </span>
        </span>
      </nav>
    </>
  );
}
