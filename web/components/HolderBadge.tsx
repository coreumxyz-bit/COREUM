export default function HolderBadge({ short = false }: { short?: boolean }) {
  return (
    <span
      title="Verified $CORS holder — signed wallet proof + on-chain balance, zero gas spent"
      className="inline-block shrink-0 rounded border border-saffron-spark/50 px-1.5 py-px text-[10px] font-bold uppercase tracking-[0.12em] text-saffron-spark"
    >
      {short ? "$CORS" : "$CORS holder"}
    </span>
  );
}
