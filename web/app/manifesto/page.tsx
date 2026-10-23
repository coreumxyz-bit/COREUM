import Link from "next/link";
import Nav from "@/components/Nav";

export const metadata = { title: "Manifesto — Coreum" };

const SECTIONS = [
  {
    n: "01",
    title: "Record over reputation",
    text: "People quietly delete their bad calls. On Coreum every verdict is a block in a public SHA-256 ledger, written into a verified contract on Robinhood Chain and anchored to Bitcoin. Nothing gets curated after the fact.",
  },
  {
    n: "02",
    title: "Commit before you see",
    text: "Every core sends only a hash of its answer first and reveals it after everyone has committed. No core can copy another, and an answer that does not match its hash is thrown out.",
  },
  {
    n: "03",
    title: "Real work or no work",
    text: "A vote is a real model run on a real question. A core that returns nothing, or nothing it can stand behind, sits out instead of padding the count.",
  },
  {
    n: "04",
    title: "Open by default",
    text: "The code is MIT-licensed, the verifier is one file with no dependencies, and anyone can run a core on their own hardware. Trust is something you recompute, not something we ask for.",
  },
  {
    n: "05",
    title: "Say what is not proven",
    text: "The evidence page lists every claim we make, how far the proof goes and where to check it. If a row says Not yet, we do not claim it.",
  },
];

export default function ManifestoPage() {
  return (
    <main className="relative z-[1] min-h-screen">
      <Nav active="/manifesto" />
      <div className="mx-auto max-w-[1280px] px-6 pt-45 pb-24">
        <p className="text-nav-label mb-6 text-saffron-spark">Manifesto</p>
        <h1 className="text-heading-lg max-w-[1000px] text-bone-white">
          Work should be verifiable.
        </h1>

        <div className="mt-24 flex flex-col gap-24">
          {SECTIONS.map((s, i) => (
            <div
              key={s.n}
              className={`grid grid-cols-1 gap-12 lg:grid-cols-2 ${
                i % 2 === 1 ? "lg:[direction:rtl]" : ""
              }`}
            >
              <div className="lg:[direction:ltr]">
                <span className="text-nav-label text-saffron-spark">{s.n}</span>
                <h2 className="text-heading mt-4 text-bone-white">{s.title}</h2>
              </div>
              <p className="text-body-copy max-w-[520px] self-end text-silver-mist lg:[direction:ltr]">
                {s.text}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-30 flex items-center gap-8">
          <Link href="/nodes" className="btn-primary">
            Deploy a core
          </Link>
          <Link href="/evidence" className="link-ghost underline">
            See the evidence
          </Link>
        </div>
      </div>
    </main>
  );
}
