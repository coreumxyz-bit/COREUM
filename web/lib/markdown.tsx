import Link from "next/link";
import { Fragment, type ReactNode } from "react";

// A small markdown renderer for chat replies: paragraphs, lists, headings, code,
// bold, italic and links. Links to coreum.xyz open in place, the rest in a new tab.
const linkCls = "underline decoration-white/35 underline-offset-[3px] hover:decoration-white";

function A({ href, children }: { href: string; children: ReactNode }) {
  const own = href.match(/^https?:\/\/(?:www\.)?coreum\.xyz(\/[^\s]*)?$/) || (href.startsWith("/") ? [href, href] : null);
  return own ? (
    <Link href={own[1] || "/"} className={linkCls}>{children}</Link>
  ) : (
    <a href={href} target="_blank" rel="noreferrer" className={linkCls}>{children}</a>
  );
}

function inline(text: string, key = ""): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\[[^\]]+\]\([^)\s]+\))|(https?:\/\/[^\s)<]+[^\s)<.,;:!?])|(\*[^*\s][^*]*\*)/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(<Fragment key={key + i++}>{text.slice(last, m.index)}</Fragment>);
    const t = m[0];
    if (m[1]) out.push(<code key={key + i++} className="rounded-[6px] bg-white/[0.09] px-1.5 py-0.5 font-mono text-[0.88em] [overflow-wrap:anywhere]">{t.slice(1, -1)}</code>);
    else if (m[2]) out.push(<strong key={key + i++} className="font-semibold text-white">{inline(t.slice(2, -2), key + i + "b")}</strong>);
    else if (m[3]) {
      const [, label, href] = t.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)!;
      out.push(<A key={key + i++} href={href}>{label}</A>);
    } else if (m[4]) out.push(<A key={key + i++} href={t}><span className="[overflow-wrap:anywhere]">{t.replace(/^https?:\/\/(www\.)?/, "")}</span></A>);
    else out.push(<em key={key + i++}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(<Fragment key={key + i++}>{text.slice(last)}</Fragment>);
  return out;
}

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0, k = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) code.push(lines[i++]);
      i++;
      blocks.push(
        <pre key={k++} className="my-3 overflow-x-auto rounded-[12px] border border-white/10 bg-black/50 p-3.5 font-mono text-[13px] leading-relaxed text-white/90">{code.join("\n")}</pre>
      );
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      blocks.push(<p key={k++} className="mt-4 mb-1.5 text-[16px] font-semibold text-white first:mt-0">{inline(h[2], "h" + k)}</p>);
      i++;
      continue;
    }
    if (/^\s*([-*•]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\s*\d+[.)]/.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*•]|\d+[.)])\s+/, ""));
      const Tag = ordered ? "ol" : "ul";
      blocks.push(
        <Tag key={k++} className={`my-2 space-y-1.5 pl-5 ${ordered ? "list-decimal" : "list-disc"} marker:text-white/40`}>
          {items.map((it, j) => <li key={j} className="pl-1">{inline(it, `l${k}-${j}`)}</li>)}
        </Tag>
      );
      continue;
    }
    if (!line.trim()) { i++; continue; }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(```|#{1,4}\s|\s*([-*•]|\d+[.)])\s+)/.test(lines[i])) para.push(lines[i++]);
    blocks.push(<p key={k++} className="my-2 first:mt-0 last:mb-0">{inline(para.join("\n"), "p" + k)}</p>);
  }
  return <div className="whitespace-pre-wrap [overflow-wrap:anywhere]">{blocks}</div>;
}
