import Nav from "@/components/Nav";
import { ChatBox } from "@/components/ChatWidget";

export const metadata = {
  title: "Ask Coreum",
  description: "An AI assistant for Robinhood Chain: ask about any token, ticker or wallet and get Coreum's grade with the proof, or ask anything.",
};

export default function ChatPage() {
  return (
    <main className="relative z-[1] flex h-[100dvh] flex-col overflow-hidden">
      <Nav active="/chat" />
      <div className="mt-[88px] min-h-0 flex-1">
        <ChatBox full />
      </div>
    </main>
  );
}
