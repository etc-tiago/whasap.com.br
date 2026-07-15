# Panel

Layout master-detail composável (estilo shadcn): coluna esquerda com header (título + ações) e área de conteúdo, mais uma área principal livre.

Não confundir com `Sidebar*` (navegação collapsible do shadcn).

## Import

```tsx
import {
  Panel,
  PanelSidebar,
  PanelSidebarHeader,
  PanelSidebarTitle,
  PanelSidebarActions,
  PanelSidebarContent,
  PanelMain,
} from "@whasap/ui/components/panel";
```

## Anatomia

```
Panel
├── PanelSidebar
│   ├── PanelSidebarHeader
│   │   ├── PanelSidebarTitle
│   │   └── PanelSidebarActions
│   └── PanelSidebarContent   ← busca, filtros, lista, etc.
└── PanelMain                 ← detalhe / formulário / chat
```

## Uso mínimo

```tsx
<Panel activePane={selecionado ? "main" : "sidebar"}>
  <PanelSidebar>
    <PanelSidebarHeader>
      <PanelSidebarTitle>Respostas rápidas</PanelSidebarTitle>
      <PanelSidebarActions>
        <Button size="sm">Nova</Button>
      </PanelSidebarActions>
    </PanelSidebarHeader>
    <PanelSidebarContent>{lista}</PanelSidebarContent>
  </PanelSidebar>
  <PanelMain>{selecionado ? editor : empty}</PanelMain>
</Panel>
```

## Mobile (`activePane`)

| Valor | Mobile | `md+` |
|-------|--------|-------|
| `"sidebar"` (default) | só sidebar | ambos |
| `"main"` | só main | ambos |

Espelha o padrão da caixa de entrada (lista ↔ conversa). O container pai deve ter altura definida (`h-full min-h-0`).

## Tokens de produto

Defaults usam tokens genéricos do shadcn (`bg-background`, `border-border`, `text-foreground`).

No painel Whasap, passe tokens `wa-*` via `className`:

```tsx
<PanelSidebar className="border-wa-divider bg-wa-panel md:w-80 xl:w-96">
  <PanelSidebarTitle className="text-wa-text">Whasap</PanelSidebarTitle>
  …
</PanelSidebar>
<PanelMain className="wa-wallpaper">…</PanelMain>
```

## Header vs Content

O header contém **apenas** título e ações. Busca, chips de filtro, linhas de lista e qualquer toolbar ficam em `PanelSidebarContent`.

## Painel extra (irmão)

Conteúdo à direita do split (ex.: campanha) fica **fora** do `Panel`, como irmão no flex pai — o `Panel` cobre só sidebar + main.
