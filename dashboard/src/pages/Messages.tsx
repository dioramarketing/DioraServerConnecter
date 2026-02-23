import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api/client';
import { useAuthStore } from '../stores/auth';
import { Send } from 'lucide-react';

interface Msg {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  sender: { id: string; username: string };
}

export function MessagesPage() {
  const me = useAuthStore((s) => s.user);
  const [users, setUsers] = useState<{ id: string; username: string }[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [channelInput, setChannelInput] = useState('');
  const [mode, setMode] = useState<'dm' | 'channel'>('dm');
  const [channel, setChannel] = useState('general');

  useEffect(() => {
    api.get<any[]>('/admin/users').then((u) => setUsers(u.filter((x: any) => x.id !== me?.userId).map((x: any) => ({ id: x.id, username: x.username })))).catch(() => {});
  }, []);

  useEffect(() => {
    if (mode === 'dm' && selectedUser) {
      api.get<Msg[]>(`/messages/dm/${selectedUser}`).then(setMessages).catch(() => {});
    } else if (mode === 'channel') {
      api.get<Msg[]>(`/messages/channel/${channel}`).then(setMessages).catch(() => {});
    }
  }, [selectedUser, mode, channel]);

  const sendMsg = async (e: FormEvent) => {
    e.preventDefault();
    const content = mode === 'dm' ? input : channelInput;
    if (!content.trim()) return;
    await api.post('/messages', {
      ...(mode === 'dm' ? { recipientId: selectedUser } : { channelId: channel }),
      content,
    });
    mode === 'dm' ? setInput('') : setChannelInput('');
    // Reload
    if (mode === 'dm' && selectedUser) {
      api.get<Msg[]>(`/messages/dm/${selectedUser}`).then(setMessages);
    } else {
      api.get<Msg[]>(`/messages/channel/${channel}`).then(setMessages);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">Messages</h1>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setMode('dm')} className={`px-4 py-1.5 rounded-lg text-sm cursor-pointer ${mode === 'dm' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}>Direct Messages</button>
        <button onClick={() => setMode('channel')} className={`px-4 py-1.5 rounded-lg text-sm cursor-pointer ${mode === 'channel' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}`}>Channels</button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 flex" style={{ height: 500 }}>
        <div className="w-48 border-r border-slate-200 overflow-auto">
          {mode === 'dm' ? (
            users.map((u) => (
              <button key={u.id} onClick={() => setSelectedUser(u.id)} className={`w-full text-left px-4 py-3 text-sm border-b border-slate-100 cursor-pointer ${selectedUser === u.id ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}>
                {u.username}
              </button>
            ))
          ) : (
            ['general', 'dev', 'random'].map((ch) => (
              <button key={ch} onClick={() => setChannel(ch)} className={`w-full text-left px-4 py-3 text-sm border-b border-slate-100 cursor-pointer ${channel === ch ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}>
                # {ch}
              </button>
            ))
          )}
        </div>

        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-auto p-4 flex flex-col-reverse gap-2">
            {messages.map((m) => (
              <div key={m.id} className={`flex flex-col ${m.senderId === me?.userId ? 'items-end' : 'items-start'}`}>
                <span className="text-xs text-slate-400 mb-0.5">{m.sender.username}</span>
                <div className={`px-3 py-2 rounded-lg text-sm max-w-xs ${m.senderId === me?.userId ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-800'}`}>
                  {m.content}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={sendMsg} className="border-t border-slate-200 p-3 flex gap-2">
            <input
              value={mode === 'dm' ? input : channelInput}
              onChange={(e) => mode === 'dm' ? setInput(e.target.value) : setChannelInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg outline-none text-sm"
              disabled={mode === 'dm' && !selectedUser}
            />
            <button type="submit" className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer" disabled={mode === 'dm' && !selectedUser}>
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
