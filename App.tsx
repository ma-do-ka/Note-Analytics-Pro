
import React, { useState, useEffect } from 'react';
import { Dashboard } from './components/Dashboard';
import { SetupScreen } from './components/SetupScreen';
import { AppSettings } from './types';

const SETTINGS_KEY = 'NOTE_ANALYTICS_SETTINGS';

// Cookie utilities for persistent storage across iframe reloads
const setCookie = (name: string, value: string, days: number) => {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + encodeURIComponent(value) + expires + "; path=/; SameSite=None; Secure";
};

const getCookie = (name: string) => {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for(let i=0;i < ca.length;i++) {
    let c = ca[i];
    while (c.charAt(0)==' ') c = c.substring(1,c.length);
    if (c.indexOf(nameEQ) == 0) return decodeURIComponent(c.substring(nameEQ.length,c.length));
  }
  return null;
};

const eraseCookie = (name: string) => {   
  document.cookie = name +'=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=None; Secure';
};

function App() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Try localStorage first, then fallback to cookie
    let saved = null;
    try {
      saved = localStorage.getItem(SETTINGS_KEY);
    } catch (e) {
      console.warn('localStorage access denied', e);
    }
    
    if (!saved) {
      saved = getCookie(SETTINGS_KEY);
    }

    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse settings', e);
      }
    }
    setLoaded(true);
  }, []);

  const handleSaveSettings = (newSettings: AppSettings) => {
    const stringified = JSON.stringify(newSettings);
    try {
      localStorage.setItem(SETTINGS_KEY, stringified);
    } catch (e) {
      console.warn('Failed to save to localStorage', e);
    }
    setCookie(SETTINGS_KEY, stringified, 365); // Save for 1 year
    setSettings(newSettings);
  };

  const handleReset = () => {
    try {
      localStorage.removeItem(SETTINGS_KEY);
      sessionStorage.clear();
    } catch (e) {
      console.error('Failed to remove settings from storage', e);
    }
    eraseCookie(SETTINGS_KEY);
    // Ensure UI updates immediately. 
    // We REMOVED window.location.reload() to prevent 404 errors in certain hosting environments.
    // React state update is sufficient to show the SetupScreen.
    setSettings(null);
  };

  if (!loaded) return null;

  return (
    <div className="antialiased">
      {settings ? (
        <Dashboard settings={settings} onReset={handleReset} />
      ) : (
        <SetupScreen onSave={handleSaveSettings} />
      )}
    </div>
  );
}

export default App;