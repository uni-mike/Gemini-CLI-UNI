import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  content: string;
  children: React.ReactNode;
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children, className = '' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;
    
    setPosition({
      top: rect.top + scrollY - 10,
      left: rect.left + scrollX + rect.width / 2
    });
  };

  useEffect(() => {
    if (isVisible) {
      updatePosition();
    }
  }, [isVisible]);

  return (
    <div 
      ref={containerRef}
      className={`relative ${className}`}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && createPortal(
        <div 
          className="fixed z-[9999] px-3 py-2 text-sm text-white bg-slate-800 border border-slate-700 rounded-lg shadow-lg max-w-xs break-words whitespace-pre-wrap transform -translate-x-1/2 -translate-y-full"
          style={{
            top: position.top,
            left: position.left,
          }}
        >
          {content}
        </div>,
        document.body
      )}
    </div>
  );
};