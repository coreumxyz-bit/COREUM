// Google Fonts' CSS API serves TTF to a UA-less request — exactly what
// ImageResponse needs. Any failure returns null so cards still render.
export async function googleFont(family: string, weight = 400): Promise<ArrayBuffer | null> {
  try {
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}`, {
        signal: AbortSignal.timeout(4000),
      })
    ).text();
    const url = css.match(/src: url\((.+?)\)/)?.[1];
    if (!url) return null;
    return await (await fetch(url, { signal: AbortSignal.timeout(4000) })).arrayBuffer();
  } catch {
    return null;
  }
}
