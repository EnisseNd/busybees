"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { TrayEditor } from "@/components/tray-editor";
import { readTray, writeTray } from "@/lib/demo-data";
import { useMounted } from "@/lib/use-mounted";

export function DemoTray() {
  const router = useRouter();
  const mounted = useMounted();
  const saved = useMemo(() => (mounted ? readTray() : null), [mounted]);

  if (!saved) return <p className="text-sm font-semibold text-muted">Getting your tray…</p>;

  return (
    <TrayEditor
      college="Saybrook"
      initialFirstName={saved.firstName}
      initialItems={saved.items}
      onSave={(draft) => {
        writeTray(draft);
        router.push("/demo");
      }}
    />
  );
}
