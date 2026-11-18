import { DemoTray } from "@/components/demo/demo-tray";
import { Scrap } from "@/components/scrap";

export default function DemoTrayPage() {
  return (
    <>
      <h1>
        <Scrap tilt={-3}>
          <span className="font-script text-5xl leading-none ink-leaf">What&rsquo;s on</span>
        </Scrap>{" "}
        <Scrap shape={1} tilt={2}>
          <span className="font-serif text-4xl leading-none ink-rose">your tray?</span>
        </Scrap>
      </h1>
      <div className="mt-8">
        <DemoTray />
      </div>
    </>
  );
}
