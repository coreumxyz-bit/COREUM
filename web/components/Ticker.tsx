const TICKS: [string, string, number][] = [
  ["AAPL", "231.40", 1.24],
  ["NVDA", "178.22", -0.86],
  ["GME", "34.10", 6.42],
  ["TSLA", "312.05", -1.1],
  ["MSFT", "498.77", 0.53],
  ["SPY", "612.44", 0.21],
  ["QQQ", "548.90", -0.34],
  ["BTC", "104,220", 2.15],
  ["ETH", "3,884", -0.72],
  ["AMZN", "224.91", 0.88],
  ["META", "612.30", -1.42],
  ["PLTR", "68.44", 3.07],
];

function Row({ ariaHidden }: { ariaHidden?: boolean }) {
  return (
    <div
      className="flex shrink-0 items-center"
      aria-hidden={ariaHidden ? true : undefined}
    >
      {TICKS.map(([sym, price, chg]) => {
        const up = chg >= 0;
        return (
          <span
            key={sym}
            className="flex items-center gap-2.5 px-7 font-mono text-[13px] whitespace-nowrap"
          >
            <span className="text-silver-mist">{sym}</span>
            <span className="text-bone-white">{price}</span>
            <span className={up ? "text-[#ffffff]" : "text-[#9a9a9a]"}>
              {up ? "▲" : "▼"} {Math.abs(chg).toFixed(2)}%
            </span>
          </span>
        );
      })}
    </div>
  );
}

export default function Ticker() {
  return (
    <div className="relative z-2 overflow-hidden border-y border-white/10 bg-black/60 py-3.5 backdrop-blur-[6px]">
      <div className="animate-marquee flex w-max">
        <Row />
        <Row ariaHidden />
      </div>
    </div>
  );
}
