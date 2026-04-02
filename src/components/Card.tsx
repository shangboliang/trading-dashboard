import { ReactNode } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
}

export function Card({ children, className, title }: CardProps) {
  return (
    <div className={cn("bg-panel border border-border rounded-lg p-5 shadow-sm", className)}>
      {title && <h3 className="text-textMuted text-sm font-medium mb-4 uppercase tracking-wider">{title}</h3>}
      {children}
    </div>
  );
}
