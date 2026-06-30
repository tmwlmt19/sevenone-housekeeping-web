import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface RouteModalProps {
  title: string
  description?: string
  /** Path to return to when the modal closes (the underlying list route). */
  backTo: string
  children: ReactNode
}

/**
 * A dialog driven by the route: it's always open while its route is matched, and
 * closing it navigates back to the list. This keeps `/…/new` and `/…/:id`
 * deep-linkable while rendering as an overlay over the list (PLAN.md §1).
 */
export function RouteModal({
  title,
  description,
  backTo,
  children,
}: RouteModalProps) {
  const navigate = useNavigate()
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) navigate(backTo)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}
