"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface HeaderProps {
  title: string;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: React.ReactNode;
}

export function Header({ title, breadcrumbs, actions }: HeaderProps) {
  return (
    <header className="bg-white border-b border-[#e4e4e7] px-8 py-5">
      <div className="flex items-center justify-between">
        <div>
          {breadcrumbs && breadcrumbs.length > 0 && (
            <div className="flex items-center gap-1 text-[13px] text-[#6e6e80] mb-1">
              {breadcrumbs.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="w-3 h-3 text-[#c0c0c8]" />}
                  {crumb.href ? (
                    <Link
                      href={crumb.href}
                      className="hover:text-[#0a0a0a] transition-colors"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-[#0a0a0a] font-medium">{crumb.label}</span>
                  )}
                </span>
              ))}
            </div>
          )}
          <h1 className="text-[22px] font-semibold text-[#0a0a0a] tracking-[-0.02em]">
            {title}
          </h1>
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </header>
  );
}
