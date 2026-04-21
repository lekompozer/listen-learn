import { createContext } from 'react';
import type { ReactNode } from 'react';

/**
 * Stub for HomeSidebarCollapsedCtx — in the standalone app there is no
 * HomeShell sidebar, so this context always returns `true` (sidebar collapsed).
 */
export const HomeSidebarCollapsedCtx = createContext<boolean>(true);

/**
 * Passthrough HomeShell stub — renders children directly with no navigation shell.
 * Used so web components copied from wordai (which import HomeShell) work unchanged.
 */
export default function HomeShell({ children, activePage }: { children: ReactNode; activePage?: string }) {
    return children as React.ReactElement;
}
