import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { MeerkatProvider, useMeerkat } from './lib/MeerkatProvider';
import { CallProvider } from './lib/CallProvider';
import { ThemeProvider, useThemeLibrary } from './ui/theme/ThemeProvider';
import { App } from './ui/App';
import './ui/theme/tokens.css';
import './ui/app.css';

// Binds the durable sql.js store to the ThemeProvider (which lives above
// MeerkatProvider and otherwise only has localStorage). Once the engine is ready,
// this reconciles localStorage <-> mk_themes both ways and enables write-through.
function ThemeDatabaseBridge(): null {
  const { db } = useMeerkat();
  const { bindDatabase } = useThemeLibrary();
  useEffect(() => {
    bindDatabase(db);
  }, [db, bindDatabase]);
  return null;
}

// Boot the real browser node (bootBrowserSync) inside MeerkatProvider, which gates
// children until the engine + identity are ready, then render the shell. The
// provider guarantees MK-001 durability (flush on identity create + unload
// handlers) and exposes the real session API. ThemeProvider follows OS appearance
// for the few JS color consumers; CSS variables handle the rest.
const container = document.getElementById('root');
if (container) {
  createRoot(container).render(
    <StrictMode>
      <ThemeProvider>
        <MeerkatProvider>
          <ThemeDatabaseBridge />
          <CallProvider>
            <App />
          </CallProvider>
        </MeerkatProvider>
      </ThemeProvider>
    </StrictMode>,
  );
}
