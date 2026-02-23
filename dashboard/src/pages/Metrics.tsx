import { useWsStore } from '../stores/ws';
import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface HistoryPoint {
  time: string;
  cpu: number;
  memory: number;
}

export function MetricsPage() {
  const metrics = useWsStore((s) => s.metrics);
  const [history, setHistory] = useState<HistoryPoint[]>([]);

  useEffect(() => {
    if (!metrics) return;
    setHistory((prev) => {
      const next = [...prev, {
        time: new Date().toLocaleTimeString(),
        cpu: metrics.host.cpuPercent,
        memory: Math.round(metrics.host.memoryUsedMb / 1024 * 10) / 10,
      }];
      return next.slice(-60);
    });
  }, [metrics]);

  if (!metrics) return <p className="text-slate-400">Waiting for metrics...</p>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">System Metrics</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <h2 className="font-semibold text-slate-800 mb-4">CPU Usage (%)</h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#94a3b8" />
              <YAxis domain={[0, 100]} stroke="#94a3b8" />
              <Tooltip />
              <Line type="monotone" dataKey="cpu" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <h2 className="font-semibold text-slate-800 mb-4">Memory Usage (GB)</h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip />
              <Line type="monotone" dataKey="memory" stroke="#8b5cf6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-5 border border-slate-200 text-center">
          <p className="text-3xl font-bold text-blue-600">{metrics.host.cpuPercent.toFixed(1)}%</p>
          <p className="text-sm text-slate-500 mt-1">CPU Load</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-slate-200 text-center">
          <p className="text-3xl font-bold text-purple-600">{(metrics.host.memoryUsedMb / 1024).toFixed(1)} GB</p>
          <p className="text-sm text-slate-500 mt-1">Memory Used / {(metrics.host.memoryTotalMb / 1024).toFixed(0)} GB</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-slate-200 text-center">
          <p className="text-3xl font-bold text-green-600">{formatBytes(metrics.host.networkRxBytesPerSec)}/s</p>
          <p className="text-sm text-slate-500 mt-1">Network RX</p>
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 border border-slate-200">
        <h2 className="font-semibold text-slate-800 mb-4">Disk Usage</h2>
        <div className="space-y-4">
          {metrics.host.diskUsage.map((d) => {
            const pct = (d.usedGb / d.totalGb) * 100;
            return (
              <div key={d.mount}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-700 font-medium">{d.mount}</span>
                  <span className="text-slate-500">{d.usedGb.toFixed(1)} / {d.totalGb.toFixed(1)} GB ({pct.toFixed(1)}%)</span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-yellow-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
