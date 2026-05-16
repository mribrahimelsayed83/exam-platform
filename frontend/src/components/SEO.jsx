import { Helmet } from 'react-helmet-async';

const SITE_NAME = 'منصة مستر إبراهيم فاروق التعليمية';
const SITE_URL  = 'https://mribrahimfarouk.com';
const DEFAULT_DESC = 'منصة تعليمية متكاملة — امتحانات إلكترونية وفيديوهات تعليمية لمراحل ثالث إعدادي والثانوية العامة.';
const API_BASE  = import.meta.env.VITE_API_URL || '';
const DEFAULT_OG_IMAGE = `${API_BASE}/api/landing/og-image`;

export default function SEO({ title, description, image, url, jsonLd }) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME;
  const desc      = description || DEFAULT_DESC;
  const canonical = url ? `${SITE_URL}${url}` : SITE_URL;
  const ogImage   = image || DEFAULT_OG_IMAGE;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <link rel="canonical" href={canonical} />

      {/* Open Graph */}
      <meta property="og:title"       content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:url"         content={canonical} />
      <meta property="og:image"       content={ogImage} />
      <meta property="og:type"        content="website" />
      <meta property="og:locale"      content="ar_EG" />
      <meta property="og:site_name"   content={SITE_NAME} />

      {/* Twitter */}
      <meta name="twitter:card"        content="summary_large_image" />
      <meta name="twitter:title"       content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image"       content={ogImage} />

      {/* JSON-LD */}
      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      )}
    </Helmet>
  );
}
