import React, { useState, useRef, useEffect } from 'react';
import { hapticFeedback } from '../utils/hapticFeedback';

interface SwipeToReplyProps {
  messageId: string;
  messageContent: string;
  senderName: string;
  onReply: (messageId: string, content: string, senderName: string) => void;
  children: React.ReactNode;
}

export function SwipeToReply({
  messageId,
  messageContent,
  senderName,
  onReply,
  children,
}: SwipeToReplyProps) {
  const [isReplying, setIsReplying] = useState(false);
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    setStartX(e.clientX);
    setCurrentX(e.clientX);
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setCurrentX(e.clientX);
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    
    const deltaX = currentX - startX;
    const threshold = 50;
    
    if (deltaX > threshold) {
      handleReply();
    }
    
    setIsDragging(false);
    setCurrentX(0);
    setStartX(0);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX);
    setCurrentX(e.touches[0].clientX);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    setCurrentX(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    
    const deltaX = currentX - startX;
    const threshold = 50;
    
    if (deltaX > threshold) {
      handleReply();
    }
    
    setIsDragging(false);
    setCurrentX(0);
    setStartX(0);
  };

  const handleReply = () => {
    setIsReplying(true);
    onReply(messageId, messageContent, senderName);
    
    // Add haptic feedback
    hapticFeedback.success();
    
    setTimeout(() => {
      setIsReplying(false);
    }, 1000);
  };

  const translateX = Math.max(0, Math.min(100, currentX - startX));
  const showReplyIcon = translateX > 20;

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="relative transition-transform duration-200 ease-out"
        style={{
          transform: `translateX(${translateX}px)`,
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
      
      {/* Reply Icon */}
      {showReplyIcon && (
        <div className="absolute left-2 top-1/2 transform -translate-y-1/2 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center shadow-lg transition-opacity duration-200">
          <span className="text-white text-sm">↩️</span>
        </div>
      )}
      
      {/* Reply Indicator */}
      {isReplying && (
        <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">
          Replying to {senderName}
        </div>
      )}
    </div>
  );
}
