import React, { useState, useRef, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { Send } from 'lucide-react';

export interface ChatMessage {
  userName: string;
  message: string;
  timestamp: number;
}

interface ChatPanelProps {
  socket: Socket | null;
  userName: string;
  isOpen: boolean;
  onUnreadCountChange: (count: number) => void;
}

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const ChatPanel: React.FC<ChatPanelProps> = ({ socket, userName, isOpen, onUnreadCountChange }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const unreadCountRef = useRef(0);
  const isOpenRef = useRef(isOpen);

  // Keep isOpenRef in sync so the socket handler always has the current value
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  // Reset unread count when panel becomes visible
  useEffect(() => {
    if (isOpen) {
      unreadCountRef.current = 0;
      onUnreadCountChange(0);
    }
  }, [isOpen, onUnreadCountChange]);

  // Listen for chat-message and chat-history events from the server
  useEffect(() => {
    if (!socket) return;

    const handleChatMessage = (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
      if (!isOpenRef.current) {
        unreadCountRef.current += 1;
        onUnreadCountChange(unreadCountRef.current);
      }
    };

    const handleChatHistory = (history: ChatMessage[]) => {
      setMessages(history);
    };

    socket.on('chat-message', handleChatMessage);
    socket.on('chat-history', handleChatHistory);

    return () => {
      socket.off('chat-message', handleChatMessage);
      socket.off('chat-history', handleChatHistory);
    };
  }, [socket]);

  // Auto-scroll to the latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    if (!socket) return;
    socket.emit('chat-message', { message: inputValue.trim() });
    setInputValue('');
  };

  if (!isOpen) return null;

  return (
    <div className="chat-panel">
      <div className="chat-panel-header">
        <span className="chat-panel-title">Chat</span>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">No messages yet</div>
        )}
        {messages.map((msg, index) => {
          const isOwn = msg.userName === userName;
          return (
            <div
              key={`${msg.timestamp}-${index}`}
              className={`chat-message ${isOwn ? 'chat-message-own' : 'chat-message-other'}`}
            >
              {!isOwn && (
                <div className="chat-message-name">{msg.userName}</div>
              )}
              <div className={`chat-bubble ${isOwn ? 'chat-bubble-own' : 'chat-bubble-other'}`}>
                <div className="chat-bubble-text">{msg.message}</div>
                <div className="chat-bubble-time">{formatTime(msg.timestamp)}</div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-form" onSubmit={handleSubmit}>
        <input
          type="text"
          className="chat-input"
          placeholder="Type a message..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
        />
        <button type="submit" className="chat-send-btn" disabled={!inputValue.trim()}>
          <Send size={18} />
        </button>
      </form>
    </div>
  );
};

export default ChatPanel;
