import { useState } from "react";
import { executeConfirmedAction, sendMessage as streamAgentMessage, type AgentEvent, type PendingAction } from "../services/claude";
import { useChatStore } from "../store/chatStore";
import { useWalletStore } from "../store/walletStore";
import type { Message } from "../types/chat";

function createMessage(role: Message["role"], content: string): Message {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

export function useChat() {
  const { messages, addMessage, isThinking, setThinking } = useChatStore();
  const wallet = useWalletStore();
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [streamedResponse, setStreamedResponse] = useState("");

  function appendToLatestAgentMessage(chunk: string): void {
    setStreamedResponse((prev) => `${prev}${chunk}`);
  }

  function eventToMessage(event: AgentEvent): string | null {
    if (event.type === "error") return event.message;
    if (event.type === "tool_call") return `Running ${event.tool}...`;
    if (event.type === "tool_result") return `${event.tool} finished.`;
    return null;
  }

  async function sendMessage(input: string) {
    addMessage(createMessage("user", input));
    setThinking(true);
    setStreamedResponse("");
    let fullText = "";
    try {
      for await (const event of streamAgentMessage(input, messages, wallet.address ?? "Not connected")) {
        if (event.type === "text") {
          fullText += event.content;
          appendToLatestAgentMessage(event.content);
          continue;
        }
        if (event.type === "action_required") {
          setPendingAction(event.action);
          addMessage(createMessage("agent", "I prepared the action preview. Confirm to proceed."));
          continue;
        }
        const msg = eventToMessage(event);
        if (msg) addMessage(createMessage("agent", msg));
      }
      if (fullText.trim()) addMessage(createMessage("agent", fullText.trim()));
    } finally {
      setThinking(false);
    }
  }

  async function confirmPendingAction(): Promise<void> {
    if (!pendingAction) return;
    setThinking(true);
    try {
      const result = await executeConfirmedAction(pendingAction);
      addMessage(createMessage("agent", result));
      setPendingAction(null);
    } catch {
      addMessage(createMessage("agent", "The transaction didn't go through. Want me to try again?"));
    } finally {
      setThinking(false);
    }
  }

  function cancelPendingAction(): void {
    if (!pendingAction) return;
    addMessage(createMessage("user", "Cancel this action"));
    addMessage(createMessage("agent", "Action cancelled."));
    setPendingAction(null);
  }

  return { messages, isThinking, sendMessage, pendingAction, confirmPendingAction, cancelPendingAction, streamedResponse };
}
