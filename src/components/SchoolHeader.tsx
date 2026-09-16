import logo from "@/assets/logo-sekolah.png";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export const SCHOOL_NAME = "SMK Harapan Bangsa Quiz";

export function SchoolMark({ size = 40 }: { size?: number }) {
  return (
    <img
      src={logo}
      alt="Logo SMK Harapan Bangsa"
      width={size}
      height={size}
      className="rounded-md"
      style={{ width: size, height: size }}
    />
  );
}

export function SchoolHeader({ actions }: { actions?: ReactNode }) {
  return (
    <header className="bg-school-gradient text-primary-foreground">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link to="/" className="flex items-center gap-3">
          <span className="rounded-xl bg-primary-foreground/10 p-1.5">
            <SchoolMark size={38} />
          </span>
          <span className="leading-tight">
            <span className="block font-display text-lg font-semibold">{SCHOOL_NAME}</span>
            <span className="block text-xs text-primary-foreground/70">
              Platform ujian & latihan digital
            </span>
          </span>
        </Link>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
    </header>
  );
}
