// Entrance wrapper: starts at opacity 0 and is revealed by a CSS keyframe
// (forwards fill) after `delay` ms — no JS state, no observers.
const DIRECTION = {
  up: "animate-fade-up",
  down: "animate-fade-down",
  left: "animate-fade-left",
  right: "animate-fade-right",
  scale: "animate-fade-scale",
} as const;

export default function Animate({
  children,
  delay = 0,
  className = "",
  direction = "up",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  direction?: keyof typeof DIRECTION;
}) {
  return (
    <div className={`opacity-0 ${DIRECTION[direction]} ${className}`} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}
