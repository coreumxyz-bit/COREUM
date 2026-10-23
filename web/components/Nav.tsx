"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Animate from "@/components/Animate";
import LogoMark from "@/components/LogoMark";
import { CORS_TRADE_URL, SOCIAL } from "@/lib/cors";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <LogoMark className="h-[28px] w-[25px] text-white sm:h-[32px] sm:w-[28px]" />
      <span className="text-[22px] leading-none font-[450] tracking-[-0.02em] text-white sm:text-[26px]">Coreum</span>
    </Link>
  );
}

type L = { href: string; label: string; note?: string };

// the main things to do are always visible; the rest sit in two groups
const MAIN: L[] = [
  { href: "/token", label: "Token Check" },
  { href: "/swap", label: "Safe Swap" },
  { href: "/grades", label: "Grades" },
  { href: "/watch", label: "Watchlist" },
  { href: "/stocks", label: "Stocks" },
];
const GROUPS: { label: string; links: L[] }[] = [
  {
    label: "Network",
    links: [
      { href: "/cores", label: "Cores", note: "Who answers, and how often they agree" },
      { href: "/nodes", label: "Run a core", note: "Join the network from your own machine" },
      { href: "/ledger", label: "Ledger", note: "Every sealed verdict, hash-chained" },
      { href: "/evidence", label: "Evidence", note: "What is proven, what is not, how to check" },
      { href: "/developers", label: "API & badge", note: "Put Coreum checks on your launchpad" },
      { href: "https://github.com/coreumxyz-bit/COREUM", label: "Open source ↗", note: "All the code on GitHub, MIT license" },
    ],
  },
  {
    label: "More",
    links: [
      { href: "/radar", label: "Radar", note: "New Pons launches, checked every hour" },
      { href: "/pons", label: "Pons census", note: "Every Pons launch, counted from the chain" },
      { href: "/truth", label: "CT Truth", note: "Check what crypto Twitter claims" },
      { href: "/play", label: "Beat the AI", note: "Call the market against the swarm" },
      { href: "/feed", label: "Signals", note: "Live market calls from the agents" },
      { href: "/track-record", label: "Accuracy", note: "How the market calls held up" },
      { href: "/roadmap", label: "Roadmap", note: "What is live and what comes next" },
      { href: "/manifesto", label: "Manifesto", note: "Why the network is built this way" },
    ],
  },
];

const icon = "absolute inset-0 h-5 w-5 text-white transition-all duration-300 ease-out";
const pill = "rounded-[8px] px-[14px] py-[10px] text-[14px] leading-[14px] font-[450] whitespace-nowrap transition-colors hover:bg-white/[0.06] hover:text-white";

// external links in the menus open in a new tab
const ext = (href: string) => (href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {});

export default function Nav({ active }: { active?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [scrolled, setScrolled] = useState(false);

  // once the page scrolls, the header gets its own backdrop so content never shows through
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  // lock page scroll while the mobile menu covers it
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setIsOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // a desktop dropdown closes on Escape or a click outside it
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    const onClick = (e: MouseEvent) => !(e.target as Element).closest("[data-menu]") && setMenu(null);
    window.addEventListener("keydown", onKey);
    window.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("click", onClick);
    };
  }, [menu]);

  return (
    <>
      {/* fixed so every page keeps it; the pills carry their own glass */}
      <header className="fixed inset-x-0 top-0 z-50">
        {/* outside the entrance animations: backdrop-filter inside an animated (opacity) parent blurs nothing */}
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-x-0 top-0 h-[84px] border-b bg-black/70 backdrop-blur-[18px] transition-opacity duration-300 sm:h-[100px] ${
            scrolled ? "border-white/[0.08] opacity-100" : "border-transparent opacity-0"
          }`}
        />
        <nav className="relative z-50 mx-auto flex w-full max-w-[1180px] items-center justify-between px-5 pt-[20px] sm:px-8 sm:pt-[30px]">
          <Animate delay={0} direction="down">
            <Logo />
          </Animate>

          {/* from lg: three main links, then two dropdowns */}
          <Animate delay={100} direction="down" className="hidden lg:block">
            {/* no glass-fx here: its overflow:hidden would clip the dropdowns */}
            <div className="flex h-[52px] items-center gap-[4px] rounded-[11px] bg-white/[0.06] border border-white/[0.12] px-[6px] backdrop-blur-[17px]">
              {MAIN.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active === l.href ? "page" : undefined}
                  className={`${pill} ${active === l.href ? "bg-white/[0.08] text-white" : "text-white/80"}`}
                >
                  {l.label}
                </Link>
              ))}
              <span className="mx-1 h-5 w-px bg-white/15" />
              {GROUPS.map((g) => {
                const on = g.links.some((l) => l.href === active);
                const open = menu === g.label;
                return (
                  <div
                    key={g.label}
                    data-menu
                    className="relative"
                    onMouseEnter={() => setMenu(g.label)}
                    onMouseLeave={() => setMenu((m) => (m === g.label ? null : m))}
                  >
                    <button
                      type="button"
                      aria-expanded={open}
                      aria-haspopup="menu"
                      onClick={() => setMenu(open ? null : g.label)}
                      className={`flex items-center gap-1.5 ${pill} ${on || open ? "bg-white/[0.08] text-white" : "text-white/80"}`}
                    >
                      {g.label}
                      <svg width="10" height="10" viewBox="0 0 10 10" className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}>
                        <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                    </button>
                    {/* pt-2 bridges the gap so the hover survives the move down */}
                    <div
                      className={`absolute top-full left-1/2 -translate-x-1/2 pt-2 transition-all duration-200 ${
                        open ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1 opacity-0"
                      }`}
                    >
                      <div className="w-[300px] rounded-[14px] border border-white/[0.12] bg-[#0b0b0c] p-2 shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-[24px]">
                        {g.links.map((l) => (
                          <Link
                            key={l.href}
                            href={l.href}
                            onClick={() => setMenu(null)}
                            {...ext(l.href)}
                            aria-current={active === l.href ? "page" : undefined}
                            className={`block rounded-[10px] px-3 py-2.5 transition-colors hover:bg-white/[0.06] ${
                              active === l.href ? "bg-white/[0.06]" : ""
                            }`}
                          >
                            <div className="text-[14px] font-[450] text-white">{l.label}</div>
                            {l.note && <div className="mt-0.5 text-[12px] text-white/50">{l.note}</div>}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Animate>

          <Animate delay={200} direction="down" className="hidden lg:block">
            <div className="flex h-[52px] items-center gap-[5px] rounded-[13px] glass-fx bg-white/[0.06] border border-white/[0.12] p-[3px] backdrop-blur-[17px]">
              <Link
                href="/nodes"
                className="hidden h-[46px] items-center rounded-[11px] px-[20px] text-[14px] leading-[14px] font-[450] whitespace-nowrap text-white transition-colors hover:bg-white/5 xl:flex"
              >
                Deploy a core
              </Link>
              <a
                href={CORS_TRADE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-[46px] items-center rounded-[11px] bg-[#E9E9E9] px-[22px] text-[14px] leading-[14px] font-[450] whitespace-nowrap text-[#0A0707] transition-colors hover:bg-white"
              >
                Buy $CORS
              </a>
            </div>
          </Animate>

          <Animate delay={100} direction="down" className="lg:hidden">
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              aria-label="Toggle menu"
              aria-expanded={isOpen}
              aria-controls="mobileMenu"
              className="flex h-[44px] w-[44px] items-center justify-center rounded-[11px] glass-fx bg-white/[0.06] border border-white/[0.12] backdrop-blur-[17px] transition-colors hover:bg-white/10"
            >
              <span className="relative h-5 w-5">
                {/* both icons stay mounted and cross-fade */}
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className={`${icon} ${isOpen ? "scale-75 rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100"}`}
                >
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className={`${icon} ${isOpen ? "scale-100 rotate-0 opacity-100" : "scale-75 -rotate-90 opacity-0"}`}
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </span>
            </button>
          </Animate>
        </nav>
      </header>

      {/* overlay is visibility-toggled, never unmounted, so closing animates too */}
      <div
        id="mobileMenu"
        inert={!isOpen}
        className={`fixed inset-0 z-40 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] lg:hidden ${
          isOpen ? "visible" : "invisible"
        }`}
      >
        <div
          onClick={() => setIsOpen(false)}
          className={`absolute inset-0 bg-black/80 backdrop-blur-[24px] transition-opacity duration-500 ${
            isOpen ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
          className={`absolute top-[76px] right-4 left-4 origin-top rounded-[20px] border bg-white/[0.07] p-[20px] backdrop-blur-[30px] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] sm:top-[86px] sm:right-[24px] sm:left-[24px] sm:p-7 ${
            isOpen ? "translate-y-0 scale-100 opacity-100" : "-translate-y-4 scale-[0.97] opacity-0"
          }`}
        >
          <div className="flex max-h-[calc(100svh-340px)] flex-col overflow-y-auto">
            {[{ label: "", links: MAIN }, ...GROUPS].map((g, gi) => (
              <div key={g.label || "main"} className={gi ? "mt-4" : ""}>
                {g.label && <div className="px-4 pb-1 text-[11px] font-[500] tracking-[0.14em] text-white/40 uppercase">{g.label}</div>}
                {g.links.map((l, i) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setIsOpen(false)}
                    {...ext(l.href)}
                    style={{ transitionDelay: isOpen ? `${80 + (gi * 3 + i) * 35}ms` : "0ms" }}
                    className={`flex items-center justify-between rounded-[12px] px-4 py-3 text-[17px] font-[450] transition-all duration-300 hover:bg-white/[0.06] ${
                      active === l.href ? "bg-white/[0.06] text-white" : "text-white/90"
                    } ${isOpen ? "translate-x-0 opacity-100" : "-translate-x-3 opacity-0"}`}
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>
          <div
            style={{ transitionDelay: isOpen ? "360ms" : "0ms" }}
            className={`mt-4 flex gap-2 px-1 transition-all duration-300 ${isOpen ? "opacity-100" : "opacity-0"}`}
          >
            {SOCIAL.map((l) => (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-[40px] flex-1 items-center justify-center rounded-[10px] border border-white/[0.14] bg-white/[0.04] text-[14px] font-[450] text-white/90 transition-colors hover:bg-white/[0.08]"
              >
                {l.label} ↗
              </a>
            ))}
          </div>
          <div className="my-5 h-px bg-white/10" />
          <div
            style={{ transitionDelay: isOpen ? "400ms" : "0ms" }}
            className={`flex flex-col gap-3 transition-all duration-300 ${
              isOpen ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
            }`}
          >
            <a
              href={CORS_TRADE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-[50px] w-full items-center justify-center rounded-[12px] bg-[#E9E9E9] text-[15px] font-[450] text-[#0A0707] transition-colors hover:bg-white"
            >
              Buy $CORS
            </a>
            <Link
              href="/nodes"
              onClick={() => setIsOpen(false)}
              style={{ borderColor: "rgba(255,255,255,0.3)" }}
              className="flex h-[50px] w-full items-center justify-center rounded-[12px] border text-[15px] font-[450] text-white transition-colors hover:bg-white/5"
            >
              Deploy a core
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
