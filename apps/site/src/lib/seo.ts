const SITE_URL = "https://whasap.com.br";
const SITE_NAME = "Whasap";

type SeoOptions = {
  title: string;
  description: string;
  path?: string;
  ogImage?: string;
};

export function seo({ title, description, path = "/", ogImage = "/og-image.png" }: SeoOptions) {
  const url = `${SITE_URL}${path}`;
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;

  return [
    { title: fullTitle },
    { name: "description", content: description },
    { name: "robots", content: "index, follow" },
    { property: "og:title", content: fullTitle },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:url", content: url },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:locale", content: "pt_BR" },
    { property: "og:image", content: `${SITE_URL}${ogImage}` },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: fullTitle },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: `${SITE_URL}${ogImage}` },
  ];
}

export { SITE_URL, SITE_NAME };
