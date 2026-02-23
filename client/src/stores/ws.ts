import { create } from 'zustand';
import { useAuthStore } from './auth';

interface ChatMessage {
  id: string;
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
let msgCounter = 0;

export const useWsStore = create<WsState>((set, get) => ({
  connected: false,
  metrics: null,
  chatMessages: [],
  notifications: [],

  connect: () => {
    // Guard against OPEN and CONNECTING states
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

    // Clear any pending reconnect timer
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

    const { serverUrl, accessToken } = useAuthStore.getState();
    if (!accessToken || !serverUrl) return;

    const protocol = serverUrl.startsWith('https') ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${serverUrl.replace(/^https?:\/\//, '')}/ws`;
    const socket = new WebSocket(wsUrl);
    ws = socket;

    socket.onopen = () => {
      if (socket.readyState === WebSocket.OPEN && accessToken) {
        socket.send(JSON.stringify({ type: 'AUTH', payload: accessToken, timestamp: new Date().toISOString() }));
      }
    };

    socket.onmessage = (event) => {
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
            id: `ws-${++msgCounter}`,
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
      } catch { /* ignore malformed messages */ }
    };

    socket.onclose = () => {
      set({ connected: false });
      // Only reconnect if this is still the active socket
      if (ws === socket) {
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => get().connect(), 5000);
      }
    };

    socket.onerror = () => {
      socket.close();
    };
  },

  disconnect: () => {
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    if (ws) { ws.close(); ws = null; }
    set({ connected: false });
  },

  sendChatMessage: (recipientId: string, content: string) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const now = new Date().toISOString();
    ws.send(JSON.stringify({
      type: 'CHAT_MESSAGE',
      payload: { recipientId, content },
      timestamp: now,
    }));

    // Add to local messages immediately (optimistic)
    const { user } = useAuthStore.getState();
    if (user) {
      set((state) => ({
        chatMessages: [...state.chatMessages, {
          id: `local-${++msgCounter}`,
          senderId: user.userId,
          senderName: user.username,
          recipientId,
          content,
          createdAt: now,
        }],
      }));
    }
  },

  clearChat: () => set({ chatMessages: [] }),
}));
