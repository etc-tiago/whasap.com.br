export const APP_NAME = "Whasap";

type AppIconHead = {
  meta: Array<{ name: string; content: string }>;
  links: Array<{
    rel: string;
    href: string;
    type?: string;
    sizes?: string;
  }>;
};

/** Favicon, manifest e apple touch icon para `head` do TanStack Router. */
export function appIcons(options?: { appTitle?: string }): AppIconHead {
  const appTitle = options?.appTitle ?? APP_NAME;

  return {
    meta: [{ name: "apple-mobile-web-app-title", content: appTitle }],
    links: [
      {
        rel: "icon",
        type: "image/png",
        href: "/icons/favicon-96x96.png",
        sizes: "96x96",
      },
      { rel: "icon", type: "image/svg+xml", href: "/icons/favicon.svg" },
      { rel: "shortcut icon", href: "/icons/favicon.ico" },
      {
        rel: "apple-touch-icon",
        sizes: "180x180",
        href: "/icons/apple-touch-icon.png",
      },
      { rel: "manifest", href: "/icons/site.webmanifest" },
    ],
  };
}
