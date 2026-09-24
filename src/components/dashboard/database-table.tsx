"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Shared table primitives for the Database page (plain HTML, project border/muted tokens). */

export function DataTable({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full text-sm border-collapse", className)} {...props} />
    </div>
  );
}

export function DataTh({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "border-b border-border bg-muted/30 px-3 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap",
        className
      )}
      {...props}
    />
  );
}

export function DataTd({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td className={cn("border-b border-border/60 px-3 py-2 align-top", className)} {...props} />
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-8 text-center text-sm text-muted-foreground">
        {children}
      </td>
    </tr>
  );
}
