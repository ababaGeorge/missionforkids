/* eslint-disable */
// Shared components: Phone chrome, OwlMascot (Pip), GeomIcon, useI18n, Stars helper.

const useT = (lang) => {
  const dict = window.MFK_DATA.i18n;
  return (key, vars = {}) => {
    const base = lang === 'en' ? dict.en[key] : dict.zh[key];
    let s = base || key;
    Object.keys(vars).forEach(k => { s = s.replace(`{${k}}`, vars[k]); });
    return s;
  };
};

// Bilingual helper — "single language (mock=zh)" per user: returns zh by default, en when lang='en'.
const bi = (zh, en, lang) => lang === 'en' ? en : zh;

// Phone chrome (390×780 iPhone-ish).
function Phone({ children, bg = 'var(--bg)', label }) {
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
      <div style={{
        width: 390, height: 780, background: bg,
        borderRadius: 44, overflow: 'hidden', position: 'relative',
        boxShadow: '0 24px 64px rgba(28,26,20,0.16), 0 0 0 10px #1C1A14, 0 0 0 11px #2C2A24',
        display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-body)'
      }}>
        {/* status bar */}
        <div style={{height: 44, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 28px', fontSize: 14, fontWeight: 800, flexShrink: 0, zIndex: 2}}>
          <span>9:41</span>
          <div style={{width: 90, height: 28, background: '#1C1A14', borderRadius: 9999, position: 'absolute', left: '50%', top: 10, transform: 'translateX(-50%)'}} />
          <span style={{letterSpacing: 1}}>●●●</span>
        </div>
        <div style={{flex: 1, overflow: 'hidden', position: 'relative'}}>{children}</div>
      </div>
      {label && <div style={{marginTop: 10, fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: 1.4, textTransform: 'uppercase'}}>{label}</div>}
    </div>
  );
}

// Owl mascot "Pip" — pure geometry, no faces of people, flat.
function Owl({ size = 64, mood = 'watch', direction = 'A' }) {
  // palette per direction
  const palettes = {
    A: { body: '#1A8A7A', belly: '#E0F5F0', beak: '#F5A623', eye: '#1C1A14', eyeRing: '#FFFDF7' },
    B: { body: '#146B5E', belly: '#FFF3D6', beak: '#F5A623', eye: '#1C1A14', eyeRing: '#FFFDF7' },
    C: { body: '#E8D97A', belly: '#2A2E4A', beak: '#F5A623', eye: '#FFFDF7', eyeRing: '#1A1B2E' },
  };
  const p = palettes[direction] || palettes.A;
  const blink = mood === 'think';
  const happy = mood === 'cheer';
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {/* tail/legs hint */}
      <ellipse cx="32" cy="56" rx="16" ry="4" fill={p.body} opacity="0.2" />
      {/* body */}
      <path d="M16 30 C 16 18, 48 18, 48 30 L 48 48 C 48 56, 16 56, 16 48 Z" fill={p.body} />
      {/* belly */}
      <ellipse cx="32" cy="42" rx="12" ry="14" fill={p.belly} />
      {/* ear tufts */}
      <path d="M18 22 L 14 14 L 22 18 Z" fill={p.body} />
      <path d="M46 22 L 50 14 L 42 18 Z" fill={p.body} />
      {/* eyes */}
      <circle cx="25" cy="30" r="5" fill={p.eyeRing} />
      <circle cx="39" cy="30" r="5" fill={p.eyeRing} />
      {blink ? (
        <>
          <rect x="21" y="29" width="8" height="2" rx="1" fill={p.eye} />
          <rect x="35" y="29" width="8" height="2" rx="1" fill={p.eye} />
        </>
      ) : (
        <>
          <circle cx={happy ? 26 : 25} cy="30" r="2.4" fill={p.eye} />
          <circle cx={happy ? 40 : 39} cy="30" r="2.4" fill={p.eye} />
        </>
      )}
      {/* beak */}
      <path d="M30 34 L 34 34 L 32 38 Z" fill={p.beak} />
      {/* wings */}
      <path d="M17 34 C 14 40, 16 46, 20 46 L 20 34 Z" fill={p.body} opacity="0.85" />
      <path d="M47 34 C 50 40, 48 46, 44 46 L 44 34 Z" fill={p.body} opacity="0.85" />
    </svg>
  );
}

// Geometric icon — circle, square, triangle compositions. No faces.
function GeomIcon({ kind, size = 40, color = 'var(--primary)', accent = 'var(--accent)' }) {
  const s = size;
  const common = { width: s, height: s, viewBox: '0 0 40 40', 'aria-hidden': true };
  if (kind === 'desk') return (
    <svg {...common}>
      <rect x="6" y="18" width="28" height="3" fill={color} />
      <rect x="8" y="21" width="3" height="12" fill={color} />
      <rect x="29" y="21" width="3" height="12" fill={color} />
      <circle cx="14" cy="14" r="3" fill={accent} />
      <rect x="20" y="12" width="10" height="5" fill={color} opacity="0.5" />
    </svg>
  );
  if (kind === 'tooth') return (
    <svg {...common}>
      <path d="M20 8 C 12 8 10 14 12 22 C 13 26 14 32 17 32 C 19 32 19 26 20 26 C 21 26 21 32 23 32 C 26 32 27 26 28 22 C 30 14 28 8 20 8 Z" fill={color} />
      <circle cx="20" cy="18" r="3" fill={accent} />
    </svg>
  );
  if (kind === 'piano') return (
    <svg {...common}>
      <rect x="6" y="12" width="28" height="20" fill={color} />
      <rect x="8" y="14" width="4" height="14" fill="#FFFDF7" />
      <rect x="13" y="14" width="4" height="14" fill="#FFFDF7" />
      <rect x="18" y="14" width="4" height="14" fill="#FFFDF7" />
      <rect x="23" y="14" width="4" height="14" fill="#FFFDF7" />
      <rect x="28" y="14" width="4" height="14" fill="#FFFDF7" />
      <rect x="10" y="14" width="2" height="8" fill={color} />
      <rect x="15" y="14" width="2" height="8" fill={color} />
      <rect x="25" y="14" width="2" height="8" fill={color} />
      <rect x="30" y="14" width="2" height="8" fill={color} />
    </svg>
  );
  if (kind === 'book') return (
    <svg {...common}>
      <rect x="8" y="8" width="24" height="24" fill={color} />
      <rect x="11" y="11" width="18" height="2" fill="#FFFDF7" />
      <rect x="11" y="15" width="12" height="2" fill="#FFFDF7" />
      <rect x="11" y="19" width="18" height="2" fill="#FFFDF7" />
      <rect x="11" y="23" width="10" height="2" fill="#FFFDF7" />
    </svg>
  );
  if (kind === 'fish') return (
    <svg {...common}>
      <path d="M8 20 L 16 14 L 28 14 L 32 20 L 28 26 L 16 26 Z" fill={color} />
      <circle cx="24" cy="19" r="1.8" fill="#FFFDF7" />
      <path d="M30 20 L 36 14 L 36 26 Z" fill={accent} />
    </svg>
  );
  if (kind === 'homework') return (
    <svg {...common}>
      <rect x="8" y="6" width="20" height="26" fill={color} />
      <rect x="11" y="10" width="14" height="2" fill="#FFFDF7" />
      <rect x="11" y="14" width="14" height="2" fill="#FFFDF7" />
      <rect x="11" y="18" width="10" height="2" fill="#FFFDF7" />
      <path d="M26 22 L 34 14 L 32 12 L 24 20 Z" fill={accent} />
    </svg>
  );
  if (kind === 'star') return (
    <svg {...common}>
      <path d="M20 4 L 24 15 L 36 15 L 26 22 L 30 34 L 20 27 L 10 34 L 14 22 L 4 15 L 16 15 Z" fill={accent} />
    </svg>
  );
  if (kind === 'check') return (
    <svg {...common}>
      <circle cx="20" cy="20" r="14" fill={color} />
      <path d="M13 20 L 18 25 L 28 15" stroke="#FFFDF7" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
  return <svg {...common}><circle cx="20" cy="20" r="12" fill={color} /></svg>;
}

const iconForTask = (t) => {
  const map = { t1: 'desk', t2: 'tooth', t3: 'piano', t4: 'book', t5: 'fish', t6: 'homework' };
  return map[t.id] || 'check';
};

// Pending star glyph ☆ vs ★
const Star = ({ filled = true, size = 16 }) => (
  <span style={{color: 'var(--accent)', fontSize: size, lineHeight: 1, fontFamily: 'var(--font-display)', fontWeight: 800}}>{filled ? '★' : '☆'}</span>
);

// ----- Bottom Tab Bar (direction-aware) -----
function TabBar({ role, active, lang, direction = 'C' }) {
  const palettes = {
    A: { bg: '#FFFDF7', border: 'rgba(28,26,20,0.08)', active: '#1A8A7A', muted: '#8A8275' },
    B: { bg: '#FFF8E8', border: 'rgba(28,26,20,0.10)', active: '#146B5E', muted: '#7A7265' },
    C: { bg: 'rgba(30,37,71,0.92)', border: 'rgba(247,242,234,0.14)', active: '#FFD966', muted: '#8A88A8' },
  };
  const p = palettes[direction] || palettes.C;
  const childTabs = [
    { key:'tasks',   zh:'任務', en:'Tasks',  icon:'☰' },
    { key:'rewards', zh:'獎勵', en:'Rewards',icon:'✦' },
    { key:'me',      zh:'我的', en:'Me',     icon:'◉' },
    { key:'notif',   zh:'通知', en:'Alerts', icon:'◐' },
  ];
  const parentTabs = [
    { key:'tasks',   zh:'任務', en:'Tasks',  icon:'☰' },
    { key:'rewards', zh:'獎勵', en:'Rewards',icon:'✦' },
    { key:'review',  zh:'審核', en:'Review', icon:'◉' },
    { key:'settings',zh:'設定', en:'Settings',icon:'⚙' },
  ];
  const tabs = role === 'parent' ? parentTabs : childTabs;
  return (
    <div style={{position:'absolute', left:0, right:0, bottom:0, height:72, background:p.bg, backdropFilter:'blur(12px)', borderTop:`1px solid ${p.border}`, display:'flex', padding:'8px 12px 14px', zIndex:5}}>
      {tabs.map(tab => {
        const on = tab.key === active;
        return (
          <div key={tab.key} style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2, color: on?p.active:p.muted}}>
            <div style={{fontSize:22, fontWeight:800, lineHeight:1}}>{tab.icon}</div>
            <div style={{fontSize:10, fontWeight:800, letterSpacing:0.5}}>{lang==='en'?tab.en:tab.zh}</div>
          </div>
        );
      })}
    </div>
  );
}

// ----- Screen Header with back/close affordance -----
function ScreenHeader({ lang, title, kind='back', onDark=false, right }) {
  const icon = kind==='close' ? '✕' : '←';
  const color = onDark ? '#F7F2EA' : '#1C1A14';
  return (
    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 18px', position:'relative', zIndex:2}}>
      <div style={{width:36, height:36, borderRadius:9999, background: onDark?'rgba(247,242,234,0.08)':'rgba(28,26,20,0.05)', display:'flex', alignItems:'center', justifyContent:'center', color, fontSize:18, fontWeight:700}}>{icon}</div>
      <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:14, color}}>{title}</div>
      <div style={{width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', color, fontSize:16}}>{right || ''}</div>
    </div>
  );
}

Object.assign(window, { Phone, Owl, GeomIcon, iconForTask, Star, useT, bi, TabBar, ScreenHeader });