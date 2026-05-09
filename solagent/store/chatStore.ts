import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Message } from "../types/chat";

interface ChatState {
  messages: Message[];
  isThinking: boolean;
  addMessage: (msg: Message) => void;
  setThinking: (state: boolean) => void;
  clear: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: [],
      isThinking: false,
      addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
      setThinking: (isThinking) => set({ isThinking }),
      clear: () => set({ messages: [] }),
    }),
    {
      name: "solagent-chat",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
