import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard/", "/lecture/", "/upload/", "/profile/"],
    },
    sitemap: "https://lectly.vercel.app/sitemap.xml",
  };
}
