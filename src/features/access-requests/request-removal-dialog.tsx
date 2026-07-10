import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import type { RequestResource } from '@/lib/api/types'
import { ApiError } from '@/lib/api/unwrap'
import { useFileRequest } from '@/lib/queries/access-requests'

interface Props {
  resource: RequestResource
  targetId: string | null
  /** A human label for what's being removed (e.g. the staff name / room number). */
  targetLabel: string
  onClose: () => void
}

/** Files a removal request for a platform admin to approve. Rendered when a
 * manager clicks "Request removal"; open when `targetId` is set. */
export function RequestRemovalDialog({
  resource,
  targetId,
  targetLabel,
  onClose,
}: Props) {
  const [note, setNote] = useState('')
  const fileRequest = useFileRequest()

  function submit() {
    if (!targetId) return
    fileRequest.mutate(
      {
        resource,
        kind: 'remove',
        target_id: targetId,
        note: note.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success('Removal request submitted for approval')
          setNote('')
          onClose()
        },
        onError: (e) =>
          toast.error(e instanceof ApiError ? e.message : 'Something went wrong'),
      },
    )
  }

  return (
    <Dialog
      open={targetId !== null}
      onOpenChange={(open) => {
        if (!open) {
          setNote('')
          onClose()
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request removal</DialogTitle>
          <DialogDescription>
            Ask a platform admin to remove {targetLabel}. This doesn't remove it
            yet — an admin approves the request first.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder="Reason (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={fileRequest.isPending}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={fileRequest.isPending}>
            {fileRequest.isPending ? 'Submitting…' : 'Submit request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
