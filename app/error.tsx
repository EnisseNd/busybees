"use client";

import { primaryButtonClass } from "@/lib/styles";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-5 py-16">
      <h1 className="font-serif text-4xl text-ink">Something went wrong</h1>
      <p className="mt-3 text-sm leading-6 text-muted">{error.message || "Try that again."}</p>
      <button className={`${primaryButtonClass} mt-6 w-fit`} onClick={reset} type="button">
        Try again
      </button>
    </main>
  );
}
