import React from 'react';
import type { Metadata } from 'next';
import '../tokens/styles.css';

export const metadata: Metadata = {
  title: 'Kazi - Plateforme de Recrutement Temporaire (Gabon)',
  description: 'Mise en relation humaine pour main-d’œuvre temporaire au Gabon.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr-GA">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
