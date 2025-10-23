import React, { useEffect, useRef } from 'react';
import { Smile, Reply, Copy, Trash2 } from 'lucide-react';

interface MessageContextMenuProps {
  visible: boolean;
  x: number;
  y: number;
  onClose: () => void;
  onReact: () => void;
  onReply: () => void;
  onCopy?: () => void;
  onDelete?: () => void;
  isOwnMessage?: boolean;
}

export function MessageContextMenu({
  visible,
  x,
  y,
  onClose,
  onReact,
  onReply,
  onCopy,
  onDelete,
  isOwnMessage = false,
}: MessageContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (visible) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [visible, onClose]);

  if (!visible) return null;

  // Adjust position to keep menu within viewport
  const adjustedX = Math.min(x, window.innerWidth - 200);
  const adjustedY = Math.min(y, window.innerHeight - 200);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[160px]"
      style={{
        left: adjustedX,
        top: adjustedY,
      }}
    >
      <button
        onClick={() => {
          onReact();
          onClose();
        }}
        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
      >
        <Smile className="w-4 h-4" />
        <span>React</span>
      </button>
      
      <button
        onClick={() => {
          onReply();
          onClose();
        }}
        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
      >
        <Reply className="w-4 h-4" />
        <span>Reply</span>
      </button>
      
      {onCopy && (
        <button
          onClick={() => {
            onCopy();
            onClose();
          }}
          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
        >
          <Copy className="w-4 h-4" />
          <span>Copy</span>
        </button>
      )}
      
      {isOwnMessage && onDelete && (
        <button
          onClick={() => {
            onDelete();
            onClose();
          }}
          className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
        >
          <Trash2 className="w-4 h-4" />
          <span>Delete</span>
        </button>
      )}
    </div>
  );
}
