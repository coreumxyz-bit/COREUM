import { COREUMD_SCRIPT } from "@/lib/coreumdScript";

export function GET() {
  return new Response(COREUMD_SCRIPT, {
    headers: {
      "content-type": "text/javascript; charset=utf-8",
      "content-disposition": 'attachment; filename="coreumd.mjs"',
      "cache-control": "public, max-age=3600",
    },
  });
}
