import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2, X } from "lucide-react";
import { cn } from "../lib/utils";

/**
 * Header Component for ExpandableContainer
 */
const ExpandableHeader = ({ 
  title, 
  subtitle, 
  Icon, 
  headerClassName, 
  headerActions, 
  isExpanded, 
  onToggle, 
  onClose 
}) => (
  <div className={cn(
    "flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-slate-50 to-slate-100",
    headerClassName
  )}>
    <div className="flex items-center gap-3">
      {Icon && (
        <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center">
          <Icon className="w-5 h-5 text-purple-600" />
        </div>
      )}
      <div>
        <h3 className="font-semibold text-slate-900">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
    </div>
    <div className="flex items-center gap-2">
      {headerActions}
      <button
        onClick={onToggle}
        className="p-2 hover:bg-white rounded-lg transition-colors text-slate-500 hover:text-slate-700"
        title={isExpanded ? "Exit fullscreen (Esc)" : "Expand to fullscreen"}
        data-testid="expand-toggle-btn"
      >
        {isExpanded ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
      </button>
      {isExpanded && (
        <button
          onClick={onClose}
          className="p-2 hover:bg-red-50 rounded-lg transition-colors text-slate-500 hover:text-red-600"
          title="Close"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  </div>
);

/**
 * ExpandableContainer - Wraps any content with expand-to-fullscreen capability
 * 
 * Usage:
 * <ExpandableContainer title="Account Form Builder">
 *   <YourContent />
 * </ExpandableContainer>
 */
const ExpandableContainer = ({ 
  children, 
  title, 
  subtitle,
  className,
  headerClassName,
  expandedClassName,
  showHeader = true,
  defaultExpanded = false,
  onExpandChange,
  headerActions,
  icon: Icon,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  useEffect(() => {
    if (isExpanded) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isExpanded]);

  const toggleExpand = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    onExpandChange?.(newState);
  };

  const handleClose = () => {
    setIsExpanded(false);
    onExpandChange?.(false);
  };

  // Handle escape key to close
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isExpanded) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isExpanded, handleClose]);

  // Normal (non-expanded) view
  const NormalView = (
    <div className={cn("bg-white rounded-xl border shadow-sm overflow-hidden", className)}>
      {showHeader && (
        <ExpandableHeader
          title={title}
          subtitle={subtitle}
          Icon={Icon}
          headerClassName={headerClassName}
          headerActions={headerActions}
          isExpanded={false}
          onToggle={toggleExpand}
          onClose={handleClose}
        />
      )}
      <div className="overflow-auto">
        {children}
      </div>
    </div>
  );

  // Expanded (fullscreen) view - rendered via portal
  const ExpandedView = createPortal(
    <div 
      className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      data-testid="expanded-overlay"
    >
      <div className={cn(
        "absolute inset-4 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200",
        expandedClassName
      )}>
        {showHeader && (
          <ExpandableHeader
            title={title}
            subtitle={subtitle}
            Icon={Icon}
            headerClassName={headerClassName}
            headerActions={headerActions}
            isExpanded={true}
            onToggle={toggleExpand}
            onClose={handleClose}
          />
        )}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );

  return (
    <>
      {!isExpanded && NormalView}
      {isExpanded && ExpandedView}
    </>
  );
};

export default ExpandableContainer;
