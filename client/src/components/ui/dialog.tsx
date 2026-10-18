"use client";
import * as React from "react";
import * as Primitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
export const Dialog = Primitive.Root;
export const DialogTitle = Primitive.Title;
export const DialogDescription = Primitive.Description;
export const DialogClose = Primitive.Close;
export function DialogContent({
  children,
  className,
  closeDisabled = false,
  ...props
}: React.ComponentProps<typeof Primitive.Content> & {
  closeDisabled?: boolean;
}) {
  return (
    <Primitive.Portal>
      <Primitive.Overlay className="fixed inset-0 z-50 bg-black/20 data-[state=open]:animate-in" />
      <Primitive.Content
        className={cn(
          "dialog-content fixed top-1/2 left-1/2 z-50 max-h-[90dvh] w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 text-zinc-900 shadow-xl focus:outline-none",
          className,
        )}
        {...props}
      >
        {children}
        <Primitive.Close
          disabled={closeDisabled}
          className="absolute top-4 right-4 grid size-8 place-items-center rounded-full border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-red-400"
          aria-label="Close dialog"
        >
          <X size={16} />
        </Primitive.Close>
      </Primitive.Content>
    </Primitive.Portal>
  );
}
