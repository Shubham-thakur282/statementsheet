import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { Converter } from './components/Converter';
import { AccountBadge, LicenseForm, openUpgrade, UpgradeModalHost } from './components/UpgradeModal';

function mount(id: string, node: ReactNode) {
  const el = document.getElementById(id);
  if (el) createRoot(el).render(<StrictMode>{node}</StrictMode>);
}

const modal = document.createElement('div');
modal.id = 'modal-root';
document.body.appendChild(modal);
mount('modal-root', <UpgradeModalHost />);
mount('converter', <Converter />);
mount('nav-account', <AccountBadge />);
mount('license-form', <LicenseForm />);

// Static "Go Pro" buttons on content pages.
document.querySelectorAll<HTMLElement>('[data-upgrade]').forEach((b) => b.addEventListener('click', () => openUpgrade('manual')));
