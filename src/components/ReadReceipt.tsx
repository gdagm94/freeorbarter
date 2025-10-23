import React from 'react';
import { Check, CheckCheck, Clock } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface ReadReceiptProps {
  message: {
    read: boolean;
    read_at: string | null;
    created_at: string;
    sender_id: string;
  };
  currentUserId: string;
}

export function ReadReceipt({ message, currentUserId }: ReadReceiptProps) {
  // Only show read receipts for messages sent by current user
  if (message.sender_id !== currentUserId) {
    return null;
  }

  const getReadStatus = () => {
    if (message.read && message.read_at) {
      return {
        icon: <CheckCheck className="w-3 h-3 text-blue-500" />,
        tooltip: `Read ${formatDistanceToNow(new Date(message.read_at), { addSuffix: true })}`
      };
    } else if (message.read) {
      return {
        icon: <CheckCheck className="w-3 h-3 text-gray-400" />,
        tooltip: 'Read'
      };
    } else {
      return {
        icon: <Check className="w-3 h-3 text-gray-400" />,
        tooltip: 'Delivered'
      };
    }
  };

  const readStatus = getReadStatus();

  return (
    <div className="flex items-center gap-1">
      <div 
        className="flex items-center"
        title={readStatus.tooltip}
      >
        {readStatus.icon}
      </div>
      {message.read && message.read_at && (
        <span className="text-xs text-gray-500">
          {format(new Date(message.read_at), 'h:mm a')}
        </span>
      )}
    </div>
  );
}
