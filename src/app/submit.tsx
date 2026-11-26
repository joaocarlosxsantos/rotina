"use client";

import { useFormStatus } from "react-dom";
import { getDictionary, type Locale } from "../lib/i18n";

export function Submit({
  children,
  disabled = false,
  formAction,
  className,
  locale = "pt",
}: {
  children: React.ReactNode;
  disabled?: boolean;
  formAction?: (form: FormData) => void | Promise<void>;
  className?: string;
  locale?: Locale;
}) {
  const { pending } = useFormStatus();
  const savingText = getDictionary(locale).common.saving;
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      formAction={formAction}
      className={className}
    >
      {pending ? savingText : children}
    </button>
  );
}
