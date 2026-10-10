import React from "react";
import { cn } from "@/lib/utils";

// The Receipt Studio mark: a receipt with a torn edge and a spark for design.
// Same drawing as public/favicon.svg and public/logo.svg.
export const LogoMark: React.FC<{ className?: string }> = ({ className }) => {
  const id = React.useId();
  return (
    <svg viewBox="0 0 64 64" className={cn("size-8 shrink-0", className)} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366F1" />
          <stop offset="1" stopColor="#3730A3" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill={`url(#${id})`} />
      <path d="M18 12H46a2 2 0 0 1 2 2V52L44 49L40 52L36 49L32 52L28 49L24 52L20 49L16 52V14a2 2 0 0 1 2-2Z" fill="#FFFFFF" />
      <rect x="21" y="19" width="16" height="3.5" rx="1.75" fill="#3730A3" />
      <rect x="21" y="26" width="22" height="2.5" rx="1.25" fill="#C7D2FE" />
      <rect x="21" y="31.5" width="22" height="2.5" rx="1.25" fill="#C7D2FE" />
      <rect x="21" y="40" width="9" height="3.5" rx="1.75" fill="#3730A3" />
      <rect x="34" y="40" width="9" height="3.5" rx="1.75" fill="#F59E0B" />
      <path d="M48 5L50.4 11.6L57 14L50.4 16.4L48 23L45.6 16.4L39 14L45.6 11.6Z" fill="#FBBF24" stroke="#3730A3" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
};

// Mark + name, e.g. in page headers
export const Logo: React.FC<{ className?: string; markClassName?: string }> = ({ className, markClassName }) => (
  <span className={cn("inline-flex items-center gap-2 text-lg font-bold tracking-tight text-gray-900", className)}>
    <LogoMark className={markClassName} />
    <span>
      Receipt <span className="text-indigo-700">Studio</span>
    </span>
  </span>
);
