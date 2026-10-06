import { cn } from "@/lib/cn";
import { forwardRef } from "react";

export function Button({
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  const styles = {
    primary:
      "bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed",
    secondary:
      "bg-zinc-800 text-zinc-100 border border-zinc-700 hover:bg-zinc-700 disabled:opacity-50",
    ghost: "text-zinc-300 hover:bg-zinc-800 disabled:opacity-50",
    danger:
      "bg-red-600/20 text-red-300 border border-red-800 hover:bg-red-600/30 disabled:opacity-50",
  } as const;
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
        styles[variant],
        className
      )}
      {...props}
    />
  );
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-zinc-800 bg-zinc-900/60 p-5",
        className
      )}
    >
      {children}
    </div>
  );
}

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none",
        className
      )}
      {...props}
    />
  );
});

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none",
        className
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none",
        className
      )}
      {...props}
    />
  );
}

export function Pill({
  className,
  color = "zinc",
  children,
}: {
  className?: string;
  color?: "zinc" | "green" | "indigo" | "amber" | "red";
  children: React.ReactNode;
}) {
  const colors = {
    zinc: "bg-zinc-800 text-zinc-300 border-zinc-700",
    green: "bg-emerald-500/15 text-emerald-300 border-emerald-800",
    indigo: "bg-indigo-500/15 text-indigo-300 border-indigo-800",
    amber: "bg-amber-500/15 text-amber-300 border-amber-800",
    red: "bg-red-500/15 text-red-300 border-red-800",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        colors[color],
        className
      )}
    >
      {children}
    </span>
  );
}

export function ProgressBar({
  value,
  className,
}: {
  value: number; // 0-1
  className?: string;
}) {
  return (
    <div className={cn("h-2 w-full rounded-full bg-zinc-800", className)}>
      <div
        className="h-2 rounded-full bg-indigo-500 transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
      />
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-500 border-t-indigo-400",
        className
      )}
    />
  );
}
