import { create } from 'zustand';
import { useAuthStore } from './auth';

interface ChatMessage {
  senderId: string;
  senderName: string;
  recipientId?: string;
  content: string;
  createdAt: string;
}

interface WsState {
  connected: boolean;
  metrics: any;
  chatMessages: ChatMessage[];
  notifications: { type: string; title: string; message: string }[];
  connect: () => void;
  disconnect: () => void;
  sendChatMessage: (recipientId: string, content: string) => void;
  clearChat: () => void;
}

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export const useWsStore = create<WsState>((set, get) => ({
  connected: false,
  metrics: null,
  chatMessages: [],
  notifications: [],

  connect: () => {
    if (ws?.readyState === WebSocket.OPEN) return;

    const { serverUrl, accessToken } = useAuthStore.getState();
    if (!accessToken) return;

    const protocol = serverUrl.startsWith('https') ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${serverUrl.replace(/^https?:\/\//, '')}/ws`;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      if (ws && accessToken) {
        ws.send(JSON.stringify({ type: 'AUTH', payload: accessToken, timestamp: new Date().toISOString() }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'AUTH_OK') {
          set({ connected: true });
          return;
        }
        if (msg.type === 'METRICS_UPDATE') {
          set({ metrics: msg.payload });
          return;
        }
        if (msg.type === 'CHAT_MESSAGE') {
          const chatMsg: ChatMessage = {
            ...msg.payload,
            createdAt: msg.timestamp,
          };
          set((state) => ({
            chatMessages: [...state.chatMessages, chatMsg],
          }));
          return;
        }
        if (msg.type === 'NOTIFICATION') {
          set((state) => ({
            notifications: [msg.payload, ...state.notifications].slice(0, 50),
          }));
          return;
        }
      } catch { /* */ }
    };

    ws.onclose = () => {
      set({ connected: false });
      reconnectTimer = setTimeout(() => get().connect(), 5000);
    };

    ws.onerror = () => ws?.close();
  },

  disconnect: () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    ws?.close();
    ws = null;
    set({ connected: false });
  },

  sendChatMessage: (recipientId: string, content: string) => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'CHAT_MESSAGE',
        payload: { recipientId, content },
        timestamp: new Date().toISOString(),
      }));
      // Add to local messages immediately
      const { user } = useAuthStore.getState();
      if (user) {
        set((state) => ({
          chatMessages: [...state.chatMessages, {
            senderId: user.userId,
            senderName: user.username,
            recipientId,
            content,
            createdAt: new Date().toISOString(),
          }],
        }));
      }
    }
  },

  clearChat: () => set({ chatMessages: [] }),
}));
