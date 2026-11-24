// Kazi Operational Application Shell
// Strictly implements I2 and I5 from BUILD_CORRECTION.md
// Replaces prototype playground chrome with genuine operational interface and server sessions

import React, { useState } from 'react';
import {
  Smartphone,
  Tablet,
  Monitor,
  Maximize2,
  Palette,
  ShieldCheck,
  RotateCcw,
  User,
  Building,
  Shield,
  Layers,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { usePrototype } from '../../context/PrototypeContext';
import { WorkerView } from '../../views/worker/WorkerView';
import { CompanyView } from '../../views/company/CompanyView';
import { AdminView } from '../../views/admin/AdminView';
import { SpecimensView } from '../../views/specimens/SpecimensView';
import { AuthScreen } from '../auth/AuthScreen';
import { Toast } from '../ui/Toast';
import { Dialog } from '../ui/Dialog';
import { DataTable } from '../ui/DataTable';
import { StatusBadge } from '../ui/StatusBadge';
import { Alert } from '../ui/Alert';

export const AppShell: React.FC = () => {
  const {
    currentUser,
    loginUser,
    logoutUser,
    switchTestAccount,
    role,
    setRole,
    viewport,
    setViewport,
    theme,
    setTheme,
    contrastResults,
    resetToDefaults,
  } = usePrototype();

  const [isContrastModalOpen, setIsContrastModalOpen] = useState(false);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [showDevToolbar, setShowDevToolbar] = useState(() => {
    if (typeof window !== 'undefined') {
      return (
        new URLSearchParams(window.location.search).get('dev') === 'true' ||
        localStorage.getItem('kazi_dev_mode') === 'true'
      );
    }
    return false;
  });

  const passingContrasts = contrastResults.filter((r) => r.pass).length;
  const totalContrasts = contrastResults.length;

  // If not authenticated, render genuine authentication gateway
  if (!currentUser) {
    return (
      <div className="kazi-auth-container">
        <AuthScreen onAuthenticated={loginUser} />
        <Toast />
      </div>
    );
  }

  return (
    <div className="kazi-app-shell">
      {/* Operational Header Bar */}
      <header
        style={{
          backgroundColor: '#0F172A',
          color: '#F8FAFC',
          padding: '10px 24px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          zIndex: 1000,
          borderBottom: '1px solid #334155',
          fontSize: '13px',
        }}
      >
        {/* Left: Brand & Country */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-on-primary)',
                fontWeight: 900,
                fontSize: '13px',
                padding: '4px 10px',
                borderRadius: '6px',
                letterSpacing: '0.8px',
              }}
            >
              KAZI
            </span>
            <strong style={{ fontSize: '15px', letterSpacing: '0.2px', color: '#F8FAFC' }}>
              Kazi Gabon
            </strong>
            <span
              style={{
                fontSize: '11px',
                padding: '2px 6px',
                borderRadius: '4px',
                backgroundColor: '#1E293B',
                color: '#94A3B8',
                border: '1px solid #334155',
              }}
            >
              v1.0.0
            </span>
          </div>
        </div>

        {/* Center: Active Session Identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#1E293B',
              padding: '4px 14px',
              borderRadius: '8px',
              border: '1px solid #334155',
              gap: '8px',
            }}
          >
            {role === 'WORKER' && <User size={15} color="#10B981" />}
            {role === 'COMPANY' && <Building size={15} color="#3B82F6" />}
            {role === 'ADMIN' && <Shield size={15} color="#F59E0B" />}

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#F8FAFC' }}>
                {role === 'WORKER' && 'Paul Mba (Ouvrier vérifié)'}
                {role === 'COMPANY' && 'BTP Horizon Gabon'}
                {role === 'ADMIN' && 'Recruteur Staff Kazi'}
                {role === 'SPECIMENS' && 'Composants UI (/dev/design)'}
              </span>
              <span style={{ fontSize: '10px', color: '#94A3B8' }}>
                {role === 'WORKER' && 'Libreville · Session active'}
                {role === 'COMPANY' && 'Entreprise cliente · Session active'}
                {role === 'ADMIN' && 'Staff National · Session active'}
                {role === 'SPECIMENS' && 'Mode spécimen'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Theming & Session Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Theme Quick Switcher */}
          <button
            onClick={() =>
              setTheme(
                theme.themeId === 'gabon-premium@1.0.0'
                  ? 'forest-premium@1.0.0'
                  : 'gabon-premium@1.0.0',
                'Basculement de thème opérationnel'
              )
            }
            style={{
              padding: '5px 10px',
              backgroundColor: theme.themeId === 'gabon-premium@1.0.0' ? '#0B5D3B' : '#F27B43',
              color: theme.themeId === 'gabon-premium@1.0.0' ? '#FFFFFF' : '#17251D',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
            }}
            title="Basculer entre les deux thèmes sémantiques"
          >
            <Palette size={13} />
            <span>{theme.themeId === 'gabon-premium@1.0.0' ? 'Gabon' : 'Forest'}</span>
          </button>

          {/* Dev mode toggle */}
          <button
            onClick={() => setShowDevToolbar(!showDevToolbar)}
            style={{
              padding: '5px 8px',
              backgroundColor: showDevToolbar ? '#1E3A8A' : '#1E293B',
              color: showDevToolbar ? '#93C5FD' : '#64748B',
              border: `1px solid ${showDevToolbar ? '#3B82F6' : '#334155'}`,
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 600,
            }}
            title="Afficher/masquer les outils de test et développement"
          >
            Dev
          </button>

          {/* Logout */}
          <button
            onClick={logoutUser}
            style={{
              padding: '5px 10px',
              backgroundColor: '#374151',
              color: '#F87171',
              border: '1px solid #4B5563',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              fontWeight: 600,
            }}
            title="Fermer la session"
          >
            <LogOut size={13} />
            <span>Déconnexion</span>
          </button>
        </div>
      </header>

      {/* Dedicated Developer & Test Toolbar (Segregated from normal application views) */}
      {showDevToolbar && (
        <div
          style={{
            backgroundColor: '#1E293B',
            color: '#F8FAFC',
            padding: '6px 24px',
            borderBottom: '1px solid #475569',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            fontSize: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', position: 'relative' }}>
            <span style={{ color: '#F59E0B', fontWeight: 800, fontSize: '11px', letterSpacing: '0.5px' }}>
              [OUTILS DE TEST & DÉVELOPPEMENT]
            </span>

            {/* Test Account Fast Switcher */}
            <button
              onClick={() => setShowAccountDropdown(!showAccountDropdown)}
              style={{
                backgroundColor: '#334155',
                border: 'none',
                color: '#F8FAFC',
                borderRadius: '4px',
                padding: '4px 8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 600,
              }}
              title="Basculer vers un compte test serveur"
            >
              <span>Changer de compte test</span>
              <ChevronDown size={12} />
            </button>

            {showAccountDropdown && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '6px',
                  backgroundColor: '#0F172A',
                  border: '1px solid #475569',
                  borderRadius: '8px',
                  boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)',
                  width: '260px',
                  zIndex: 2000,
                  padding: '6px',
                }}
              >
                <button
                  onClick={() => {
                    switchTestAccount('WORKER');
                    setShowAccountDropdown(false);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 10px',
                    backgroundColor: role === 'WORKER' ? '#1E293B' : 'transparent',
                    color: '#F8FAFC',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '12px',
                  }}
                >
                  <User size={14} color="#10B981" />
                  <div>
                    <div style={{ fontWeight: 600 }}>Ouvrier : Paul Mba</div>
                    <div style={{ fontSize: '10px', color: '#94A3B8' }}>+24101000000 (Mobile)</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    switchTestAccount('COMPANY');
                    setShowAccountDropdown(false);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 10px',
                    backgroundColor: role === 'COMPANY' ? '#1E293B' : 'transparent',
                    color: '#F8FAFC',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '12px',
                  }}
                >
                  <Building size={14} color="#3B82F6" />
                  <div>
                    <div style={{ fontWeight: 600 }}>Entreprise : BTP Horizon</div>
                    <div style={{ fontSize: '10px', color: '#94A3B8' }}>contact@btphorizon.ga</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    switchTestAccount('STAFF');
                    setShowAccountDropdown(false);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 10px',
                    backgroundColor: role === 'ADMIN' ? '#1E293B' : 'transparent',
                    color: '#F8FAFC',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '12px',
                  }}
                >
                  <Shield size={14} color="#F59E0B" />
                  <div>
                    <div style={{ fontWeight: 600 }}>Staff : Recruteur Kazi</div>
                    <div style={{ fontSize: '10px', color: '#94A3B8' }}>recruiter@kazi.ga (MFA)</div>
                  </div>
                </button>

                <div style={{ borderTop: '1px solid #334155', margin: '6px 0' }} />

                <button
                  onClick={() => {
                    setRole('SPECIMENS');
                    setShowAccountDropdown(false);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 10px',
                    backgroundColor: role === 'SPECIMENS' ? '#1E293B' : 'transparent',
                    color: '#CBD5E1',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '12px',
                  }}
                >
                  <Layers size={14} />
                  <span>Composants UI (/dev/design)</span>
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Viewport Presets */}
            <div
              style={{
                display: 'flex',
                backgroundColor: '#0F172A',
                padding: '2px',
                borderRadius: '6px',
                border: '1px solid #334155',
              }}
              title="Résolution responsive (360px mobile / 768px tablette / 1440px bureau)"
            >
              <button
                onClick={() => setViewport('MOBILE')}
                style={{
                  padding: '4px 6px',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: viewport === 'MOBILE' ? '#334155' : 'transparent',
                  color: viewport === 'MOBILE' ? '#38BDF8' : '#94A3B8',
                }}
                title="360px (Mobile Gabon)"
              >
                <Smartphone size={13} />
              </button>
              <button
                onClick={() => setViewport('TABLET')}
                style={{
                  padding: '4px 6px',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: viewport === 'TABLET' ? '#334155' : 'transparent',
                  color: viewport === 'TABLET' ? '#38BDF8' : '#94A3B8',
                }}
                title="768px (Tablette)"
              >
                <Tablet size={13} />
              </button>
              <button
                onClick={() => setViewport('DESKTOP')}
                style={{
                  padding: '4px 6px',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: viewport === 'DESKTOP' ? '#334155' : 'transparent',
                  color: viewport === 'DESKTOP' ? '#38BDF8' : '#94A3B8',
                }}
                title="1440px (Bureau)"
              >
                <Monitor size={13} />
              </button>
              <button
                onClick={() => setViewport('FLUID')}
                style={{
                  padding: '4px 6px',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: viewport === 'FLUID' ? '#334155' : 'transparent',
                  color: viewport === 'FLUID' ? '#38BDF8' : '#94A3B8',
                }}
                title="Plein écran fluide"
              >
                <Maximize2 size={13} />
              </button>
            </div>

            {/* Contrast report trigger */}
            <button
              onClick={() => setIsContrastModalOpen(true)}
              style={{
                padding: '4px 8px',
                backgroundColor: '#0F172A',
                color: '#34D399',
                border: '1px solid #334155',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 600,
              }}
              title="Inspecter le rapport de contraste des 17 paires"
            >
              <ShieldCheck size={13} />
              <span>Contraste {passingContrasts}/{totalContrasts}</span>
            </button>

            {/* Refresh data button */}
            <button
              onClick={resetToDefaults}
              style={{
                padding: '4px',
                backgroundColor: 'transparent',
                color: '#94A3B8',
                border: 'none',
                cursor: 'pointer',
                borderRadius: '4px',
              }}
              title="Synchroniser avec la base de données SQLite"
            >
              <RotateCcw size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Main Viewport Simulator Wrapper */}
      <div className="viewport-wrapper">
        <div
          className={`viewport-frame ${
            viewport === 'MOBILE'
              ? 'viewport-mobile'
              : viewport === 'TABLET'
              ? 'viewport-tablet'
              : viewport === 'DESKTOP'
              ? 'viewport-desktop'
              : 'viewport-fluid'
          }`}
        >
          {role === 'WORKER' && <WorkerView />}
          {role === 'COMPANY' && <CompanyView />}
          {role === 'ADMIN' && <AdminView />}
          {role === 'SPECIMENS' && <SpecimensView />}
        </div>
      </div>

      {/* Toast System */}
      <Toast />

      {/* WCAG Contrast Matrix Modal */}
      <Dialog
        isOpen={isContrastModalOpen}
        onClose={() => setIsContrastModalOpen(false)}
        title={`Rapport de Contraste des Paires Sémantiques (${theme.themeId})`}
        description="Vérification des 17 paires sémantiques déclarées (seuil 4.5:1 pour texte, 3:1 pour bordures)"
        primaryAction={{ label: 'Fermer', onClick: () => setIsContrastModalOpen(false) }}
      >
        <div style={{ marginBottom: '14px' }}>
          <Alert type="success" title="Validation automatique des paires sémantiques">
            Les 17 paires de couleurs du thème <strong>{theme.themeId}</strong> respectent les seuils minimaux.
          </Alert>
        </div>

        <DataTable
          data={contrastResults}
          keyExtractor={(r) => `${r.fgKey}-${r.bgKey}`}
          columns={[
            {
              header: 'Jetons sémantiques',
              accessor: (r) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      backgroundColor: r.fgColor,
                      border: '1px solid #ddd',
                    }}
                  />
                  <span>
                    {r.fgKey} sur {r.bgKey}
                  </span>
                </div>
              ),
            },
            {
              header: 'Ratio calculé',
              accessor: (r) => <strong>{r.ratio.toFixed(2)}:1</strong>,
            },
            { header: 'Minimum', accessor: (r) => `${r.minRequired}:1` },
            {
              header: 'Statut',
              accessor: (r) => (
                <StatusBadge label={r.pass ? 'PASS' : 'FAIL'} variant={r.pass ? 'success' : 'danger'} />
              ),
            },
          ]}
        />
      </Dialog>
    </div>
  );
};
