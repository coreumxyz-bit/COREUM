import { redirect } from "next/navigation";

// the holder tier lives on /cors with the rest of what $CORS does
export default function HoldersPage() {
  redirect("/cors");
}
