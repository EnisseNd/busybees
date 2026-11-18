"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TrayEditor } from "@/components/tray-editor";
import { readTray, writeTray } from "@/lib/demo-data";
import type { TrayItem } from "@/lib/types";

export function DemoTray() {
  const router = useRouter();
  const [saved, setSaved] = useState<{ firstName: string; items: TrayItem[] } | null>(null);

  useEffect(() => {
    setSaved(readTray());
  }, []);

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
