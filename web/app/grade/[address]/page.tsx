import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import Nav from "@/components/Nav";
import AskBox from "@/components/AskBox";
import { GRADE_NOTE } from "@/lib/grade";
import { fellSince, isAddress, latestCheck, SITE, valueNow } from "@/lib/publicApi";

export const metadata = {
  title: "Coreum grade — token check",
  description: "A token's Coreum grade: six AI cores and the on-chain facts, one letter from A to F.",
};

async function Card({ params }: { params: Promise<{ address: string }> }) {
  await connection();
  const address = (await params).address.toLowerCase();
  const c = isAddress(address) ? await latestCheck(address).catch(() => null) : null;
  if (!c || c.status === "not_checked")
    return (
      <div className="mt-10 max-w-[760px]">
        <p className="text-[17px] text-white/75">The network has not checked this token yet. Run a check and its grade appears here.</p>
        <div className="mt-6">
          <AskBox placeholder="Paste the token address — 0x…" cta="Check token" examples={[]} />
        </div>
      </div>
    );
  if (c.status === "checking" || !c.grade)
    return (
      <p className="mt-10 text-[17px] text-white/75">
        The cores are checking this token right now —{" "}
        <Link href={c.proof.page.replace(SITE, "")} className="underline">
          watch it live
        </Link>
        .
      </p>
    );

  const g = c.grade;
  const fell = fellSince(c.facts.fdv_usd, (await valueNow([c.address])).get(c.address));
  const dumped = (fell ?? 0) >= 0.5;
  const url = `${SITE}/grade/${c.address}`;
  const tweet = `$${c.symbol} got a ${g.letter} from @0xcoreum — six AI cores, on-chain facts, verdict sealed on Robinhood Chain.`;
  const share = `https://x.com/intent/post?text=${encodeURIComponent(tweet)}&url=${encodeURIComponent(url)}`;
  return (
    <>
    {dumped && (
      <div className="mt-8 rounded-[18px] border-2 border-white bg-white/[0.06] p-5">
        <p className="text-[20px] text-white">
          ⚠ ${c.symbol} has fallen {Math.round(fell! * 100)}% since this check.
        </p>
        <p className="mt-1 text-[15px] text-white/70">
          The grade below is a snapshot from {c.age_hours != null && c.age_hours >= 1 ? `${Math.round(c.age_hours)} h` : "under an hour"} ago and is outdated. Run a fresh check before trusting it.
        </p>
      </div>
    )}
    <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="glass-fx flex flex-col rounded-[26px] border border-white/[0.14] bg-white/[0.04] p-8 backdrop-blur-[20px]">
        <div className="flex items-center gap-4">
          {c.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.image} alt="" width={52} height={52} className="h-[52px] w-[52px] rounded-full" />
          ) : (
            <span className="grid h-[52px] w-[52px] place-items-center rounded-full border border-white/20">{c.symbol.slice(0, 3)}</span>
          )}
          <div className="min-w-0">
            <div className="truncate text-[22px] text-white">
              {c.name} <span className="text-white/50">${c.symbol}</span>
            </div>
            <div className="truncate font-mono text-[12px] text-white/45">{c.address}</div>
          </div>
        </div>
        <div className="mt-8 flex items-end gap-6">
          <div className={`text-[150px] leading-[0.8] font-medium tracking-tight ${dumped ? "text-white/30 line-through" : "text-white"}`}>{g.letter}</div>
          <div className="pb-2">
            <div className="text-[28px] text-white">{g.score}/100</div>
            <div className="mt-1 text-[15px] text-white/60">{GRADE_NOTE[g.letter]}</div>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          {!dumped && (
            <a href={share} target="_blank" rel="noopener noreferrer" className="btn-primary">
              Share on X
            </a>
          )}
          <Link href={c.proof.page.replace(SITE, "")} className="btn-outline">
            Full check
          </Link>
        </div>
        <p className="mt-4 text-[12px] text-white/40">
          Checked {c.age_hours != null ? (c.age_hours < 1 ? "under an hour" : `${Math.round(c.age_hours)} h`) : "—"} ago ·{" "}
          {c.cores} cores · a risk screen, not financial advice
        </p>
      </div>

      <div className="min-w-0">
        <h2 className="text-[22px] text-white">Why {g.letter}</h2>
        {g.reasons.length ? (
          <ul className="mt-4 flex flex-col gap-2">
            {g.reasons.map((r) => (
              <li key={r.why} className="flex justify-between gap-4 border-t border-white/[0.08] pt-2 text-[15px]">
                <span className="text-white/80">{r.why}</span>
                <span className="font-mono text-white">{r.points}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-[15px] text-white/70">No deductions: the cores found no red flags and none of the warning signs apply.</p>
        )}
        <p className="mt-6 text-[14px] leading-relaxed text-white/55">
          Every grade starts at 100 and loses points for each warning sign in the facts; red flags from the cores always mean F.{" "}
          <Link href="/grades#how" className="underline decoration-white/30 underline-offset-4 hover:text-white">
            How grades work
          </Link>
          .
        </p>
        <h3 className="mt-8 text-[16px] text-white">Put it on your token page</h3>
        <pre className="mt-2 rounded-[12px] border border-white/[0.1] bg-black/60 p-3 font-mono text-[12px] break-all whitespace-pre-wrap text-white/80">
          {`<a href="${url}"><img src="${SITE}/api/v1/badge/${c.address}" alt="Coreum grade" height="22"></a>`}
        </pre>
      </div>
    </div>
    </>
  );
}

export default function GradePage({ params }: { params: Promise<{ address: string }> }) {
  return (
    <main className="relative z-[1] min-h-screen">
      <Nav active="/grades" />
      <div className="mx-auto max-w-[1180px] px-5 pt-32 pb-24 sm:px-8 md:px-[82px]">
        <p className="text-[13px] text-white/60">
          <Link href="/grades" className="hover:text-white">
            Coreum grades
          </Link>{" "}
          · one letter from six AI cores and the on-chain facts
        </p>
        <Suspense fallback={<p className="mt-10 text-white/55">Reading the grade…</p>}>
          <Card params={params} />
        </Suspense>
      </div>
    </main>
  );
}
