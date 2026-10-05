import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/montserrat/600.css';
import '@fontsource/montserrat/700.css';
import '@fontsource/montserrat/800.css';
import '@fontsource/montserrat/900.css';
import '@fontsource/kaushan-script/400.css';
import './index.css';
import { toast, useStore } from './store';
import { fmt } from './lib/format';

// a live-table seat that was open when the page closed: its last stack goes back to the wallet
{
  const e = useStore.getState().escrow;
  if (e) {
    const amt = useStore.getState().escrowClose();
    setTimeout(() => toast({ title: `Cashed out ${fmt(amt, 0)} from ${e.tableName}`, desc: 'You left the table when the page closed.', tone: 'gold' }), 1200);
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
