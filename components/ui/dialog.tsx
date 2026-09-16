"use client"

import * as React from "react"
import { XIcon } from "lucide-react"
import { Dialog as DialogPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "meridian-dialog-overlay fixed inset-0 z-50 bg-black/50",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  header,
  showCloseButton = true,
  ref: forwardedRef,
  onOpenAutoFocus,
  onAnimationStart,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
  header?: React.ReactNode
}) {
  const contentRef = React.useRef<HTMLDivElement>(null)
  const bodyRef = React.useRef<HTMLDivElement>(null)
  const bodyChildren = React.Children.toArray(children)
  const headingChildren: React.ReactNode[] = []
  // Existing callers can keep their leading Header or Title + Description children.
  // Use the header prop when a custom component or fragment owns the heading.
  if (header === undefined) {
    while (bodyChildren.length) {
      const child = bodyChildren[0]
      if (!React.isValidElement(child) || ![DialogHeader, DialogTitle, DialogDescription].some(type => child.type === type)) break
      headingChildren.push(bodyChildren.shift())
    }
  }
  const heading = header === undefined ? headingChildren : header
  const hasHeading = header === undefined ? headingChildren.length > 0 : header !== null && header !== false
  const setContentRef = React.useCallback((node: HTMLDivElement | null) => {
    contentRef.current = node
    if (typeof forwardedRef === "function") return forwardedRef(node)
    if (forwardedRef) forwardedRef.current = node
  }, [forwardedRef])

  const resetOpenPosition = () => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0
    if (contentRef.current) {
      contentRef.current.scrollTop = 0
      contentRef.current.focus({ preventScroll: true })
    }
  }

  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        {...props}
        ref={setContentRef}
        data-slot="dialog-content"
        data-has-close={showCloseButton}
        tabIndex={-1}
        className={cn(
          "meridian-dialog-content fixed top-[50%] left-[50%] z-50 w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] rounded-lg border bg-background shadow-lg outline-none sm:max-w-lg",
          className
        )}
        onOpenAutoFocus={(event) => {
          onOpenAutoFocus?.(event)
          if (!event.defaultPrevented) {
            event.preventDefault()
            resetOpenPosition()
          }
        }}
        onAnimationStart={(event) => {
          onAnimationStart?.(event)
          // Presence can retain this node when a closing dialog is reopened quickly.
          if (event.target === event.currentTarget && event.animationName === "meridian-dialog-in") {
            resetOpenPosition()
          }
        }}
      >
        {(hasHeading || showCloseButton) && (
          <div className="meridian-dialog-fixed-header" data-slot="dialog-fixed-header" data-has-heading={hasHeading}>
            {heading}
          </div>
        )}
        <div ref={bodyRef} className="meridian-dialog-body" data-slot="dialog-body">
          {bodyChildren}
        </div>
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="meridian-dialog-close"
            aria-label="Закрыть"
          >
            <XIcon aria-hidden="true" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Закрыть</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
