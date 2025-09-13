import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface PortalTooltipProps {
  content: string;
  children: React.ReactNode;
  className?: string;
}

export const PortalTooltip: React.FC<PortalTooltipProps> = ({ content, children, className = '' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const tooltipHeight = tooltipRef.current?.offsetHeight || 0;

      // Position above the element with some margin
      setPosition({
        top: rect.top - tooltipHeight - 8,
        left: rect.left
      });
    }
  }, [isVisible]);

  const tooltipContent = isVisible && createPortal(
    <div
      ref={tooltipRef}
      className={`fixed z-[99999] bg-slate-800 border border-slate-600 rounded-lg p-3 max-w-md shadow-2xl ${className}`}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        pointerEvents: 'none'
      }}
    >
      <div className="font-mono text-xs break-words">{content}</div>
      <div className="absolute top-full left-4 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-slate-800"></div>
    </div>,
    document.body
  );

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        className="cursor-help"
      >
        {children}
      </div>
      {tooltipContent}
    </>
  );
};