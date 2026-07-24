import './globals.css';
import React from 'react';
import { AuthProvider } from '../lib/auth-context';

export const metadata = {
  title: 'Velox Automator | Automação Inteligente de Convites',
  description: 'Painel exclusivo de automação e aceite instantâneo de convites para prestadores',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-gray-950 text-gray-100 min-h-screen antialiased selection:bg-emerald-500 selection:text-black">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
