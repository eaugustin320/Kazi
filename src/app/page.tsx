'use client';

import React from 'react';
import { PrototypeProvider } from '../context/PrototypeContext';
import { AppShell } from '../components/layout/AppShell';

export default function HomePage() {
  return (
    <PrototypeProvider>
      <AppShell />
    </PrototypeProvider>
  );
}
