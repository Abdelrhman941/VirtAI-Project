import React from 'react';
import { Helmet } from 'react-helmet-async';

interface Props {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
}

export const OverviewSEO: React.FC<Props> = ({
  title = 'VirtAI – Premium AI Teaching Assistant',
  description = 'VirtAI is a real-time AI teaching assistant powered by speech recognition, large language models, a 3D avatar, and RAG pipelines.',
  image = 'https://virtai.example.com/assets/og-image.jpg', // Placeholder domain for production SEO
  url = 'https://virtai.example.com',
}) => {
  return (
    <Helmet>
      {/* Standard Meta Tags */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="robots" content="index, follow" />

      {/* OpenGraph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={url} />
      <meta property="og:site_name" content="VirtAI" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* Semantic/Accessibility Helper Link Tags */}
      <link rel="canonical" href={url} />
    </Helmet>
  );
};

export default OverviewSEO;
