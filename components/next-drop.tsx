import { connection } from "next/server";
import { nextDropInfo } from "@/lib/drop";

export async function NextDrop({ prominent = false }: { prominent?: boolean }) {
  await connection();
  const { phrase } = nextDropInfo(new Date());

  return (
    <p
      className={
        prominent
          ? "font-serif text-2xl text-ink sm:text-3xl"
          : "text-sm font-medium text-yale"
      }
    >
      {phrase}
      <span className="mt-1 block text-sm font-sans font-normal text-muted">
        Mondays at 9:00am ET. Friend matching comes first. Study buddies are a separate list.
      </span>
    </p>
  );
}
