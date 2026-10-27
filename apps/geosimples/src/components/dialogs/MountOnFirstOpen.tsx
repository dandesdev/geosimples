import { Suspense, useState, type ReactNode } from "react";

/**
 * Mounts a lazy dialog the first time it opens and keeps it mounted afterwards,
 * so its close animation and focus return still work.
 */
export function MountOnFirstOpen({ open, children }: { open: boolean; children: ReactNode }) {
  const [opened, setOpened] = useState(open);
  if (open && !opened) setOpened(true);
  return opened ? <Suspense fallback={null}>{children}</Suspense> : null;
}
