import React, { useState } from 'react';
import { STRINGS } from './lib/i18n';
import Chat from './components/Chat.jsx';
import Dashboard from './components/Dashboard.jsx';
import NetworkView from './components/NetworkView.jsx';

export default function App() {
  const [lang, setLang] = useState('en');
  const [tab, setTab] = useState('chat');
  const t = STRINGS[lang];

  return (
    <>
      <header className="topbar">
        <div className="brand">
          <div className="badge">KSP</div>
          <div>
            <h1>{t.appTitle}</h1>
            <p>{t.subtitle}</p>
          </div>
        </div>
        <div className="lang-toggle">
          <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>English</button>
          <button className={lang === 'kn' ? 'active' : ''} onClick={() => setLang('kn')}>ಕನ್ನಡ</button>
        </div>
      </header>

      <div className="app">
        <nav className="tabs">
          {['chat', 'dashboard', 'network'].map((k) => (
            <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
              {t.tabs[k]}
            </button>
          ))}
        </nav>

        {tab === 'chat' && <Chat t={t} lang={lang} />}
        {tab === 'dashboard' && <Dashboard t={t} />}
        {tab === 'network' && <NetworkView t={t} />}
      </div>
    </>
  );
}
