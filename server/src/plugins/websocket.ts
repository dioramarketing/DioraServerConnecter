import type { FastifyInstance } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import { verifyAccessToken, type TokenPayload } from '../services/auth.service.js';
import * as monitorService from '../services/monitor.service.js';
import type { WsMessage } from '@dsc/shared';
import { docker } from '../lib/docker.js';
import { prisma } from '../lib/prisma.js';
import type { Duplex } from 'node:stream';

interface WsClient {
  ws: WebSocket;
  user: TokenPayload;
  subscriptions: Set<string>;
}

interface TerminalSession {
  exec: any;
  stream: Duplex;
  containerId: string;
}

const clients = new Map<string, WsClient>();
const terminalSessions = new Map<string, TerminalSession>();
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

        // ── Terminal messages ────────────────────────────
        if ((msg.type as string) === 'TERMINAL_OPEN') {
          const client = clients.get(clientId)!;
          const payload = msg.payload as { cols?: number; rows?: number };
          try {
            // Find user's container
            const containerRecord = await prisma.container.findUnique({ where: { userId: client.user.sub } });
            if (!containerRecord?.containerId) {
              socket.send(JSON.stringify({ type: 'TERMINAL_ERROR', payload: 'No container assigned' }));
              return;
            }
            const container = docker.getContainer(containerRecord.containerId);
            const exec = await container.exec({
              Cmd: ['/bin/bash'],
              AttachStdin: true,
              AttachStdout: true,
              AttachStderr: true,
              Tty: true,
              Env: ['TERM=xterm-256color'],
            });
            const stream = await exec.start({ hijack: true, stdin: true, Tty: true });

            // Resize if dimensions provided
            if (payload?.cols && payload?.rows) {
              try { await exec.resize({ h: payload.rows, w: payload.cols }); } catch { /* */ }
            }

            const sessionId = `term-${clientId}-${Date.now()}`;
            terminalSessions.set(sessionId, { exec, stream, containerId: containerRecord.containerId });

            // Relay stdout → WebSocket
            stream.on('data', (chunk: Buffer) => {
              if (socket.readyState === 1) {
                socket.send(JSON.stringify({
                  type: 'TERMINAL_DATA',
                  payload: { sessionId, data: chunk.toString('base64') },
                }));
              }
            });

            stream.on('end', () => {
              terminalSessions.delete(sessionId);
              if (socket.readyState === 1) {
                socket.send(JSON.stringify({ type: 'TERMINAL_CLOSED', payload: { sessionId } }));
              }
            });

            socket.send(JSON.stringify({ type: 'TERMINAL_OPENED', payload: { sessionId } }));
          } catch (err: any) {
            socket.send(JSON.stringify({ type: 'TERMINAL_ERROR', payload: err.message || 'Failed to open terminal' }));
          }
          return;
        }

        if ((msg.type as string) === 'TERMINAL_DATA') {
          const { sessionId, data } = msg.payload as { sessionId: string; data: string };
          const session = terminalSessions.get(sessionId);
          if (session) {
            session.stream.write(Buffer.from(data, 'base64'));
          }
          return;
        }

        if ((msg.type as string) === 'TERMINAL_RESIZE') {
          const { sessionId, cols, rows } = msg.payload as { sessionId: string; cols: number; rows: number };
          const session = terminalSessions.get(sessionId);
          if (session) {
            try { await session.exec.resize({ h: rows, w: cols }); } catch { /* */ }
          }
          return;
        }

        if ((msg.type as string) === 'TERMINAL_CLOSE') {
          const { sessionId } = msg.payload as { sessionId: string };
          const session = terminalSessions.get(sessionId);
          if (session) {
            session.stream.end();
            terminalSessions.delete(sessionId);
          }
          return;
        }
      } catch {
        // Ignore malformed messages
      }
    });

    socket.on('close', () => {
      clearTimeout(authTimeout);
      if (clientId) {
        // Clean up terminal sessions for this client
        for (const [sessionId, session] of terminalSessions.entries()) {
          if (sessionId.includes(clientId)) {
            session.stream.end();
            terminalSessions.delete(sessionId);
          }
        }
        clients.delete(clientId);
      }
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
