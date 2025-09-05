import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Deriv Trading Bot - Advanced Dual Barrier Trading Platform',
  description: 'Professional automated trading platform for Deriv markets with dual barrier execution, martingale strategy, and advanced risk management.',
  keywords: 'deriv, trading, bot, automated, barriers, martingale, risk management',
  authors: [{ name: 'BLACKBOX.AI' }],
  viewport: 'width=device-width, initial-scale=1',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}