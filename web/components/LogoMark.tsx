// Coreum mark (public/logo-mark.png), tinted via CSS mask so it
// follows the surrounding text colour (or the `color` prop).
export default function LogoMark({
  className = "h-5 w-auto",
  color = "currentColor",
}: {
  className?: string;
  color?: string;
}) {
  const mask = "url(/logo-mark.png) center / contain no-repeat";
  return (
    <span
      role="img"
      aria-label="Coreum"
      className={`inline-block ${className}`}
      style={{
        aspectRatio: "0.88",
        backgroundColor: color,
        WebkitMask: mask,
        mask,
      }}
    />
  );
}
