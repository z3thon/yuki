'use client';

import { useState, useRef, useEffect } from 'react';
import { AppId, View } from '@/types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actions?: Array<{
    type: 'update' | 'create' | 'delete';
    resource: string;
    resourceId?: string;
    description: string;
  }>;
  mentionedViews?: string[]; // View IDs mentioned in this message
}

interface AIChatProps {
  appId: AppId;
  viewId?: string;
  onDataUpdate?: () => void; // Callback to refresh view data
  hideHeader?: boolean; // Hide the header when used in a panel layout
}

interface ViewOption {
  id: string;
  name: string;
  description?: string;
}

export default function AIChat({ appId, viewId, onDataUpdate, hideHeader = false }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [availableViews, setAvailableViews] = useState<ViewOption[]>([]);
  const [showMentionAutocomplete, setShowMentionAutocomplete] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionPosition, setMentionPosition] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getAuthToken = async (): Promise<string | null> => {
    const { getAuth } = await import('firebase/auth');
    const { auth } = await import('@/lib/firebase');
    const user = auth.currentUser;
    if (user) {
      return await user.getIdToken();
    }
    return null;
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch available views for @mention autocomplete
  useEffect(() => {
    const fetchViews = async () => {
      try {
        const token = await getAuthToken();
        if (!token) return;

        const response = await fetch(`/api/admin/views?appId=${appId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setAvailableViews(
            data.views.map((v: View) => ({
              id: v.id,
              name: v.name,
              description: v.description,
            }))
          );
        }
      } catch (error) {
        console.error('Error fetching views:', error);
      }
    };

    fetchViews();
  }, [appId]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const messageContent = input.trim();
    const mentionedViews = extractMentionedViews(messageContent);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageContent,
      timestamp: new Date(),
      mentionedViews,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setShowMentionAutocomplete(false);
    setIsLoading(true);

    try {
      const token = await getAuthToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          appId,
          viewId,
          mentionedViews: mentionedViews,
          conversationHistory: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to get AI response');
      }

      const data = await response.json();
      
      const assistantMentionedViews = extractMentionedViews(data.response);
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        actions: data.actions,
        mentionedViews: assistantMentionedViews.length > 0 ? assistantMentionedViews : undefined,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // If AI performed actions, refresh the view
      if (data.actions && data.actions.length > 0 && onDataUpdate) {
        // Small delay to ensure database updates are complete
        setTimeout(() => {
          onDataUpdate();
        }, 500);
      }
    } catch (error: any) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error: ${error.message || 'Failed to get AI response'}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = '40px';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  // Handle @mention detection
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInput(value);

    // Check for @mention
    const cursorPosition = e.target.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPosition);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setMentionQuery(mentionMatch[1].toLowerCase());
      setMentionPosition(cursorPosition - mentionMatch[1].length - 1);
      setShowMentionAutocomplete(true);
    } else {
      setShowMentionAutocomplete(false);
    }
  };

  // Insert @mention into input
  const insertMention = (view: ViewOption) => {
    if (!inputRef.current) return;

    const beforeMention = input.substring(0, mentionPosition);
    const afterMention = input.substring(mentionPosition + mentionQuery.length + 1);
    const newInput = `${beforeMention}@${view.id}${afterMention}`;

    setInput(newInput);
    setShowMentionAutocomplete(false);

    // Set cursor position after the mention
    setTimeout(() => {
      if (inputRef.current) {
        const newPosition = mentionPosition + view.id.length + 2; // +2 for @ and space
        inputRef.current.setSelectionRange(newPosition, newPosition);
        inputRef.current.focus();
      }
    }, 0);
  };

  // Extract mentioned views from message content
  const extractMentionedViews = (content: string): string[] => {
    const mentions: string[] = [];
    const mentionRegex = /@(\w+)/g;
    let match;
    while ((match = mentionRegex.exec(content)) !== null) {
      const viewId = match[1];
      if (availableViews.some((v) => v.id === viewId)) {
        mentions.push(viewId);
      }
    }
    return [...new Set(mentions)]; // Remove duplicates
  };

  // Render message content with highlighted @mentions
  const renderMessageContent = (content: string, mentionedViews?: string[]) => {
    if (!mentionedViews || mentionedViews.length === 0) {
      return <>{content}</>;
    }

    const parts: (string | JSX.Element)[] = [];
    let lastIndex = 0;
    const mentionRegex = /@(\w+)/g;
    let match;
    let keyCounter = 0;

    while ((match = mentionRegex.exec(content)) !== null) {
      const viewId = match[1];
      const view = availableViews.find((v) => v.id === viewId);

      // Add text before mention
      if (match.index > lastIndex) {
        parts.push(content.substring(lastIndex, match.index));
      }

      // Add highlighted mention
      if (view) {
        parts.push(
          <span
            key={`mention-${keyCounter++}`}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-accent-blue/20 text-accent-blue font-medium"
            title={view.description || view.name}
          >
            @{view.name}
          </span>
        );
      } else {
        parts.push(`@${viewId}`);
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    return <>{parts}</>;
  };

  // Filter views for autocomplete
  const filteredViews = availableViews.filter((view) =>
    view.name.toLowerCase().includes(mentionQuery) ||
    view.id.toLowerCase().includes(mentionQuery)
  );

  return (
    <div className={`flex flex-col h-full ${hideHeader ? '' : 'glass-card'} transition-all duration-300 ${isMinimized ? 'max-h-16' : ''}`}>
      {/* Header */}
      {!hideHeader && (
        <div 
          className="flex items-center justify-between p-4 border-b border-foreground/10 cursor-pointer"
          onClick={() => setIsMinimized(!isMinimized)}
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <h3 className="font-semibold">Yuki</h3>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized(!isMinimized);
            }}
            className="text-foreground/50 hover:text-foreground transition-colors"
          >
            {isMinimized ? '↑' : '↓'}
          </button>
        </div>
      )}

      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
            {messages.length === 0 ? (
              <div className="text-center text-foreground/50 py-8">
                <p className="text-lg font-semibold mb-2">👋 Hi! I'm Yuki</p>
                <p className="text-sm">
                  I can help you update data, answer questions, and manage your {appId} app.
                </p>
                <div className="mt-4 text-xs space-y-1">
                  <p>Try asking:</p>
                  <p className="text-accent-blue">• "Update John's pay rate to $25/hr"</p>
                  <p className="text-accent-blue">• "Show me all employees"</p>
                  <p className="text-accent-blue">• "Create a new employee named..."</p>
                  <p className="text-accent-blue">• "Compare data in @employees and @time-tracking"</p>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                      message.role === 'user'
                        ? 'bg-accent-blue text-white'
                        : 'bg-foreground/5 text-foreground'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">
                      {renderMessageContent(message.content, message.mentionedViews)}
                    </p>
                    {message.actions && message.actions.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-current/20">
                        <p className="text-xs font-semibold mb-1">Actions performed:</p>
                        <ul className="text-xs space-y-1">
                          {message.actions.map((action, idx) => (
                            <li key={idx}>
                              {action.type === 'update' && '✏️'} 
                              {action.type === 'create' && '➕'} 
                              {action.type === 'delete' && '🗑️'} 
                              {' '}
                              {action.description}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <p className="text-xs opacity-70 mt-1">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-foreground/5 rounded-2xl px-4 py-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-foreground/30 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-foreground/30 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-foreground/30 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-foreground/10 relative">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={(e) => {
                    if (showMentionAutocomplete && filteredViews.length > 0) {
                      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') {
                        e.preventDefault();
                        // Handle keyboard navigation for autocomplete
                        return;
                      }
                    }
                    handleKeyDown(e);
                  }}
                  placeholder="Ask me anything... Use @ to mention views"
                  className="w-full px-4 py-2 bg-background/50 rounded-xl border border-foreground/10 focus:outline-none focus:border-accent-blue/50 resize-none"
                  rows={1}
                  style={{ minHeight: '40px', maxHeight: '120px' }}
                  disabled={isLoading}
                />
                {/* @mention autocomplete dropdown */}
                {showMentionAutocomplete && filteredViews.length > 0 && (
                  <div className="absolute bottom-full left-0 right-0 mb-2 glass-card max-h-48 overflow-y-auto z-10">
                    <div className="p-2">
                      <div className="text-xs text-foreground/50 mb-1 px-2">Mention a view:</div>
                      {filteredViews.slice(0, 5).map((view) => (
                        <button
                          key={view.id}
                          onClick={() => insertMention(view)}
                          className="w-full text-left px-3 py-2 rounded-lg hover:bg-accent-blue/10 transition-colors"
                        >
                          <div className="font-medium text-sm">{view.name}</div>
                          {view.description && (
                            <div className="text-xs text-foreground/50">{view.description}</div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="px-4 py-2 bg-accent-blue text-white rounded-xl hover:bg-accent-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
