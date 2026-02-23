import { create } from 'zustand';

interface Metrics {
  host: {
    cpuPercent: number;
    memoryUsedMb: number;
    memoryTotalMb: number;
    diskUsage: { mount: string; usedGb: number; totalGb: number }[];
    networkRxBytesPerSec: number;
    networkTxBytesPerSec: number;
  };
  containers: {
    containerId: string;
    userId: string;
    cpuPercent: number;
    memoryUsedMb: number;
    memoryLimitMb: number;
    networkRxBytes: number;
    networkTxBytes: number;
  }[];
}

interface WsState {
  connected: boolean;
  metrics: Metrics | null;
  notifications: { type: string; title: string; message: string }[];
  connect: () => void;
  disconnect: () => void;
}

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export const useWsStore = create<WsState>((set, get) => ({
  connected: false,
  metrics: null,
  notifications: [],

  connect: () => {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${location.host}/ws`);

    ws.onopen = () => {
      const token = localStorage.getItem('accessToken');
      if (token && ws) {
        ws.send(JSON.stringify({ type: 'AUTH', payload: token, timestamp: new Date().toISOString() }));
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
}));
