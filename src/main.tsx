import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import { initializeDatabase } from './db/database';
import './styles.css';

const root = document.getElementById('root');

if (!root) throw new Error('Application root was not found.');

initializeDatabase()
  .then(() => createRoot(root).render(<StrictMode><App /></StrictMode>))
  .catch(() => {
    root.innerHTML = '<main class="fatal-error"><h1>Budget Pocket could not start</h1><p>Your local data was not changed. Reload the app or restore a backup from a supported browser.</p></main>';
  });
