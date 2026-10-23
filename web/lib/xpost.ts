// Reads a public X post by URL through X's embed endpoint (the one embedded
// tweets use) — no API key. Server-side only.
export type XPost = {
  url: string;
  id: string;
  author: string;
  handle: string;
  avatar: string;
  text: string;
  created: string;
};

const STATUS = /^(?:https?:\/\/)?(?:www\.|mobile\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status(?:es)?\/(\d{1,25})/i;

export const parseXUrl = (s: string) => {
  const m = s.trim().match(STATUS);
  return m ? { handle: m[1], id: m[2] } : null;
};

// the embed endpoint wants a token derived from the id (same as react-tweet)
const tokenFor = (id: string) => ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, "");

type Raw = {
  text?: string;
  created_at?: string;
  user?: { name?: string; screen_name?: string; profile_image_url_https?: string };
  entities?: { urls?: { url: string; expanded_url?: string; display_url?: string }[]; media?: { url: string }[] };
  note_tweet?: { text?: string };
  tombstone?: unknown;
};

export async function fetchXPost(url: string): Promise<XPost> {
  const p = parseXUrl(url);
  if (!p) throw new Error("that is not a link to an X post");
  const r = await fetch(
    `https://cdn.syndication.twimg.com/tweet-result?id=${p.id}&token=${tokenFor(p.id)}&lang=en`,
    { signal: AbortSignal.timeout(8000), headers: { accept: "application/json" }, cache: "no-store" }
  );
  if (r.status === 404) throw new Error("post not found — it may be deleted, private or age-restricted");
  if (!r.ok) throw new Error(`X did not return the post (HTTP ${r.status})`);
  const j = (await r.json()) as Raw;
  if (j.tombstone) throw new Error("this post is unavailable");

  // expand t.co links to what they say, drop media links
  let text = j.note_tweet?.text || j.text || "";
  for (const u of j.entities?.urls ?? []) text = text.replaceAll(u.url, u.display_url || u.expanded_url || "");
  for (const m of j.entities?.media ?? []) text = text.replaceAll(m.url, "");
  text = text.replace(/\s+/g, " ").trim();
  if (text.length < 8) throw new Error("this post has no text to check (image or video only)");

  return {
    url: `https://x.com/${j.user?.screen_name || p.handle}/status/${p.id}`,
    id: p.id,
    author: j.user?.name || p.handle,
    handle: j.user?.screen_name || p.handle,
    avatar: (j.user?.profile_image_url_https || "").replace("_normal.", "_bigger."),
    text: text.slice(0, 600),
    created: j.created_at || "",
  };
}

// What the cores are asked. The post is quoted in full so every core —
// reference or community — judges the same words.
export const questionFor = (p: XPost) =>
  `Is the main factual claim of this X post true? Post by @${p.handle}: "${p.text}"`.slice(0, 700);
