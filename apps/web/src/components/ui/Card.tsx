import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glass?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  glass = true,
  className = '',
  ...props
}) => {
  return (
    <div
      className={`rounded-2xl border border-zinc-800/80 ${
        glass ? 'bg-zinc-900/60 backdrop-blur-md shadow-xl shadow-black/20' : 'bg-zinc-900'
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

