import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { useAuthStore } from '../stores/auth';

export function Terminal() {
  const { serverUrl, accessToken } = useAuthStore();
  const termRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [errorMsg, setErrorMsg] = useState('');

  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus('connecting');
    setErrorMsg('');

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
      theme: {
        background: '#0f172a',
        foreground: '#e2e8f0',
        cursor: '#60a5fa',
        selectionBackground: '#334155',
        black: '#1e293b',
        red: '#f87171',
        green: '#4ade80',
        yellow: '#facc15',
        blue: '#60a5fa',
        magenta: '#c084fc',
        cyan: '#22d3ee',
        white: '#e2e8f0',
      },
    });

    const fit = new FitAddon();
    term.loadAddon(fit);

    if (termRef.current) {
      termRef.current.innerHTML = '';
      term.open(termRef.current);
      fit.fit();
    }

    xtermRef.current = term;
    fitRef.current = fit;

    const protocol = serverUrl.startsWith('https') ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${serverUrl.replace(/^https?:\/\//, '')}/ws`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'AUTH', payload: accessToken, timestamp: new Date().toISOString() }));
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);

      if (msg.type === 'AUTH_OK') {
        // Open terminal session
        const { cols, rows } = term;
        ws.send(JSON.stringify({ type: 'TERMINAL_OPEN', payload: { cols, rows }, timestamp: new Date().toISOString() }));
        return;
      }

      if (msg.type === 'TERMINAL_OPENED') {
        sessionIdRef.current = msg.payload.sessionId;
        setStatus('connected');

        // Send input from xterm to WebSocket
        term.onData((data) => {
          if (ws.readyState === WebSocket.OPEN && sessionIdRef.current) {
            ws.send(JSON.stringify({
              type: 'TERMINAL_DATA',
              payload: { sessionId: sessionIdRef.current, data: btoa(data) },
              timestamp: new Date().toISOString(),
            }));
          }
        });

        return;
      }

      if (msg.type === 'TERMINAL_DATA') {
        const decoded = atob(msg.payload.data);
        term.write(decoded);
        return;
      }

      if (msg.type === 'TERMINAL_CLOSED') {
        setStatus('disconnected');
        term.writeln('\r\n\x1b[33m[Session ended]\x1b[0m');
        sessionIdRef.current = null;
        return;
      }

      if (msg.type === 'TERMINAL_ERROR') {
        setStatus('error');
        setErrorMsg(msg.payload);
        term.writeln(`\r\n\x1b[31m[Error: ${msg.payload}]\x1b[0m`);
        return;
      }
    };

    ws.onclose = () => {
      if (status !== 'error') setStatus('disconnected');
      sessionIdRef.current = null;
    };

    ws.onerror = () => {
      setStatus('error');
      setErrorMsg('WebSocket connection failed');
    };
  };

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (fitRef.current && xtermRef.current) {
        fitRef.current.fit();
        const { cols, rows } = xtermRef.current;
        if (wsRef.current?.readyState === WebSocket.OPEN && sessionIdRef.current) {
          wsRef.current.send(JSON.stringify({
            type: 'TERMINAL_RESIZE',
            payload: { sessionId: sessionIdRef.current, cols, rows },
            timestamp: new Date().toISOString(),
          }));
        }
      }
    };

    const observer = new ResizeObserver(handleResize);
    if (termRef.current) observer.observe(termRef.current);

    return () => {
      observer.disconnect();
      wsRef.current?.close();
      xtermRef.current?.dispose();
    };
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    connect();
  }, []);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-2xl font-bold text-slate-800">Terminal</h1>
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
            status === 'connected' ? 'bg-green-100 text-green-700' :
            status === 'connecting' ? 'bg-yellow-100 text-yellow-700' :
            status === 'error' ? 'bg-red-100 text-red-700' :
            'bg-slate-100 text-slate-500'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              status === 'connected' ? 'bg-green-500' :
              status === 'connecting' ? 'bg-yellow-500 animate-pulse' :
              status === 'error' ? 'bg-red-500' :
              'bg-slate-400'
            }`} />
            {status === 'connected' ? 'Connected' :
             status === 'connecting' ? 'Connecting...' :
             status === 'error' ? 'Error' : 'Disconnected'}
          </span>
          {status !== 'connected' && status !== 'connecting' && (
            <button
              onClick={connect}
              className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer"
            >
              Reconnect
            </button>
          )}
        </div>
      </div>
      {errorMsg && status === 'error' && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {errorMsg}
        </div>
      )}
      <div
        ref={termRef}
        className="flex-1 bg-[#0f172a] rounded-xl p-2 min-h-[400px]"
      />
    </div>
  );
}
