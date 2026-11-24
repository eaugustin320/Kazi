// Kazi Operational Authentication Screen
// Strictly implements I2 from BUILD_CORRECTION.md: Real session creation and role entry

import React, { useState } from 'react';
import { Smartphone, Building, ShieldCheck, CheckCircle2, ArrowRight, UserCheck, KeyRound } from 'lucide-react';
import { authApi, ApiUser } from '../../services/api';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { Alert } from '../ui/Alert';

interface AuthScreenProps {
  onAuthenticated: (user: ApiUser) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthenticated }) => {
  const [activeTab, setActiveTab] = useState<'WORKER' | 'COMPANY' | 'STAFF'>('WORKER');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Worker Form State
  const [workerPhone, setWorkerPhone] = useState('+24101000000');
  const [workerOtp, setWorkerOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpHint, setOtpHint] = useState<string | null>(null);

  const [showDevShortcuts, setShowDevShortcuts] = useState(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('dev') === 'true' || localStorage.getItem('kazi_dev_mode') === 'true';
    }
    return false;
  });

  // Company Form State
  const [companyEmail, setCompanyEmail] = useState('contact@btphorizon.ga');
  const [companyPassword, setCompanyPassword] = useState('Password123!');

  // Staff Form State
  const [staffEmail, setStaffEmail] = useState('recruiter@kazi.ga');
  const [staffPassword, setStaffPassword] = useState('Password123!');
  const [staffMfaTicket, setStaffMfaTicket] = useState<string | null>(null);
  const [staffMfaCode, setStaffMfaCode] = useState('123456');

  // Handle Worker Flow
  const handleWorkerSendOtp = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await authApi.sendWorkerOtp(workerPhone);
      setOtpSent(true);
      if (res.debugCode) {
        setWorkerOtp(res.debugCode);
        setOtpHint(`Code de test généré : ${res.debugCode}`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors de l’envoi du SMS.');
    } finally {
      setLoading(false);
    }
  };

  const handleWorkerVerify = async (codeToVerify?: string) => {
    const code = codeToVerify || workerOtp;
    if (!code) {
      setErrorMsg('Veuillez saisir le code à 6 chiffres.');
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await authApi.verifyWorkerOtp(workerPhone, code);
      onAuthenticated(res.user);
    } catch (err: any) {
      setErrorMsg(err.message || 'Code invalide ou expiré.');
    } finally {
      setLoading(false);
    }
  };

  const handleWorkerFastLogin = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await authApi.sendWorkerOtp('+24101000000');
      const code = res.debugCode || '123456';
      const verifyRes = await authApi.verifyWorkerOtp('+24101000000', code);
      onAuthenticated(verifyRes.user);
    } catch (err: any) {
      setErrorMsg(err.message || 'Échec de la connexion rapide.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Company Flow
  const handleCompanyLogin = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await authApi.loginCompany(companyEmail, companyPassword);
      onAuthenticated(res.user);
    } catch (err: any) {
      setErrorMsg(err.message || 'Identifiants entreprise incorrects.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Staff Flow
  const handleStaffLogin = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const challenge = await authApi.loginStaff(staffEmail, staffPassword);
      setStaffMfaTicket(challenge.mfaTicket);
    } catch (err: any) {
      setErrorMsg(err.message || 'Identifiants staff incorrects.');
    } finally {
      setLoading(false);
    }
  };

  const handleStaffMfaVerify = async () => {
    if (!staffMfaTicket) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await authApi.verifyStaffMfa(staffEmail, staffMfaTicket, staffMfaCode);
      onAuthenticated(res.user);
    } catch (err: any) {
      setErrorMsg(err.message || 'Code MFA invalide.');
    } finally {
      setLoading(false);
    }
  };

  const handleStaffFastLogin = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const challenge = await authApi.loginStaff('recruiter@kazi.ga', 'Password123!');
      const res = await authApi.verifyStaffMfa('recruiter@kazi.ga', challenge.mfaTicket, '123456');
      onAuthenticated(res.user);
    } catch (err: any) {
      setErrorMsg(err.message || 'Échec de la connexion staff.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#0F172A',
        color: '#F8FAFC',
        padding: '20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          backgroundColor: '#1E293B',
          borderRadius: '16px',
          border: '1px solid #334155',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '28px 28px 20px',
            borderBottom: '1px solid #334155',
            textAlign: 'center',
            backgroundColor: '#0F172A',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#059669',
              color: '#FFFFFF',
              fontWeight: 900,
              fontSize: '18px',
              padding: '6px 16px',
              borderRadius: '8px',
              marginBottom: '12px',
              letterSpacing: '1px',
            }}
          >
            KAZI GABON
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 6px', color: '#F8FAFC' }}>
            Portail d'Accès Sécurisé
          </h2>
          <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0 }}>
            Version 1.0.0 — Authentification réelle & sessions serveur
          </p>
        </div>

        {/* Role Tabs */}
        <div
          style={{
            display: 'flex',
            backgroundColor: '#0F172A',
            borderBottom: '1px solid #334155',
            padding: '6px 12px 0',
            gap: '6px',
          }}
        >
          <button
            onClick={() => {
              setActiveTab('WORKER');
              setErrorMsg(null);
            }}
            style={{
              flex: 1,
              padding: '10px 8px',
              border: 'none',
              borderBottom: activeTab === 'WORKER' ? '3px solid #10B981' : '3px solid transparent',
              backgroundColor: activeTab === 'WORKER' ? '#1E293B' : 'transparent',
              color: activeTab === 'WORKER' ? '#10B981' : '#94A3B8',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              borderTopLeftRadius: '8px',
              borderTopRightRadius: '8px',
            }}
          >
            <Smartphone size={16} />
            <span>Ouvrier</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('COMPANY');
              setErrorMsg(null);
            }}
            style={{
              flex: 1,
              padding: '10px 8px',
              border: 'none',
              borderBottom: activeTab === 'COMPANY' ? '3px solid #10B981' : '3px solid transparent',
              backgroundColor: activeTab === 'COMPANY' ? '#1E293B' : 'transparent',
              color: activeTab === 'COMPANY' ? '#10B981' : '#94A3B8',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              borderTopLeftRadius: '8px',
              borderTopRightRadius: '8px',
            }}
          >
            <Building size={16} />
            <span>Entreprise</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('STAFF');
              setErrorMsg(null);
            }}
            style={{
              flex: 1,
              padding: '10px 8px',
              border: 'none',
              borderBottom: activeTab === 'STAFF' ? '3px solid #10B981' : '3px solid transparent',
              backgroundColor: activeTab === 'STAFF' ? '#1E293B' : 'transparent',
              color: activeTab === 'STAFF' ? '#10B981' : '#94A3B8',
              fontWeight: 700,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              borderTopLeftRadius: '8px',
              borderTopRightRadius: '8px',
            }}
          >
            <ShieldCheck size={16} />
            <span>Staff Kazi</span>
          </button>
        </div>

        {/* Tab Body */}
        <div style={{ padding: '24px' }}>
          {errorMsg && (
            <div style={{ marginBottom: '16px' }}>
              <Alert type="danger" title="Erreur d'authentification">
                {errorMsg}
              </Alert>
            </div>
          )}

          {/* TAB 1: WORKER */}
          {activeTab === 'WORKER' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#E2E8F0' }}>
                  Numéro de téléphone gabonais (+241...)
                </label>
                <input
                  type="text"
                  value={workerPhone}
                  onChange={(e) => setWorkerPhone(e.target.value)}
                  placeholder="+24101000000"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    backgroundColor: '#0F172A',
                    border: '1px solid #475569',
                    color: '#F8FAFC',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {!otpSent ? (
                <Button
                  onClick={handleWorkerSendOtp}
                  disabled={loading}
                  style={{ width: '100%', padding: '12px', justifyContent: 'center' }}
                >
                  {loading ? 'Génération du code...' : 'Recevoir le code de vérification SMS'}
                </Button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {otpHint && (
                    <div style={{ padding: '8px 12px', backgroundColor: '#064E3B', color: '#6EE7B7', borderRadius: '6px', fontSize: '12px' }}>
                      {otpHint}
                    </div>
                  )}
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#E2E8F0' }}>
                      Code de confirmation (6 chiffres)
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={workerOtp}
                      onChange={(e) => setWorkerOtp(e.target.value)}
                      placeholder="123456"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        backgroundColor: '#0F172A',
                        border: '1px solid #475569',
                        color: '#F8FAFC',
                        fontSize: '18px',
                        letterSpacing: '4px',
                        textAlign: 'center',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <Button
                    onClick={() => handleWorkerVerify()}
                    disabled={loading}
                    style={{ width: '100%', padding: '12px', justifyContent: 'center' }}
                  >
                    {loading ? 'Validation en cours...' : 'Vérifier & Entrer dans l’espace ouvrier'}
                  </Button>
                </div>
              )}

              {showDevShortcuts && (
                <div style={{ borderTop: '1px solid #334155', paddingTop: '16px', marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={handleWorkerFastLogin}
                    disabled={loading}
                    style={{
                      width: '100%',
                      padding: '10px',
                      backgroundColor: '#1E3A8A',
                      color: '#BFDBFE',
                      border: '1px solid #3B82F6',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                    }}
                  >
                    <UserCheck size={16} />
                    <span>Connexion 1-Clic : Paul Mba (Ouvrier vérifié)</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: COMPANY */}
          {activeTab === 'COMPANY' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#E2E8F0' }}>
                  Email professionnel
                </label>
                <input
                  type="email"
                  value={companyEmail}
                  onChange={(e) => setCompanyEmail(e.target.value)}
                  placeholder="contact@btphorizon.ga"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    backgroundColor: '#0F172A',
                    border: '1px solid #475569',
                    color: '#F8FAFC',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#E2E8F0' }}>
                  Mot de passe
                </label>
                <input
                  type="password"
                  value={companyPassword}
                  onChange={(e) => setCompanyPassword(e.target.value)}
                  placeholder="••••••••••••"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    backgroundColor: '#0F172A',
                    border: '1px solid #475569',
                    color: '#F8FAFC',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <Button
                onClick={handleCompanyLogin}
                disabled={loading}
                style={{ width: '100%', padding: '12px', justifyContent: 'center' }}
              >
                {loading ? 'Connexion en cours...' : 'Se connecter à l’espace Entreprise'}
              </Button>

              {showDevShortcuts && (
                <div style={{ borderTop: '1px solid #334155', paddingTop: '16px', marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={async () => {
                      setCompanyEmail('contact@btphorizon.ga');
                      setCompanyPassword('Password123!');
                      setLoading(true);
                      try {
                        const res = await authApi.loginCompany('contact@btphorizon.ga', 'Password123!');
                        onAuthenticated(res.user);
                      } catch (err: any) {
                        setErrorMsg(err.message || 'Échec de connexion rapide entreprise.');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                    style={{
                      width: '100%',
                      padding: '10px',
                      backgroundColor: '#1E3A8A',
                      color: '#BFDBFE',
                      border: '1px solid #3B82F6',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                    }}
                  >
                    <Building size={16} />
                    <span>Connexion 1-Clic : BTP Horizon Gabon</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: STAFF */}
          {activeTab === 'STAFF' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {!staffMfaTicket ? (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#E2E8F0' }}>
                      Email personnel Staff (@kazi.ga)
                    </label>
                    <input
                      type="email"
                      value={staffEmail}
                      onChange={(e) => setStaffEmail(e.target.value)}
                      placeholder="recruiter@kazi.ga"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        backgroundColor: '#0F172A',
                        border: '1px solid #475569',
                        color: '#F8FAFC',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#E2E8F0' }}>
                      Mot de passe
                    </label>
                    <input
                      type="password"
                      value={staffPassword}
                      onChange={(e) => setStaffPassword(e.target.value)}
                      placeholder="••••••••••••"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        backgroundColor: '#0F172A',
                        border: '1px solid #475569',
                        color: '#F8FAFC',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>

                  <Button
                    onClick={handleStaffLogin}
                    disabled={loading}
                    style={{ width: '100%', padding: '12px', justifyContent: 'center' }}
                  >
                    {loading ? 'Vérification...' : 'Étape 1 : Valider les identifiants'}
                  </Button>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ padding: '8px 12px', backgroundColor: '#064E3B', color: '#6EE7B7', borderRadius: '6px', fontSize: '12px' }}>
                    Authentification par clé MFA requise (Code dev : 123456)
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px', color: '#E2E8F0' }}>
                      Code TOTP / Authenticator (6 chiffres)
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={staffMfaCode}
                      onChange={(e) => setStaffMfaCode(e.target.value)}
                      placeholder="123456"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        backgroundColor: '#0F172A',
                        border: '1px solid #475569',
                        color: '#F8FAFC',
                        fontSize: '18px',
                        letterSpacing: '4px',
                        textAlign: 'center',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <Button
                    onClick={handleStaffMfaVerify}
                    disabled={loading}
                    style={{ width: '100%', padding: '12px', justifyContent: 'center' }}
                  >
                    {loading ? 'Validation MFA...' : 'Étape 2 : Confirmer & Ouvrir console staff'}
                  </Button>
                </div>
              )}

              {showDevShortcuts && (
                <div style={{ borderTop: '1px solid #334155', paddingTop: '16px', marginTop: '8px' }}>
                  <button
                    type="button"
                    onClick={handleStaffFastLogin}
                    disabled={loading}
                    style={{
                      width: '100%',
                      padding: '10px',
                      backgroundColor: '#1E3A8A',
                      color: '#BFDBFE',
                      border: '1px solid #3B82F6',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                    }}
                  >
                    <KeyRound size={16} />
                    <span>Connexion 1-Clic : Recruteur Staff Kazi</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Discrete footer for developer / demo tools */}
        <div style={{ marginTop: '20px', borderTop: '1px solid #1E293B', paddingTop: '14px', textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => setShowDevShortcuts(!showDevShortcuts)}
            style={{
              background: 'none',
              border: 'none',
              color: '#64748B',
              fontSize: '12px',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            {showDevShortcuts ? 'Masquer les raccourcis de développement' : 'Outils de test & Comptes de démonstration'}
          </button>
        </div>
      </div>
    </div>
  );
};
