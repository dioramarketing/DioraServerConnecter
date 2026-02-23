import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useWsStore } from '../stores/ws';
import { Users, Container, Smartphone, Activity } from 'lucide-react';

interface Stats {
  userCount: number;
  containerCount: number;
  runningContainers: number;
  pendingDevices: number;
}

export function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const metrics = useWsStore((s) => s.metrics);

  useEffect(() => {
    Promise.all([
      api.get<any[]>('/admin/users'),
      api.get<any[]>('/containers'),
      api.get<any[]>('/devices/pending'),
    ]).then(([users, containers, devices]) => {
      setStats({
        userCount: users.length,
        containerCount: containers.length,
        runningContainers: containers.filter((c: any) => c.status === 'RUNNING').length,
        pendingDevices: devices.length,
      });
    }).catch(() => {});
  }, []);

  const cards = [
    { icon: Users, label: 'Total Users', value: stats?.userCount ?? '-', color: 'text-blue-600 bg-blue-50' },
    { icon: Container, label: 'Containers', value: stats ? `${stats.runningContainers}/${stats.containerCount}` : '-', color: 'text-green-600 bg-green-50' },
    { icon: Smartphone, label: 'Pending Devices', value: stats?.pendingDevices ?? '-', color: 'text-orange-600 bg-orange-50' },
    { icon: Activity, label: 'CPU Usage', value: metrics ? `${metrics.host.cpuPercent.toFixed(1)}%` : '-', color: 'text-purple-600 bg-purple-50' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="bg-white rounded-xl p-5 border border-slate-200">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-slate-500">{label}</p>
                <p className="text-2xl font-bold text-slate-800">{value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {metrics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-5 border border-slate-200">
            <h2 className="font-semibold text-slate-800 mb-3">System Resources</h2>
            <div className="space-y-3">
              <ResourceBar
                label="CPU"
                value={metrics.host.cpuPercent}
                max={100}
                unit="%"
              />
              <ResourceBar
                label="Memory"
                value={metrics.host.memoryUsedMb}
                max={metrics.host.memoryTotalMb}
                unit="MB"
              />
              {metrics.host.diskUsage.map((d) => (
                <ResourceBar
                  key={d.mount}
                  label={`Disk ${d.mount}`}
                  value={d.usedGb}
                  max={d.totalGb}
                  unit="GB"
                />
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 border border-slate-200">
            <h2 className="font-semibold text-slate-800 mb-3">Container Status</h2>
            {metrics.containers.length === 0 ? (
              <p className="text-slate-400 text-sm">No active containers</p>
            ) : (
              <div className="space-y-3">
                {metrics.containers.map((c) => (
                  <div key={c.containerId} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{c.containerId.slice(0, 8)}</span>
                    <div className="flex gap-4 text-slate-500">
                      <span>CPU: {c.cpuPercent.toFixed(1)}%</span>
                      <span>RAM: {c.memoryUsedMb}MB/{c.memoryLimitMb}MB</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ResourceBar({ label, value, max, unit }: { label: string; value: number; max: number; unit: string }) {
  const pct = Math.min((value / max) * 100, 100);
  const color = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-yellow-500' : 'bg-blue-500';

  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-600">{label}</span>
        <span className="text-slate-500">{Math.round(value)}/{Math.round(max)} {unit}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
