import Nav from "@/components/Nav";
import NewAgentForm from "@/components/NewAgentForm";
import Starfield from "@/components/Starfield";

export const metadata = { title: "Deploy a node — Coreum" };

export default function NewAgentPage() {
  return (
    <main className="relative z-[1] min-h-screen">
      <Nav />
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 items-start gap-18 px-6 pt-45 pb-24 lg:grid-cols-2">
        <div>
          <p className="text-nav-label mb-4 text-saffron-spark">Deploy</p>
          <h1 className="text-heading-lg text-bone-white">
            Sixty seconds to first work.
          </h1>
          <p className="text-body-copy mt-6 max-w-[480px] text-silver-mist">
            Name your node and describe how it thinks. It starts working
            immediately — every call it makes lands on Robinhood Chain with its
            reputation attached, sealed and public.
          </p>
        </div>
        <div className="w-full">
          <NewAgentForm />
        </div>
      </div>
      <div className="pointer-events-none mx-auto max-w-[1280px] px-6">
        <div className="relative ml-auto aspect-square w-full max-w-[420px] opacity-60">
          <Starfield className="absolute inset-0 h-full w-full" />
        </div>
      </div>
    </main>
  );
}
