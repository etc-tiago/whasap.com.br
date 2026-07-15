import * as React from "react";

import { cn } from "#lib/utils";

/**
 * Layout master-detail composável (estilo shadcn).
 *
 * - Em `md+`: sidebar e main visíveis lado a lado.
 * - No mobile: só o painel indicado por `activePane` (`"sidebar"` | `"main"`).
 *
 * @example
 * ```tsx
 * <Panel activePane={aberto ? "main" : "sidebar"}>
 *   <PanelSidebar>
 *     <PanelSidebarHeader>
 *       <PanelSidebarTitle>Título</PanelSidebarTitle>
 *       <PanelSidebarActions>
 *         <Button size="sm">Nova</Button>
 *       </PanelSidebarActions>
 *     </PanelSidebarHeader>
 *     <PanelSidebarContent>{lista}</PanelSidebarContent>
 *   </PanelSidebar>
 *   <PanelMain>{detalhe}</PanelMain>
 * </Panel>
 * ```
 *
 * Tokens de produto (`bg-wa-panel`, etc.) via `className` nos consumers —
 * defaults usam tokens shadcn genéricos.
 */

export type PanelActivePane = "sidebar" | "main";

type PanelContextValue = {
  activePane: PanelActivePane;
};

const PanelContext = React.createContext<PanelContextValue | null>(null);

function usePanel() {
  const ctx = React.useContext(PanelContext);
  if (!ctx) {
    throw new Error("Panel compound components must be used within <Panel>.");
  }
  return ctx;
}

type PanelProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Painel visível no mobile. Em `md+` ambos ficam visíveis. Default: `"sidebar"`. */
  activePane?: PanelActivePane;
};

const Panel = React.forwardRef<HTMLDivElement, PanelProps>(
  ({ className, activePane = "sidebar", children, ...props }, ref) => (
    <PanelContext.Provider value={{ activePane }}>
      <div
        ref={ref}
        data-slot="panel"
        data-active-pane={activePane}
        className={cn("flex h-full min-h-0 overflow-hidden", className)}
        {...props}
      >
        {children}
      </div>
    </PanelContext.Provider>
  ),
);
Panel.displayName = "Panel";

const PanelSidebar = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => {
    const { activePane } = usePanel();
    return (
      <aside
        ref={ref}
        data-slot="panel-sidebar"
        className={cn(
          "flex w-full shrink-0 flex-col border-r border-border bg-background md:w-80",
          activePane === "main" ? "hidden md:flex" : "flex",
          className,
        )}
        {...props}
      />
    );
  },
);
PanelSidebar.displayName = "PanelSidebar";

const PanelSidebarHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="panel-sidebar-header"
      className={cn("flex shrink-0 items-center justify-between gap-3 px-5 pb-2 pt-4", className)}
      {...props}
    />
  ),
);
PanelSidebarHeader.displayName = "PanelSidebarHeader";

const PanelSidebarTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h2
    ref={ref}
    data-slot="panel-sidebar-title"
    className={cn("text-2xl font-semibold leading-none tracking-tight text-foreground", className)}
    {...props}
  />
));
PanelSidebarTitle.displayName = "PanelSidebarTitle";

const PanelSidebarActions = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="panel-sidebar-actions"
      className={cn("flex shrink-0 items-center gap-1", className)}
      {...props}
    />
  ),
);
PanelSidebarActions.displayName = "PanelSidebarActions";

const PanelSidebarContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="panel-sidebar-content"
      className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto", className)}
      {...props}
    />
  ),
);
PanelSidebarContent.displayName = "PanelSidebarContent";

const PanelMain = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, ...props }, ref) => {
    const { activePane } = usePanel();
    return (
      <section
        ref={ref}
        data-slot="panel-main"
        className={cn(
          "min-w-0 flex-1 flex-col bg-background",
          activePane === "sidebar" ? "hidden md:flex" : "flex",
          className,
        )}
        {...props}
      />
    );
  },
);
PanelMain.displayName = "PanelMain";

export {
  Panel,
  PanelSidebar,
  PanelSidebarHeader,
  PanelSidebarTitle,
  PanelSidebarActions,
  PanelSidebarContent,
  PanelMain,
  usePanel,
};
