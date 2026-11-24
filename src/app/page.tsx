import React from 'react';
import Link from 'next/link';

export default function HomePage() {
  return (
    <main style={{ padding: '32px 24px', maxWidth: '800px', margin: '0 auto', fontFamily: 'var(--font-family)' }}>
      <header style={{ marginBottom: '32px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 800, color: 'var(--color-primary)' }}>Kazi Gabon</h1>
        <p style={{ fontSize: '16px', color: 'var(--color-text-muted)', marginTop: '8px' }}>
          Plateforme de recrutement assisté pour le travail journalier &middot; Libreville
        </p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div style={{ padding: '24px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--color-border)' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Espace Ouvriers</h3>
          <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
            Accédez gratuitement aux missions, postulez sans frais et percevez votre salaire directement auprès de l’entreprise.
          </p>
          <Link href="/worker/missions" style={{ color: 'var(--color-primary)', fontWeight: 700, textDecoration: 'none' }}>
            Consulter les missions &rarr;
          </Link>
        </div>

        <div style={{ padding: '24px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--color-border)' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Espace Entreprises</h3>
          <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
            Transmettez vos besoins de main-d’œuvre qualifiée. Kazi sélectionne et vérifie vos équipes temporaires.
          </p>
          <Link href="/company/overview" style={{ color: 'var(--color-primary)', fontWeight: 700, textDecoration: 'none' }}>
            Accéder à l'espace entreprise &rarr;
          </Link>
        </div>

        <div style={{ padding: '24px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--radius-card)', border: '1px solid var(--color-border)' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Espace Administration</h3>
          <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
            Modération des demandes, sélection humaine des candidats, affectations atomiques et suivi de mission.
          </p>
          <Link href="/admin/queue" style={{ color: 'var(--color-primary)', fontWeight: 700, textDecoration: 'none' }}>
            Portail Opérations Staff &rarr;
          </Link>
        </div>
      </div>
    </main>
  );
}
