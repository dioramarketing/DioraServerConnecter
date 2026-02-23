import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../lib/api';
import { useWsStore } from '../stores/ws';
import { useAuthStore } from '../stores/auth';
import { Send, User, MessageSquare, AlertCircle, RefreshCw } from 'lucide-react';

interface ChatUser {
  id: string;
  username: string;
  role: string;
}

interface HistoryMessage {
  id: string;
  senderId: string;
  recipientId: string | null;
  content: string;
  createdAt: string;
  sender: { id: string; username: string };
}

export function Chat() {
  const { user } = useAuthStore();
  const { chatMessages, sendChatMessage, connected } = useWsStore();
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [history, setHistory] = useState<HistoryMessage[]>([]);
  const [input, setInput] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledUp = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load users
  const loadUsers = useCallback(() => {
    setLoadingUsers(true);
    setError('');
    api.get<ChatUser[]>('/messages/users')
      .then(setUsers)
      .catch((err) => setError(`Failed to load users: ${err.message}`))
      .finally(() => setLoadingUsers(false));
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  // Load history when selecting a user
  useEffect(() => {
    if (!selectedUser) return;
    setLoadingHistory(true);
    setError('');
    api.get<HistoryMessage[]>(`/messages/dm/${selectedUser.id}?limit=100`)
      .then((msgs) => {
        setHistory(msgs.reverse());
        userScrolledUp.current = false;
      })
      .catch((err) => setError(`Failed to load messages: ${err.message}`))
      .finally(() => setLoadingHistory(false));
  }, [selectedUser]);

  // Detect manual scroll
  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    userScrolledUp.current = !atBottom;
  }, []);

  // Auto-scroll only on NEW messages (not history load), and only if user is at bottom
  useEffect(() => {
    if (!userScrolledUp.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  // Scroll to bottom on initial history load
  useEffect(() => {
    if (history.length > 0 && !loadingHistory) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [history, loadingHistory]);

  const handleSend = () => {
    if (!input.trim() || !selectedUser) return;
    sendChatMessage(selectedUser.id, input.trim());
    setInput('');
    userScrolledUp.current = false;
    inputRef.current?.focus();
  };

  // Merge history + real-time messages for the selected user, dedup by ID
  const historyIds = new Set(history.map((m) => m.id));
  const allMessages = [
    ...history.map((m) => ({
      id: m.id,
      senderId: m.senderId,
      senderName: m.sender.username,
      content: m.content,
      createdAt: m.createdAt,
    })),
    ...chatMessages
      .filter((m) =>
        selectedUser &&
        ((m.senderId === user?.userId && m.recipientId === selectedUser.id) ||
         (m.senderId === selectedUser.id && m.recipientId === user?.userId))
      )
      // Deduplicate: skip real-time messages that already exist in history (by content+time proximity)
      .filter((m) => !history.some((h) => h.id === m.id) && !historyIds.has(m.id))
      .map((m) => ({
        id: m.id,
        senderId: m.senderId,
        senderName: m.senderName,
        content: m.content,
        createdAt: m.createdAt,
      })),
  ];

  return (
    <div className="flex h-[calc(100vh-6rem)]">
      {/* Users list */}
      <div className="w-56 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-3 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 text-sm">Users</h2>
          <button onClick={loadUsers} className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer" title="Refresh">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loadingUsers ? (
            <div className="p-4 text-center">
              <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" />
            </div>
          ) : error && users.length === 0 ? (
            <div className="p-4 text-center">
              <AlertCircle className="w-5 h-5 text-red-400 mx-auto mb-2" />
              <p className="text-xs text-red-500">{error}</p>
              <button onClick={loadUsers} className="mt-2 text-xs text-blue-600 hover:underline cursor-pointer">Retry</button>
            </div>
          ) : users.length === 0 ? (
            <div className="p-4 text-center text-slate-400 text-xs">No other users</div>
          ) : (
            users.map((u) => (
              <button
                key={u.id}
                onClick={() => setSelectedUser(u)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-slate-50 cursor-pointer ${
                  selectedUser?.id === u.id ? 'bg-blue-50 text-blue-700' : 'text-slate-700'
                }`}
              >
                <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-slate-500" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate">{u.username}</div>
                  <div className="text-xs text-slate-400">{u.role}</div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col bg-slate-50">
        {selectedUser ? (
          <>
            {/* Header */}
            <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <div className="font-semibold text-slate-800 text-sm">{selectedUser.username}</div>
                <div className={`text-xs ${connected ? 'text-green-500' : 'text-slate-400'}`}>
                  {connected ? 'Online' : 'Offline'}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div
              ref={messagesContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-4 space-y-3"
            >
              {loadingHistory ? (
                <div className="text-center py-8">
                  <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full mx-auto" />
                  <p className="text-xs text-slate-400 mt-2">Loading messages...</p>
                </div>
              ) : error && allMessages.length === 0 ? (
                <div className="text-center text-red-400 text-sm mt-8">
                  <AlertCircle className="w-6 h-6 mx-auto mb-2 opacity-60" />
                  <p>{error}</p>
                </div>
              ) : allMessages.length === 0 ? (
                <div className="text-center text-slate-400 text-sm mt-8">No messages yet. Say hello!</div>
              ) : (
                allMessages.map((msg) => {
                  const isMe = msg.senderId === user?.userId;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] px-3.5 py-2 rounded-2xl text-sm ${
                        isMe
                          ? 'bg-blue-600 text-white rounded-br-md'
                          : 'bg-white text-slate-800 border border-slate-200 rounded-bl-md'
                      }`}>
                        <div>{msg.content}</div>
                        <div className={`text-[10px] mt-1 ${isMe ? 'text-blue-200' : 'text-slate-400'}`}>
                          {new Date(msg.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 bg-white border-t border-slate-200">
              {!connected && (
                <div className="text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg mb-2">
                  Not connected to server. Messages cannot be sent.
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Type a message..."
                  disabled={!connected}
                  className="flex-1 px-4 py-2.5 bg-slate-50 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-50"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || !connected}
                  className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-slate-400">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Select a user to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
