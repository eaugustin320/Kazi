// Kazi File Upload Specimen Component (Fiche Circuit, RCCM, CNI)

import React, { useState } from 'react';
import { Upload, CheckCircle2, FileText } from 'lucide-react';

export interface FileUploadProps {
  label: string;
  helperText?: string;
  accept?: string;
  required?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  label,
  helperText = 'Format PDF, JPG ou PNG (Max 5 Mo)',
  required,
}) => {
  const [fileName, setFileName] = useState<string | null>(null);

  const handleSimulatedUpload = () => {
    setFileName(`document_gabon_${Date.now().toString().slice(-4)}.pdf`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
      <label
        style={{
          fontSize: '14px',
          fontWeight: 600,
          color: 'var(--color-text)',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        <span>{label}</span>
        {required && <span style={{ color: 'var(--color-danger-text)' }}>*</span>}
      </label>

      <div
        onClick={handleSimulatedUpload}
        style={{
          minHeight: '80px',
          padding: '16px',
          backgroundColor: fileName ? 'var(--color-success-surface)' : 'var(--color-surface)',
          border: `1.5px dashed ${fileName ? 'var(--color-success-text)' : 'var(--color-control-border)'}`,
          borderRadius: 'var(--radius-input)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          cursor: 'pointer',
          textAlign: 'center',
          transition: 'all var(--transition-fast)',
        }}
      >
        {fileName ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-success-text)' }}>
              <CheckCircle2 size={20} />
              <FileText size={18} />
              <strong style={{ fontSize: '14px' }}>{fileName}</strong>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--color-success-text)' }}>
              Document téléversé avec succès (simulation)
            </span>
          </>
        ) : (
          <>
            <Upload size={22} style={{ color: 'var(--color-primary)' }} />
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>
              Cliquez ou déposez votre fichier ici
            </div>
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>{helperText}</span>
          </>
        )}
      </div>
    </div>
  );
};
