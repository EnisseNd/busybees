import { Suspense } from "react";
import { DemoChat } from "@/components/demo/demo-chat";

export default function DemoChatPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="text-sm font-semibold text-muted">Opening chat…</p>}>
      <Loader params={params} />
    </Suspense>
  );
}

async function Loader({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DemoChat matchId={id} />;
}
