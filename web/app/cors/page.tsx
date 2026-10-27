import Link from "next/link";
import Nav from "@/components/Nav";
import BurnCounter from "@/components/BurnCounter";
import CorsUtility from "@/components/CorsUtility";

export const metadata = {
  title: "$CORS — Coreum",
  description: "What $CORS does inside the Coreum network: more checks for holders, API keys and verified cores paid with a burn. Grades are never for sale.",
};

export default function CorsPage() {
  return (
    <main className="relative z-[1] min-h-screen">
      <Nav active="/cors" />
      <div className="mx-auto max-w-[1180px] px-5 pt-32 pb-24 sm:px-8 md:px-[82px]">
        <p className="text-[13px] text-white/60">$CORS · Robinhood Chain</p>
        <h1 className="mt-3 text-[clamp(40px,6vw,76px)] leading-[0.95] text-white" style={{ fontFamily: "var(--font-sans)" }}>
          The token runs the network. <span className="text-white/45">It never buys a grade.</span>
        </h1>
        <p className="mt-6 max-w-[700px] text-[17px] leading-relaxed text-white/75">
          $CORS changes how much of the network you can use: more checks, an API key, a verified core. It never changes what the
          cores say. Every burn goes to 0x…dEaD from your own wallet; Coreum never holds your tokens.
        </p>

        <CorsUtility />

        <BurnCounter />

        <p className="mt-10 max-w-[760px] text-[13px] leading-relaxed text-white/45">
          Every burn is read straight from Robinhood Chain and counted once. Holder proofs are a signature, no gas. Using the API key:{" "}
          <Link href="/developers" className="underline decoration-white/30 underline-offset-4 hover:text-white">
            developers
          </Link>
          . Not financial advice; $CORS is a utility token with no promise of value.
        </p>
      </div>
    </main>
  );
}
