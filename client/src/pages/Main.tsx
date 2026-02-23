import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/auth';
import { invoke } from '@tauri-apps/api/core';
import {
  Monitor,
  Terminal as TerminalIcon,
  FolderOpen,
  MessageSquare,
  Settings,
  LogOut,
  Wifi,
  WifiOff,
  ExternalLink,
  Key,
  Server,
  Cpu,
  HardDrive,
} from 'lucide-react';

type Tab = 'connect' | 'terminal' | 'files' | 'chat' | 'settings';

export function MainPage() {
  const { user, logout, connectionInfo, fetchConnectionInfo, serverUrl, accessToken } = useAuthStore();
  const [activeTab, setActiveTab] = useState<Tab>('connect');
  const [wsConnected, setWsConnected] = useState(false);
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    fetchConnectionInfo();

    // WebSocket for real-time updates
    const protocol = serverUrl.startsWith('https') ? 'wss' : 'ws';
    const wsUrl = `${protocol}://${serverUrl.replace(/^https?:\/\//, '')}/ws`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      if (accessToken) ws.send(JSON.stringify({ type: 'AUTH', payload: accessToken, timestamp: new Date().toISOString() }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'AUTH_OK') setWsConnected(true);
      if (msg.type === 'METRICS_UPDATE') setMetrics(msg.payload);
    };
    ws.onclose = () => setWsConnected(false);

    return () => ws.close();
  }, []);

  const openVsCode = async () => {
    if (!connectionInfo) return;
    try {
      await invoke('open_vscode', { host: connectionInfo.host, port: connectionInfo.port });
    } catch {
      window.open(connectionInfo.vsCodeUri, '_blank');
    }
  };

  const generateAndRegisterKey = async () => {
    try {
      const key = await invoke<{ public_key: string; key_path: string }>('generate_ssh_key', { label: user?.username || 'default' });
      // Register with server
      await fetch(`${serverUrl}/api/v1/connection/ssh-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ publicKey: key.public_key, label: `${user?.username}-client` }),
      });

      // Write SSH config
      if (connectionInfo) {
        await invoke('write_ssh_config', {
          host: connectionInfo.host,
          port: connectionInfo.port,
          user: 'devuser',
          keyPath: key.key_path,
        });
      }
      alert('SSH key generated and registered successfully!');
    } catch (err: any) {
      alert(`Error: ${err}`);
    }
  };

  const tabs = [
    { id: 'connect' as Tab, icon: Monitor, label: 'Connect' },
    { id: 'terminal' as Tab, icon: TerminalIcon, label: 'Terminal' },
    { id: 'files' as Tab, icon: FolderOpen, label: 'Files' },
    { id: 'chat' as Tab, icon: MessageSquare, label: 'Chat' },
    { id: 'settings' as Tab, icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <div className="w-14 bg-slate-900 flex flex-col items-center py-3 gap-1">
        <Server className="w-6 h-6 text-blue-400 mb-4" />
        {tabs.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`p-2.5 rounded-lg cursor-pointer ${activeTab === id ? 'bg-blue-600/20 text-blue-400' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            title={label}
          >
            <Icon className="w-5 h-5" />
          </button>
        ))}
        <div className="flex-1" />
        <div className="mb-2">
          {wsConnected ? <Wifi className="w-4 h-4 text-green-400" /> : <WifiOff className="w-4 h-4 text-red-400" />}
        </div>
        <button onClick={logout} className="p-2.5 text-slate-400 hover:text-red-400 cursor-pointer" title="Logout">
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 p-6 overflow-auto">
        {activeTab === 'connect' && (
          <div className="max-w-2xl mx-auto">
            <h1 className="text-2xl font-bold text-slate-800 mb-6">Connection</h1>

            {connectionInfo ? (
              <div className="space-y-4">
                <div className="bg-white rounded-xl p-5 border border-slate-200">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="font-semibold text-slate-800">Container: {connectionInfo.containerName}</h2>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${connectionInfo.status === 'RUNNING' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {connectionInfo.status}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-slate-500">Host</span><span className="font-mono">{connectionInfo.host}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">SSH Port</span><span className="font-mono">{connectionInfo.port}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">User</span><span className="font-mono">{connectionInfo.username}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">SSH Command</span><span className="font-mono text-xs">{connectionInfo.sshCommand}</span></div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={openVsCode} className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 cursor-pointer">
                    <ExternalLink className="w-5 h-5" />
                    Open VS Code
                  </button>
                  <button onClick={generateAndRegisterKey} className="flex items-center gap-2 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 cursor-pointer">
                    <Key className="w-5 h-5" />
                    Setup SSH Key
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl p-8 border border-slate-200 text-center">
                <p className="text-slate-400">No container assigned. Contact your administrator.</p>
              </div>
            )}

            {/* Resource monitor */}
            {metrics && (
              <div className="mt-6 bg-white rounded-xl p-5 border border-slate-200">
                <h2 className="font-semibold text-slate-800 mb-3">Server Resources</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <Cpu className="w-5 h-5 text-blue-500" />
                    <div>
                      <p className="text-sm text-slate-500">CPU</p>
                      <p className="font-bold">{metrics.host.cpuPercent.toFixed(1)}%</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <HardDrive className="w-5 h-5 text-purple-500" />
                    <div>
                      <p className="text-sm text-slate-500">Memory</p>
                      <p className="font-bold">{(metrics.host.memoryUsedMb / 1024).toFixed(1)} GB</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'terminal' && (
          <div className="h-full">
            <h1 className="text-2xl font-bold text-slate-800 mb-4">Terminal</h1>
            <div className="bg-slate-900 rounded-xl p-4 h-96 flex items-center justify-center">
              <p className="text-slate-400">SSH Terminal (xterm.js) - requires container connection</p>
            </div>
          </div>
        )}

        {activeTab === 'files' && (
          <div>
            <h1 className="text-2xl font-bold text-slate-800 mb-4">File Manager</h1>
            <div className="bg-white rounded-xl p-8 border border-slate-200 text-center">
              <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400">SFTP File Manager - requires container connection</p>
            </div>
          </div>
        )}

        {activeTab === 'chat' && (
          <div>
            <h1 className="text-2xl font-bold text-slate-800 mb-4">Team Chat</h1>
            <div className="bg-white rounded-xl p-8 border border-slate-200 text-center">
              <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-400">Chat feature - connect to server first</p>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-lg mx-auto">
            <h1 className="text-2xl font-bold text-slate-800 mb-6">Settings</h1>
            <div className="bg-white rounded-xl p-5 border border-slate-200 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Server URL</label>
                <p className="text-sm text-slate-500 font-mono">{serverUrl}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">User</label>
                <p className="text-sm text-slate-500">{user?.username} ({user?.role})</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Version</label>
                <p className="text-sm text-slate-500">1.0.0</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
