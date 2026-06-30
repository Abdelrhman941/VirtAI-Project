import React, { ReactNode } from 'react';

// Common wrapper for state displays
interface StateWrapperProps {
  children: ReactNode;
  className?: string;
  isAbsolute?: boolean;
}

export function StateWrapper({ children, className = '', isAbsolute = false }: StateWrapperProps) {
  const baseClasses = isAbsolute 
    ? "absolute inset-0 flex flex-col items-center justify-center bg-dark z-10"
    : "flex-1 flex flex-col items-center justify-center w-full h-full p-4 sm:p-8 overflow-y-auto";
    
  return (
    <div className={`${baseClasses} ${className}`}>
      {children}
    </div>
  );
}

// 1. Loading State
interface LoadingStateProps {
  message?: string;
  isAbsolute?: boolean;
  className?: string;
}

export function LoadingState({ 
  message = "Loading...", 
  isAbsolute = true,
  className = "animate-fade-in text-center" 
}: LoadingStateProps) {
  return (
    <StateWrapper isAbsolute={isAbsolute} className={className}>
      <div className="w-8 h-8 border-2 border-gold/20 border-t-gold rounded-full animate-spin mb-4" />
      <p className="text-gold-soft/80 text-sm font-medium">{message}</p>
    </StateWrapper>
  );
}

// 2. Error State
interface ErrorStateProps {
  title?: string;
  message: string;
  details?: string;
  action?: ReactNode;
  isAbsolute?: boolean;
  className?: string;
}

export function ErrorState({ 
  title = "An Error Occurred", 
  message, 
  details, 
  action,
  isAbsolute = true,
  className = "text-center p-6" 
}: ErrorStateProps) {
  return (
    <StateWrapper isAbsolute={isAbsolute} className={className}>
      <p className="text-crimson-glow font-medium mb-2">{title}</p>
      <p className="text-offwhite/70 text-sm max-w-md mb-4">{message}</p>
      {details && <p className="text-offwhite/40 text-xs mt-2 font-mono break-all mb-4">{details}</p>}
      {action && (
        <div className="mt-2">
          {action}
        </div>
      )}
    </StateWrapper>
  );
}

// 3. Empty State
interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  isAbsolute?: boolean;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  isAbsolute = false,
  className = "text-center"
}: EmptyStateProps) {
  return (
    <StateWrapper isAbsolute={isAbsolute} className={className}>
      {icon && (
        <div className="w-16 h-16 rounded-full bg-dark-secondary/50 flex items-center justify-center mb-6 shadow-sm border border-white/5">
          {icon}
        </div>
      )}
      <h3 className="text-xl font-bold text-white/90 mb-2 font-display tracking-tight">{title}</h3>
      <p className="text-offwhite/60 text-sm max-w-md mx-auto leading-relaxed mb-6 font-sans">
        {description}
      </p>
      {action && (
        <div className="mt-2">
          {action}
        </div>
      )}
    </StateWrapper>
  );
}
