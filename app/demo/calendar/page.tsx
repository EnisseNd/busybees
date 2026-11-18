import { Suspense } from "react";
import { DemoCalendar } from "@/components/demo/demo-calendar";
import { Scrap } from "@/components/scrap";

export default function DemoCalendarPage() {
  return (
    <>
      <h1>
        <Scrap tilt={-3}>
          <span className="font-script text-5xl leading-none ink-leaf">When are</span>
        </Scrap>{" "}
        <Scrap shape={2} tilt={2}>
          <span className="font-serif text-4xl leading-none ink-rose">you free?</span>
        </Scrap>
      </h1>
      <Suspense fallback={<p className="mt-6 text-sm font-semibold text-muted">Opening the calendar…</p>}>
        <DemoCalendar />
      </Suspense>
    </>
  );
}
