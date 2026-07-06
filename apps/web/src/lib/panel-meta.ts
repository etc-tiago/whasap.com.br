const PANEL_URL = "https://web.whasap.com.br";
const PANEL_NAME = "Whasap";

type PanelMetaOptions = {
  title: string;
  description?: string;
};

/** Meta tags do painel (web.whasap.com.br) — sem indexação pública. */
export function panelMeta({ title, description }: PanelMetaOptions) {
  const fullTitle = title.includes(PANEL_NAME) ? title : `${title} | ${PANEL_NAME}`;

  return [
    { title: fullTitle },
    ...(description ? [{ name: "description", content: description }] : []),
    { name: "robots", content: "noindex, nofollow" },
    { property: "og:title", content: fullTitle },
    { property: "og:site_name", content: PANEL_NAME },
    { property: "og:url", content: PANEL_URL },
  ];
}

export { PANEL_URL, PANEL_NAME };
