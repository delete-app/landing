import { Dialog as ArkDialog, Portal } from '@ark-ui/react'
import type { ComponentProps, ReactNode } from 'react'

interface DialogProps extends ComponentProps<typeof ArkDialog.Root> {
  children: ReactNode
}

export function Dialog({ children, ...props }: DialogProps) {
  return <ArkDialog.Root {...props}>{children}</ArkDialog.Root>
}

export function DialogTrigger({ children, ...props }: ComponentProps<typeof ArkDialog.Trigger>) {
  return <ArkDialog.Trigger {...props}>{children}</ArkDialog.Trigger>
}

export function DialogContent({ children, ...props }: ComponentProps<typeof ArkDialog.Content>) {
  return (
    <Portal>
      <ArkDialog.Backdrop className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
      <ArkDialog.Positioner className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <ArkDialog.Content
          className="bg-bg-secondary border border-border rounded-xl p-6 w-full max-w-md shadow-2xl"
          {...props}
        >
          {children}
        </ArkDialog.Content>
      </ArkDialog.Positioner>
    </Portal>
  )
}

export function DialogTitle({ children, ...props }: ComponentProps<typeof ArkDialog.Title>) {
  return (
    <ArkDialog.Title className="text-xl font-medium text-text mb-2" {...props}>
      {children}
    </ArkDialog.Title>
  )
}

export function DialogDescription({
  children,
  ...props
}: ComponentProps<typeof ArkDialog.Description>) {
  return (
    <ArkDialog.Description className="text-sm text-text-muted mb-6" {...props}>
      {children}
    </ArkDialog.Description>
  )
}

export function DialogCloseTrigger({
  children,
  ...props
}: ComponentProps<typeof ArkDialog.CloseTrigger>) {
  return <ArkDialog.CloseTrigger {...props}>{children}</ArkDialog.CloseTrigger>
}
