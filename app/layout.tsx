import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { HeaderNav } from "@/components/site-header";
import "@fontsource-variable/nunito";
import "@fontsource/abril-fatface";
import "@fontsource/yesteryear";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SocialSync",
    template: "%s · SocialSync",
  },
  description:
    "Platonic friend matching for Yale. New matches once a week, with an optional study-buddy path. Chat stays on the site.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html className="h-full antialiased" lang="en">
      <body className="flex min-h-full flex-col font-sans text-ink">
        <header className="sticky top-0 z-20 border-b border-line/80 bg-paper/90 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
            <div className="flex items-center gap-3">
              <Link className="font-serif text-2xl tracking-tight text-ink" href="/">
                SocialSync
              </Link>
              <span className="rounded-full border border-line px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
                Yale
              </span>
            </div>
            <Suspense fallback={null}>
              <HeaderNav />
            </Suspense>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
