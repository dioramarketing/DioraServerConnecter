import { useAuthStore } from '../stores/auth';
import { Clock, LogOut } from 'lucide-react';

export function PendingPage() {
  const logout = useAuthStore((s) => s.logout);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm text-center">
        <div className="flex justify-center mb-4">
          <div className="p-4 bg-yellow-50 rounded-full">
            <Clock className="w-12 h-12 text-yellow-500" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Device Pending Approval</h2>
        <p className="text-slate-500 text-sm mb-6">
          Your device has been registered and is waiting for administrator approval.
          You will be able to connect once approved.
        </p>
        <button
          onClick={logout}
          className="flex items-center justify-center gap-2 w-full py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          Back to Login
        </button>
      </div>
    </div>
  );
}
