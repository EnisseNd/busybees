import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { HeaderNav } from "@/components/site-header";
import "@fontsource-variable/inter";
import "@fontsource/abril-fatface";
import "@fontsource/pinyon-script";
import "@fontsource/sacramento";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "BusyBees",
    template: "%s | BusyBees",
  },
  description:
    "Friend matching for Yale students. Fill a lunch tray with five things, get new people every week, and meet up when you're both free.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html className="h-full antialiased" lang="en">
      <body className="flex min-h-full flex-col font-sans text-ink">
        <header className="gingham sticky top-0 z-20 border-b-2 border-hairline">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
            <Link aria-label="BusyBees home" className="shrink-0" href="/">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="BusyBees" className="block h-9 w-auto sm:h-11" src="/collage/logo-busybees.webp" />
            </Link>
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
