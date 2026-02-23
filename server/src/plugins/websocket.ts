import type { FastifyInstance } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import { verifyAccessToken, type TokenPayload } from '../services/auth.service.js';
import * as monitorService from '../services/monitor.service.js';
import type { WsMessage } from '@dsc/shared';

interface WsClient {
  ws: WebSocket;
  user: TokenPayload;
  subscriptions: Set<string>;
}

const clients = new Map<string, WsClient>();
let metricsInterval: ReturnType<typeof setInterval> | null = null;

export default async function websocketPlugin(fastify: FastifyInstance) {
  fastify.get('/ws', { websocket: true }, (socket, request) => {
    let authenticated = false;
    let clientId: string | null = null;

    // Must authenticate within 10 seconds
    const authTimeout = setTimeout(() => {
      if (!authenticated) {
        socket.send(JSON.stringify({ type: 'ERROR', payload: 'Authentication timeout' }));
        socket.close();
      }
    }, 10000);

    socket.on('message', async (raw: Buffer | string) => {
      try {
        const msg = JSON.parse(raw.toString()) as WsMessage;

        // Handle authentication
        if (msg.type === 'AUTH' as any) {
          try {
            const user = await verifyAccessToken(msg.payload as string);
            authenticated = true;
            clientId = `${user.sub}-${Date.now()}`;
            clients.set(clientId, { ws: socket, user, subscriptions: new Set(['metrics', 'notifications']) });
            clearTimeout(authTimeout);
            socket.send(JSON.stringify({ type: 'AUTH_OK', payload: { userId: user.sub }, timestamp: new Date().toISOString() }));
          } catch {
            socket.send(JSON.stringify({ type: 'AUTH_ERROR', payload: 'Invalid token' }));
            socket.close();
          }
          return;
        }

        if (!authenticated || !clientId) {
          socket.send(JSON.stringify({ type: 'ERROR', payload: 'Not authenticated' }));
          return;
        }

        // Handle ping
        if (msg.type === 'PING') {
          socket.send(JSON.stringify({ type: 'PONG', payload: null, timestamp: new Date().toISOString() }));
          return;
        }

        // Handle subscription changes
        if (msg.type === 'SUBSCRIBE' as any) {
          const client = clients.get(clientId);
          if (client) client.subscriptions.add(msg.payload as string);
          return;
        }
        if (msg.type === 'UNSUBSCRIBE' as any) {
          const client = clients.get(clientId);
          if (client) client.subscriptions.delete(msg.payload as string);
          return;
        }

        // Handle chat message
        if (msg.type === 'CHAT_MESSAGE') {
          const chatMsg = msg.payload as { recipientId?: string; channelId?: string; content: string };
          const client = clients.get(clientId)!;
          // Broadcast to recipient(s)
          broadcastToUser(chatMsg.recipientId || null, chatMsg.channelId || null, {
            type: 'CHAT_MESSAGE',
            payload: {
              senderId: client.user.sub,
              senderName: client.user.username,
              ...chatMsg,
            },
            timestamp: new Date().toISOString(),
          });
        }
      } catch {
        // Ignore malformed messages
      }
    });

    socket.on('close', () => {
      clearTimeout(authTimeout);
      if (clientId) clients.delete(clientId);
    });
  });

  // Start metrics broadcasting interval
  if (!metricsInterval) {
    metricsInterval = setInterval(async () => {
      if (clients.size === 0) return;
      try {
        const metrics = await monitorService.getAllMetrics();
        const msg: WsMessage = {
          type: 'METRICS_UPDATE',
          payload: metrics,
          timestamp: new Date().toISOString(),
        };
        const data = JSON.stringify(msg);
        for (const client of clients.values()) {
          if (client.subscriptions.has('metrics') && client.ws.readyState === 1) {
            client.ws.send(data);
          }
        }
      } catch {
        // Ignore metrics errors
      }
    }, 5000);

    // Record usage snapshot every 5 minutes
    setInterval(async () => {
      try {
        await monitorService.recordUsageSnapshot();
      } catch {
        // Ignore
      }
    }, 5 * 60 * 1000);
  }
}

// Broadcast to a specific user or channel
function broadcastToUser(userId: string | null, channelId: string | null, msg: WsMessage) {
  const data = JSON.stringify(msg);
  for (const client of clients.values()) {
    if (client.ws.readyState !== 1) continue;
    if (userId && client.user.sub === userId) {
      client.ws.send(data);
    } else if (channelId && client.subscriptions.has(`channel:${channelId}`)) {
      client.ws.send(data);
    }
  }
}

// Export for use by other modules to push notifications
export function pushNotification(userId: string, notification: { type: string; title: string; message: string }) {
  const msg: WsMessage = {
    type: 'NOTIFICATION',
    payload: notification,
    timestamp: new Date().toISOString(),
  };
  const data = JSON.stringify(msg);
  for (const client of clients.values()) {
    if (client.user.sub === userId && client.subscriptions.has('notifications') && client.ws.readyState === 1) {
      client.ws.send(data);
    }
  }
}

export function pushContainerStatus(userId: string, status: { containerId: string; status: string }) {
  const msg: WsMessage = {
    type: 'CONTAINER_STATUS',
    payload: status,
    timestamp: new Date().toISOString(),
  };
  const data = JSON.stringify(msg);
  for (const client of clients.values()) {
    if ((client.user.sub === userId || client.user.role === 'ADMIN') && client.ws.readyState === 1) {
      client.ws.send(data);
    }
  }
}
