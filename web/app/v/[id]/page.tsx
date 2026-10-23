import { Suspense } from "react";
import { connection } from "next/server";
import Nav from "@/components/Nav";
import JobLive from "@/components/JobLive";
import { api } from "@/lib/api";
import type { Job } from "@/lib/verify";

export const metadata = {
  title: "Verifiable answer — Coreum",
  description: "A question answered independently by AI cores with commit-reveal, sealed in a public SHA-256 ledger.",
};

async function Loaded({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const id = Number((await params).id) || 0;
  let job: Job | null = null;
  try {
    job = await api<Job>(`/api/job?id=${id}`);
  } catch {}
  return <JobLive id={id} initial={job} />;
}

export default function VerifyPage(props: { params: Promise<{ id: string }> }) {
  return (
    <main className="relative z-[1] min-h-screen">
      <Nav />
      <div className="mx-auto max-w-[980px] px-5 pt-32 pb-24 sm:px-8">
        <Suspense fallback={<p className="text-white/60">Reading the network…</p>}>
          <Loaded params={props.params} />
        </Suspense>
      </div>
    </main>
  );
}
