
import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage } from '../types';
import { LoadingSpinner } from './LoadingSpinner';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  initialPrompt?: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, onSendMessage, isLoading, initialPrompt }) => {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  
  useEffect(() => {
    if(initialPrompt){
        setInput(initialPrompt);
    }
  }, [initialPrompt]);

  const handleSend = () => {
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg flex flex-col h-full max-h-[calc(100vh-12rem)]">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800">Chat with ShopSmarter AI</h2>
      </div>
      <div className="flex-grow p-4 space-y-4 overflow-y-auto">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-xs lg:max-w-md px-4 py-2 rounded-xl shadow ${
                msg.sender === 'user'
                  ? 'bg-indigo-500 text-white'
                  : 'bg-gray-200 text-gray-800'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
              <p className="text-xs mt-1 opacity-75 text-right">{new Date(msg.timestamp).toLocaleTimeString()}</p>
            </div>
          </div>
        ))}
        {isLoading && messages.length > 0 && messages[messages.length -1].sender === 'user' && (
           <div className="flex justify-start">
             <div className="max-w-xs lg:max-w-md px-4 py-2 rounded-xl shadow bg-gray-200 text-gray-800">
                <LoadingSpinner size="sm" />
             </div>
           </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask for modifications or other products..."
            className="flex-grow p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition duration-150"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-5 rounded-lg transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="fas fa-paper-plane"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
