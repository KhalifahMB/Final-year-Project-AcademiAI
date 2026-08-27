import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

/**
 * Reusable confirmation dialog — replaces all window.confirm() calls.
 *
 * Props:
 *   open         {boolean}    - controlled visibility
 *   title        {string}     - dialog title
 *   description  {string}     - explanation text shown to the user
 *   onConfirm    {function}   - called when user confirms
 *   onCancel     {function}   - called when user cancels
 *   confirmLabel {string}     - label for the confirm button (default: "Confirm")
 *   cancelLabel  {string}     - label for the cancel button (default: "Cancel")
 *   destructive  {boolean}    - renders confirm button in red (default: false)
 *   pending      {boolean}    - disables both buttons while loading (default: false)
 */
export default function ConfirmDialog({
  open,
  title,
  description,
  onConfirm,
  onCancel,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  pending = false,
  // variant prop (alias for destructive) for convenience
  variant,
  // icon prop accepted but intentionally unused (keeps callers consistent)
  icon: _icon,
}) {
  const isDestructive = destructive || variant === "destructive";

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} disabled={pending}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={pending}
            className={cn(
              isDestructive &&
                "bg-destructive text-destructive-foreground hover:bg-destructive/90"
            )}
          >
            {pending ? "Working…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
