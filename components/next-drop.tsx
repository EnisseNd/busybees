import { connection } from "next/server";
import { nextDropInfo } from "@/lib/drop";

export async function NextDrop({ prominent = false }: { prominent?: boolean }) {
  await connection();
  const { phrase } = nextDropInfo(new Date());

  return (
    <p className={prominent ? "font-serif text-2xl text-leaf sm:text-3xl" : "text-base font-extrabold text-leaf"}>
      {phrase}
      <span className="mt-1 block font-sans text-sm font-semibold text-muted">
        Every Sunday at 8pm, with a 30-minute lunch already picked.
      </span>
    </p>
  );
}
