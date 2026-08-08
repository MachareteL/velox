import './globals.css';
import React from 'react';
import { AuthProvider } from '../lib/auth-context';

export const viewport = {
  themeColor: '#090d16',
};

export const metadata = {
  title: 'Velox Automator | Automação Inteligente de Convites',
  description: 'Painel exclusivo de automação e aceite instantâneo de convites para prestadores',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Velox Automator',
  },
};


export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="bg-gray-950 text-gray-100 min-h-screen antialiased selection:bg-emerald-500 selection:text-black">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

