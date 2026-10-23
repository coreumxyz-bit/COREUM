// Splits a line into words that rise out of a blur one after another.
export default function Words({ text, delay = 0, step = 70 }: { text: string; delay?: number; step?: number }) {
  return (
    <>
      {text.split(" ").map((w, i) => (
        <span key={i} className="word" style={{ animationDelay: `${delay + i * step}ms` }}>
          {w}
          {" "}
        </span>
      ))}
    </>
  );
}
