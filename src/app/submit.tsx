"use client";

import { useFormStatus } from "react-dom";
export function Submit({
  children,
  disabled = false,
  formAction,
  className,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  formAction?: (form: FormData) => void | Promise<void>;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      formAction={formAction}
      className={className}
    >
      {pending ? "Salvando…" : children}
    </button>
  );
}
