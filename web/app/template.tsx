// Every navigation fades the new page in. Opacity only: a transform here would
// unpin the fixed nav and the chat button while the animation runs.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in flex flex-1 flex-col">{children}</div>;
}
