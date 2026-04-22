/* eslint-disable */
// Prototype-level wrappers: wire the existing C-direction visual vocabulary
// to the live store. We re-use the palette and some helpers from screens_c*
// but reimplement the screens to be state-driven + dispatch actions.

const P = {
  bg:'#0B0E1A', text:'#F7F2EA', muted:'#8A8D9F',
  surface:'#131727', surfaceHi:'#1A1F33', surfaceCream:'#F4E9D8',
  border:'rgba(247,242,234,0.10)',
  primary:'#FFD966', primaryDark:'#B8892E', primaryGlow:'rgba(255,217,102,0.35)',
  accent:'#F5A623', accentHot:'#FF6B47',
  green:'#5EE0A8', purple:'#8B7ED8', blue:'#6FA9E8',
};

// Tiny starfield
function PStarfield({count=22}){
  const [stars] = React.useState(() =>
    Array.from({length:count},(_,i)=>({
      left: Math.random()*100,
      top: Math.random()*100,
      size: 1 + Math.random()*2,
      opacity: 0.15 + Math.random()*0.5,
      key: i,
    }))
  );
  return (
    <div style={{position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden'}}>
      {stars.map(s => (
        <div key={s.key} style={{position:'absolute', left:s.left+'%', top:s.top+'%', width:s.size, height:s.size, borderRadius:'50%', background:P.text, opacity:s.opacity}}/>
      ))}
    </div>
  );
}

function PRoughStar({size=20, color=P.primary}){
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{display:'inline-block', verticalAlign:'middle'}}>
      <path d="M12 2.4 L14.6 9.2 L22 9.6 L16.3 14.1 L18.3 21.2 L12 17.3 L5.7 21.2 L7.7 14.1 L2 9.6 L9.4 9.2 Z" fill={color} stroke={color} strokeWidth="0.4" strokeLinejoin="round"/>
    </svg>
  );
}

// Friendly empty state
function PEmpty({emoji, title, body}){
  return (
    <div style={{padding:'48px 24px', textAlign:'center', color:P.muted}}>
      <div style={{fontSize:42, marginBottom:12}}>{emoji}</div>
      <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:18, color:P.text, marginBottom:6}}>{title}</div>
      <div style={{fontSize:13, lineHeight:1.5}}>{body}</div>
    </div>
  );
}

// Top status bar (iOS-ish, compact)
function PStatusBar(){
  return (
    <div style={{height:44, padding:'0 22px', display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:13, fontFamily:'DM Sans,sans-serif', fontWeight:700, color:P.text, flexShrink:0}}>
      <div>9:41</div>
      <div style={{display:'flex', gap:6, alignItems:'center', fontSize:11}}>
        <span>●●●</span>
        <span style={{fontSize:13}}>▲</span>
        <span style={{width:22, height:11, border:`1.2px solid ${P.text}`, borderRadius:2.5, display:'inline-flex', alignItems:'center', padding:1}}>
          <span style={{flex:1, height:'100%', background:P.text, borderRadius:1}}/>
        </span>
      </div>
    </div>
  );
}

// ============ TAB BAR (connected) ============
function PTabBar({role, kidId, active, onGoto}){
  const world = MFKStore.useWorld();
  const pendingForParent = MFKStore.select.pendingCountForParent();
  const unreadChild = MFKStore.select.unreadForRole('child', kidId).length;
  const unreadParent = MFKStore.select.unreadForRole('parent').length;
  const items = role === 'child'
    ? [
      { id:'tasks-home', label:'任務', icon:'✦' },
      { id:'rewards',    label:'獎勵', icon:'♡' },
      { id:'notifs',     label:'通知', icon:'◉', badge: unreadChild },
      { id:'me',         label:'我的', icon:'☽' },
    ]
    : [
      { id:'tasks-manage', label:'任務', icon:'✦' },
      { id:'review',       label:'審核', icon:'◐', badge: pendingForParent },
      { id:'rewards-p',    label:'禮物', icon:'♡' },
      { id:'notifs',       label:'通知', icon:'◉', badge: unreadParent },
      { id:'settings',     label:'設定', icon:'☰' },
    ];
  return (
    <div style={{flexShrink:0, padding:'8px 12px 18px', display:'flex', gap:4, background:`linear-gradient(to top, ${P.bg} 60%, transparent)`, borderTop:`1px solid ${P.border}`, position:'relative'}}>
      {items.map(it => {
        const on = active === it.id;
        return (
          <div key={it.id} onClick={()=>onGoto(it.id)} style={{flex:1, padding:'8px 4px', textAlign:'center', cursor:'pointer', position:'relative'}}>
            <div style={{fontSize:18, color: on?P.primary:P.muted, lineHeight:1}}>{it.icon}</div>
            <div style={{fontSize:10, fontWeight:800, color: on?P.text:P.muted, marginTop:4, letterSpacing:0.5}}>{it.label}</div>
            {it.badge ? (
              <div style={{position:'absolute', top:4, right:'calc(50% - 18px)', minWidth:16, height:16, borderRadius:9999, background:P.accentHot, color:P.text, fontSize:10, fontWeight:800, padding:'0 4px', display:'flex', alignItems:'center', justifyContent:'center'}}>{it.badge}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

Object.assign(window, { P, PStarfield, PRoughStar, PEmpty, PStatusBar, PTabBar });
