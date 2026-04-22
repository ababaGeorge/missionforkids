/* eslint-disable */
// Direction C — Night Sky. Dark, tactile, playful. Hand-drawn feel via wobbly SVG shapes.
// Kids as cosmonauts collecting starlight. Still uses the brand accents (gold ★, forest) but inverted.

// Lighter dusk palette — deep blue-purple, but airier. More contrast via cream surfaces.
const C_PALETTE = {
  bg: '#1E2547',        // lighter night (was #0F1228)
  surface: '#2D3460',   // mid card
  surfaceHi: '#3A4278',
  surfaceCream: '#F7F2EA', // cream cards on dark bg for variety
  primary: '#FFD966',   // brighter gold
  primaryDark: '#D4AF37',
  text: '#F7F2EA', muted: '#B8B6C8', border: 'rgba(247,242,234,0.18)',
  accent: '#F5A623', accentHot: '#FF6B47',
  green: '#5EE0A8',
  star: '#FFE066',
};

// Wobbly blob using path — shared across direction
const Blob = ({ size = 120, color = '#E8D97A', seed = 1 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <path d={`M50 5 C ${70+seed*3} 8, 92 25, ${94-seed} 52 C 92 74, ${70+seed*2} 94, 50 95 C 28 94, ${6+seed} 72, 6 50 C ${6+seed*2} 26, 28 6, 50 5 Z`} fill={color} />
  </svg>
);

// A hand-drawn rough star
const RoughStar = ({ size = 18, color = '#FFE066', rot = 0 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{transform: `rotate(${rot}deg)`}}>
    <path d="M12 2 L14.5 9 L22 9.5 L16 14 L18 21.5 L12 17.5 L6 21.5 L8 14 L2 9.5 L9.5 9 Z" fill={color} stroke={color} strokeWidth={0.5} strokeLinejoin="round" />
  </svg>
);

const CStarfield = ({ count = 40 }) => (
  <div style={{position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden'}}>
    {[...Array(count)].map((_,i)=>(
      <div key={i} style={{position:'absolute', left:`${(i*47)%100}%`, top:`${(i*31)%100}%`, width: i%7===0?3:1.5, height: i%7===0?3:1.5, borderRadius: 9999, background: i%9===0?'#FFE066':'#F5F2E8', opacity: 0.3 + (i%5)*0.12, boxShadow: i%7===0 ? '0 0 6px #FFE066':'none'}} />
    ))}
  </div>
);

function C_Home({ lang, load, kid }) {
  const t = useT(lang);
  const tasks = load === 'light' ? window.MFK_DATA.tasksLight : window.MFK_DATA.tasksFull;
  const done = tasks.filter(x=>x.status==='done').length;
  return (
    <div style={{height:'100%', overflow:'auto', background: `radial-gradient(ellipse at top, #1A1E3D 0%, ${C_PALETTE.bg} 55%)`, color: C_PALETTE.text, paddingBottom:90, position:'relative'}}>
      <CStarfield count={40} />
      {/* Hero constellation */}
      <div style={{padding: '20px 22px 12px', position:'relative', zIndex:1}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div style={{fontSize:11, fontWeight:800, letterSpacing:2, color: C_PALETTE.muted}}>{bi('星期三晚上','WED · NIGHT',lang)}</div>
          <div style={{display:'flex', gap:6, alignItems:'center', background: C_PALETTE.surface, padding: '6px 12px', borderRadius: 9999, border: `1px solid ${C_PALETTE.border}`}}>
            <RoughStar size={14} />
            <span style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:14, color: C_PALETTE.star}}>{kid.stars}</span>
          </div>
        </div>
        <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize: 30, lineHeight: 1.05, marginTop: 14, letterSpacing:'-0.01em'}}>
          {bi('嗨 ','Hey ', lang)}<span style={{color: C_PALETTE.primary}}>{bi(kid.zh, kid.name, lang)}</span>,<br/>
          {bi('收集一點星光 ✨', 'collect some starlight ✨', lang)}
        </div>
        {/* Progress orbit */}
        <div style={{marginTop:20, display:'flex', alignItems:'center', gap:14}}>
          <div style={{position:'relative', width:62, height:62}}>
            <svg width="62" height="62" viewBox="0 0 62 62">
              <circle cx="31" cy="31" r="26" fill="none" stroke={C_PALETTE.surfaceHi} strokeWidth="5" />
              <circle cx="31" cy="31" r="26" fill="none" stroke={C_PALETTE.primary} strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(done/tasks.length)*163.4} 200`} transform="rotate(-90 31 31)" />
            </svg>
            <div style={{position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:18}}>{done}/{tasks.length}</div>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:14, fontWeight:700}}>{load==='light' ? bi('只剩一個小任務', 'Just one task tonight', lang) : bi(`還有 ${tasks.length-done} 個任務`, `${tasks.length-done} missions left`, lang)}</div>
            <div style={{fontSize:12, color: C_PALETTE.muted, marginTop:2}}>{bi('做完就能解鎖獎勵', 'finish to unlock rewards', lang)}</div>
          </div>
        </div>
      </div>
      {/* Task cards — stacked chunky */}
      <div style={{padding:'18px 22px 0', position:'relative', zIndex:1}}>
        {tasks.map((x,i)=>{
          const isDone = x.status==='done', isPending = x.status==='pending';
          return (
            <div key={x.id} style={{display:'flex', gap:14, alignItems:'center', padding:'14px 16px', background: C_PALETTE.surface, border:`1px solid ${C_PALETTE.border}`, borderRadius: 18, marginBottom: 10, opacity: isDone?0.55:1, position:'relative', overflow:'hidden'}}>
              {isDone && <div style={{position:'absolute', top:-10, right:-10}}><RoughStar size={46} color={C_PALETTE.primary} rot={24} /></div>}
              <div style={{width:44, height:44, borderRadius:12, background: isDone? 'rgba(61,217,155,0.15)' : isPending?'rgba(245,166,35,0.15)':'rgba(232,217,122,0.12)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
                <GeomIcon kind={iconForTask(x)} size={28} color={isDone?C_PALETTE.green:isPending?C_PALETTE.accent:C_PALETTE.primary} accent={C_PALETTE.accentHot} />
              </div>
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:17, textDecoration: isDone?'line-through':'none'}}>{bi(x.zh, x.en, lang)}</div>
                <div style={{fontSize:12, color: isPending?C_PALETTE.accent:isDone?C_PALETTE.green:C_PALETTE.muted, marginTop:2, fontWeight:600}}>
                  {isDone ? `✓ ${bi('已完成','Collected',lang)} ★${x.points}` : isPending ? `⏳ ${t('pendingStars')}` : `★ ${x.points} ${bi('等你','waiting',lang)}`}
                </div>
              </div>
              {!isDone && !isPending && <div style={{width:38, height:38, borderRadius:9999, background: C_PALETTE.primary, color: C_PALETTE.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:800}}>›</div>}
            </div>
          );
        })}
      </div>
      {/* Tab bar */}
      <div style={{position:'absolute', bottom:12, left:16, right:16, background: C_PALETTE.surfaceHi, borderRadius: 9999, border:`1px solid ${C_PALETTE.border}`, padding:'10px 20px', display:'flex', justifyContent:'space-around', alignItems:'center', zIndex:2, backdropFilter:'blur(8px)'}}>
        {[['tasks','home'],['rewards','star'],['me','owl']].map(([k,icon],i)=>(
          <div key={k} style={{display:'flex', flexDirection:'column', alignItems:'center', gap:2, color: i===0?C_PALETTE.primary:C_PALETTE.muted}}>
            <GeomIcon kind={icon} size={22} color={i===0?C_PALETTE.primary:C_PALETTE.muted} accent={C_PALETTE.accentHot} />
            <div style={{fontSize:10, fontWeight:700}}>{t(k)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function C_TaskDetail({ lang }) {
  const task = window.MFK_DATA.tasksFull[0];
  return (
    <div style={{height:'100%', background: C_PALETTE.bg, color: C_PALETTE.text, overflow:'auto', position:'relative'}}>
      <CStarfield count={30} />
      <div style={{padding:'16px 22px', display:'flex', justifyContent:'space-between', position:'relative', zIndex:1}}>
        <div style={{width:36, height:36, borderRadius:9999, background:C_PALETTE.surface, display:'flex', alignItems:'center', justifyContent:'center'}}>‹</div>
        <div style={{fontSize:11, fontWeight:800, letterSpacing:1.5, color:C_PALETTE.muted}}>{bi('任務·01','MISSION·01',lang)}</div>
        <div style={{width:36}}/>
      </div>
      <div style={{padding:'10px 22px', position:'relative', zIndex:1}}>
        <div style={{position:'relative', aspectRatio:'1', background:'linear-gradient(135deg, #1A1E3D 0%, #262B52 100%)', borderRadius: 28, padding: 30, display:'flex', alignItems:'center', justifyContent:'center', border: `1px solid ${C_PALETTE.border}`, overflow:'hidden'}}>
          <div style={{position:'absolute', top:20, right:20}}><RoughStar size={20} rot={18} /></div>
          <div style={{position:'absolute', bottom:24, left:24}}><RoughStar size={14} rot={-12} color="#F5A623" /></div>
          <div style={{position:'absolute', top:'30%', left:'12%', opacity:0.4}}><Blob size={70} color={C_PALETTE.surface} seed={2} /></div>
          <GeomIcon kind={iconForTask(task)} size={140} color={C_PALETTE.primary} accent={C_PALETTE.accentHot} />
        </div>
      </div>
      <div style={{padding:'18px 22px', position:'relative', zIndex:1}}>
        <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:30, lineHeight:1.1}}>{bi(task.zh, task.en, lang)}</div>
        <div style={{display:'flex', gap:8, marginTop:12}}>
          <div style={{padding:'6px 12px', background: 'rgba(232,217,122,0.14)', color: C_PALETTE.primary, borderRadius:9999, fontSize:12, fontWeight:700}}>★ {task.points} {bi('星光','starlight',lang)}</div>
          <div style={{padding:'6px 12px', background: C_PALETTE.surface, color: C_PALETTE.muted, borderRadius:9999, fontSize:12, fontWeight:700}}>{bi('今天','Today',lang)}</div>
        </div>
        <div style={{marginTop:18, padding:16, background: C_PALETTE.surface, borderRadius: 16, border:`1px solid ${C_PALETTE.border}`, display:'flex', gap:12}}>
          <Owl size={38} mood="watch" direction="C" />
          <div>
            <div style={{fontSize:11, color: C_PALETTE.muted, fontWeight:700, letterSpacing:0.5}}>{bi('媽媽的暗號', 'MOM WHISPERS', lang)}</div>
            <div style={{fontFamily:'var(--font-display)', fontSize:14, fontStyle:'italic', marginTop:2}}>{bi('"書本和鉛筆都要收好喔"', '"Books and pencils, tidy them up!"', lang)}</div>
          </div>
        </div>
      </div>
      <div style={{position:'absolute', bottom:20, left:22, right:22, background: C_PALETTE.primary, color: C_PALETTE.bg, padding: 18, borderRadius: 9999, textAlign:'center', fontFamily:'var(--font-display)', fontWeight:800, fontSize:17, boxShadow:'0 8px 24px rgba(232,217,122,0.25)'}}>📷 {bi('拍一張照片','Snap a photo',lang)}</div>
    </div>
  );
}

function C_Camera({ lang }) {
  const task = window.MFK_DATA.tasksFull[0];
  return (
    <div style={{height:'100%', background:'#050613', color:C_PALETTE.text, display:'flex', flexDirection:'column', position:'relative'}}>
      <CStarfield count={50} />
      <div style={{padding:'16px 22px', display:'flex', justifyContent:'space-between', alignItems:'center', position:'relative', zIndex:2}}>
        <div style={{width:36, height:36, borderRadius:9999, background:'rgba(255,255,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff'}}>✕</div>
        <div style={{padding:'6px 14px', borderRadius:9999, background:'rgba(245,166,35,0.2)', color:C_PALETTE.accent, fontSize:11, fontWeight:800, letterSpacing:1}}>● REC</div>
        <div style={{width:36}}/>
      </div>
      <div style={{flex:1, margin:'0 22px', borderRadius: 28, background: 'linear-gradient(180deg,#1A1E3D,#0F1228)', position:'relative', overflow:'hidden', border:`1px solid ${C_PALETTE.border}`}}>
        {/* dashed capture frame */}
        <div style={{position:'absolute', inset:20, border:`2px dashed ${C_PALETTE.primary}`, borderRadius:20, opacity:0.5}}/>
        <div style={{position:'absolute', top:40, left:40, color:C_PALETTE.primary, fontSize:11, fontWeight:800, letterSpacing:1.2}}>{bi(task.zh, task.en, lang)}</div>
        <div style={{position:'absolute', bottom:60, left:30, right:30, height:80, background: 'linear-gradient(180deg,#3a3428,#2a251d)', borderRadius:12, opacity:0.6}} />
        <div style={{position:'absolute', bottom:12, right:12, padding:6, background:'rgba(26,30,61,0.85)', borderRadius:12, border:`1px solid ${C_PALETTE.border}`, display:'flex', alignItems:'center', gap:6}}>
          <Owl size={34} mood="watch" direction="C" />
          <div style={{fontSize:10, fontWeight:800, color:C_PALETTE.muted, paddingRight:4}}>{bi('Pip 陪你','Pip w/ you',lang)}</div>
        </div>
      </div>
      <div style={{padding:'24px 22px 34px', display:'flex', alignItems:'center', justifyContent:'center', gap:24, position:'relative', zIndex:2}}>
        <div style={{width:44, height:44, borderRadius:9999, background:C_PALETTE.surface, display:'flex', alignItems:'center', justifyContent:'center', color:C_PALETTE.muted, fontSize:18}}>⤓</div>
        <div style={{width:80, height:80, borderRadius:9999, background:C_PALETTE.primary, border:'6px solid rgba(232,217,122,0.25)', boxShadow:'0 0 32px rgba(232,217,122,0.4)'}} />
        <div title={bi('切換前後鏡頭','Flip camera',lang)} style={{width:44, height:44, borderRadius:9999, background:C_PALETTE.surface, display:'flex', alignItems:'center', justifyContent:'center', color:C_PALETTE.text, position:'relative'}}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="6" width="18" height="13" rx="2.5"/>
            <circle cx="12" cy="12.5" r="3.2"/>
            <path d="M9 12.5a3 3 0 0 1 5-2.2"/>
            <path d="M15 12.5a3 3 0 0 1-5 2.2"/>
            <path d="M8 5.5l1.2-1.2h5.6L16 5.5"/>
          </svg>
        </div>
        <div style={{width:44, height:44, borderRadius:9999, background:C_PALETTE.surface, display:'flex', alignItems:'center', justifyContent:'center', color:C_PALETTE.muted, fontSize:18}}>↻</div>
      </div>
    </div>
  );
}

function C_AIReview({ lang }) {
  return (
    <div style={{height:'100%', background:`radial-gradient(circle at 50% 40%, ${C_PALETTE.surfaceHi} 0%, ${C_PALETTE.bg} 70%)`, color:C_PALETTE.text, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24, position:'relative'}}>
      <CStarfield count={60} />
      <div style={{position:'relative'}}>
        <div style={{position:'absolute', inset:-30, borderRadius:9999, border:`2px dashed ${C_PALETTE.primary}`, opacity:0.4, animation:'cspin 8s linear infinite'}} />
        <div style={{position:'absolute', inset:-50, borderRadius:9999, border:`1px dashed ${C_PALETTE.primary}`, opacity:0.2, animation:'cspin 12s linear infinite reverse'}} />
        <Owl size={140} mood="think" direction="C" />
      </div>
      <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:26, marginTop:30, textAlign:'center', lineHeight:1.2}}>{bi('星光正在傳送…', 'Starlight is traveling…', lang)}</div>
      <div style={{fontSize:13, color:C_PALETTE.muted, marginTop:10, textAlign:'center', maxWidth:260, lineHeight:1.5}}>{bi('Pip 正在幫你把今天的成果送出去', 'Pip is carrying your work across the sky', lang)}</div>
      <div style={{marginTop:28, display:'flex', gap:6}}>
        {[0,1,2].map(i=><div key={i} style={{width:8, height:8, borderRadius:9999, background:C_PALETTE.primary, animation:`cpulse 1.2s ${i*0.2}s ease-in-out infinite`}}/>)}
      </div>
      <style>{`@keyframes cspin{to{transform:rotate(360deg)}}@keyframes cpulse{0%,100%{opacity:0.2}50%{opacity:1}}`}</style>
    </div>
  );
}

function C_Pending({ lang }) {
  const task = window.MFK_DATA.tasksFull[0];
  return (
    <div style={{height:'100%', background:C_PALETTE.bg, color:C_PALETTE.text, position:'relative', display:'flex', flexDirection:'column'}}>
      <CStarfield count={40} />
      {/* Sheet header: drag handle for swipe-down + explicit ✕ */}
      <div style={{padding:'10px 0 6px', display:'flex', justifyContent:'center', alignItems:'center', position:'relative', zIndex:2}}>
        <div style={{width:44, height:5, borderRadius:9999, background:'rgba(247,242,234,0.25)'}}/>
        <div title={bi('關閉','Close',lang)} style={{position:'absolute', right:18, top:8, width:32, height:32, borderRadius:9999, background:'rgba(247,242,234,0.08)', border:`1px solid ${C_PALETTE.border}`, display:'flex', alignItems:'center', justifyContent:'center', color:C_PALETTE.muted, fontSize:14}}>✕</div>
      </div>
      <div style={{padding:'0 22px 4px', fontSize:10, color:C_PALETTE.muted, textAlign:'center', letterSpacing:1.5, fontWeight:700, position:'relative', zIndex:2}}>{bi('下滑關閉 · 或點 ✕','SWIPE DOWN · OR TAP ✕',lang)}</div>
      <div style={{flex:1, overflow:'auto', padding:'8px 22px 110px', position:'relative', zIndex:1}}>
        <div style={{display:'flex', gap:6, alignItems:'center', padding:'8px 14px', background:'rgba(255,217,102,0.18)', color:C_PALETTE.primary, borderRadius:9999, fontSize:11, fontWeight:800, width:'fit-content', letterSpacing:1}}>✨ {bi('星光已送達','STARLIGHT ARRIVED',lang)}</div>
        <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:28, lineHeight:1.15, marginTop:16}}>{bi('等爸媽看看你做得多棒', 'Mom & Dad will see it soon', lang)}</div>
        <div style={{fontSize:13, color:C_PALETTE.muted, marginTop:8, lineHeight:1.5}}>{bi('星光先幫你保留著，看過就會變亮','Your starlight is safe, it will shine after they see it',lang)}</div>
        <div style={{marginTop:20, aspectRatio:'4/3', background:`linear-gradient(135deg, ${C_PALETTE.surfaceHi}, ${C_PALETTE.surface})`, borderRadius:20, border:`1px solid ${C_PALETTE.border}`, display:'flex', alignItems:'center', justifyContent:'center', position:'relative', overflow:'hidden'}}>
          <div style={{position:'absolute', top:16, left:16, padding:'4px 10px', borderRadius:9999, background:'rgba(255,217,102,0.22)', color:C_PALETTE.primary, fontSize:10, fontWeight:800, letterSpacing:1}}>✓ {bi('送達','DELIVERED',lang)}</div>
          <GeomIcon kind={iconForTask(task)} size={90} color={C_PALETTE.primary} accent={C_PALETTE.accentHot} />
        </div>
        <div style={{marginTop:16, padding:16, background:C_PALETTE.surface, borderRadius:16, border:`1px solid ${C_PALETTE.border}`, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div>
            <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:16}}>{bi(task.zh, task.en, lang)}</div>
            <div style={{fontSize:12, color:C_PALETTE.muted, marginTop:2}}>{bi('4:32 PM · 今天','4:32 PM · Today',lang)}</div>
          </div>
          <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:22, color:C_PALETTE.accent}}>☆ {task.points}</div>
        </div>
      </div>
      {/* Celebration-style footer — rewarding feel instead of a single back arrow */}
      <div style={{position:'absolute', bottom:22, left:22, right:22, zIndex:3, display:'flex', gap:10, alignItems:'center'}}>
        <div style={{flex:1, padding:'13px 14px', background:'rgba(247,242,234,0.08)', color:C_PALETTE.text, borderRadius:9999, textAlign:'center', fontFamily:'var(--font-display)', fontWeight:800, fontSize:13, border:`1px solid ${C_PALETTE.border}`}}>{bi('看獎勵','See rewards',lang)}</div>
        <div style={{flex:1.4, padding:'13px 16px', background:C_PALETTE.primary, color:C_PALETTE.bg, borderRadius:9999, textAlign:'center', fontFamily:'var(--font-display)', fontWeight:800, fontSize:14, boxShadow:'0 8px 24px rgba(255,217,102,0.28)', display:'flex', alignItems:'center', justifyContent:'center', gap:8}}>
          <RoughStar size={16} color={C_PALETTE.bg} />
          {bi('回到任務','Next mission',lang)}
        </div>
      </div>
    </div>
  );
}

function C_Celebration({ lang, motion }) {
  const t = useT(lang);
  return (
    <div style={{height:'100%', background:`radial-gradient(circle at 50% 40%, #262B52 0%, ${C_PALETTE.bg} 70%)`, color:C_PALETTE.text, padding:'24px 26px', position:'relative', overflow:'hidden'}}>
      <CStarfield count={80} />
      {motion !== 'reduce' && [...Array(18)].map((_,i)=>(
        <div key={i} style={{position:'absolute', left:`${(i*53)%95}%`, top:`${(i*37)%70}%`, animation:`cburst 1.8s ${(i*0.05)}s ease-out`}}>
          <RoughStar size={14+(i%3)*8} color={i%2?C_PALETTE.primary:C_PALETTE.accent} rot={i*28} />
        </div>
      ))}
      <div style={{position:'relative', zIndex:2, textAlign:'center', marginTop:'22%'}}>
        <div style={{display:'inline-block', position:'relative'}}>
          <RoughStar size={120} color={C_PALETTE.primary} rot={-8} />
          <div style={{position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:36, color:C_PALETTE.bg}}>+10</div>
        </div>
        <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:44, marginTop:24, lineHeight:1.05}}>{t('niceJob')}</div>
        <div style={{fontSize:14, color:C_PALETTE.muted, marginTop:8, fontFamily:'DM Sans,sans-serif'}}>{bi('總星光 ','Total starlight ',lang)}<span style={{color:C_PALETTE.primary, fontWeight:700}}>★ 152</span></div>
      </div>
      <div style={{position:'absolute', bottom:22, left:26, right:26, zIndex:2, display:'flex', gap:10}}>
        <div style={{flex:1, padding:'14px 18px', background:'rgba(245,242,232,0.08)', color:C_PALETTE.text, borderRadius:9999, textAlign:'center', fontSize:13, fontWeight:700, border:`1px solid ${C_PALETTE.border}`}}>{bi('看獎勵','See rewards',lang)}</div>
        <div style={{flex:1, padding:'14px 18px', background:C_PALETTE.primary, color:C_PALETTE.bg, borderRadius:9999, textAlign:'center', fontSize:13, fontWeight:800}}>{bi('下一個','Next',lang)} →</div>
      </div>
      <style>{`@keyframes cburst{0%{transform:scale(0) rotate(0);opacity:0}30%{opacity:1}100%{transform:scale(1.2) rotate(260deg);opacity:0}}`}</style>
    </div>
  );
}

function C_Rewards({ lang, kid }) {
  const t = useT(lang);
  return (
    <div style={{height:'100%', background:C_PALETTE.bg, color:C_PALETTE.text, overflow:'auto', paddingBottom:100, position:'relative'}}>
      <CStarfield count={30} />
      <div style={{padding:'20px 22px 0', position:'relative', zIndex:1}}>
        <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:30, lineHeight:1}}>{bi('星光商店','Starlight Shop',lang)}</div>
        <div style={{marginTop:14, padding:'16px 18px', background:`linear-gradient(135deg, ${C_PALETTE.primary}, ${C_PALETTE.accent})`, color:C_PALETTE.bg, borderRadius:20, display:'flex', justifyContent:'space-between', alignItems:'center', position:'relative', overflow:'hidden'}}>
          <div style={{position:'absolute', top:-10, right:-10}}><RoughStar size={80} color="rgba(255,255,255,0.2)" rot={12}/></div>
          <div style={{position:'relative'}}>
            <div style={{fontSize:11, fontWeight:800, letterSpacing:1, opacity:0.8}}>{bi('你的星光','YOUR STARLIGHT',lang)}</div>
            <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:40, lineHeight:1, marginTop:4}}>★ {kid.stars}</div>
          </div>
        </div>
      </div>
      <div style={{padding:'18px 22px 0', display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, position:'relative', zIndex:1}}>
        {window.MFK_DATA.rewards.map(r=>{
          const ok = kid.stars >= r.cost;
          return (
            <div key={r.id} style={{background: C_PALETTE.surface, border:`1px solid ${C_PALETTE.border}`, borderRadius:18, padding:14, opacity: ok?1:0.55, position:'relative', overflow:'hidden'}}>
              <div style={{aspectRatio:'1.1', background: `linear-gradient(135deg, ${r.color}55, ${r.color}22)`, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', fontSize:44}}>{r.emoji}</div>
              <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:14, marginTop:10, lineHeight:1.15}}>{bi(r.zh, r.en, lang)}</div>
              <div style={{fontSize:12, fontWeight:700, color: ok?C_PALETTE.primary:C_PALETTE.muted, marginTop:4}}>★ {r.cost}{!ok && ` · ${t('needMore',{n:r.cost-kid.stars})}`}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function C_Order({ lang }) {
  const steps = [
    {zh:'已下單',en:'Ordered',done:true, when:'Yesterday'},
    {zh:'爸媽確認',en:'Parent confirmed',done:true, when:'Yesterday'},
    {zh:'已交付',en:'Delivered',current:true, when:'Today 4pm'},
    {zh:'你確認收到',en:'You confirm',done:false, when:'—'},
  ];
  return (
    <div style={{height:'100%', background:C_PALETTE.bg, color:C_PALETTE.text, position:'relative', display:'flex', flexDirection:'column'}}>
      <CStarfield count={30} />
      {/* Sheet header: drag handle + explicit ✕ */}
      <div style={{padding:'10px 0 6px', display:'flex', justifyContent:'center', alignItems:'center', position:'relative', zIndex:2}}>
        <div style={{width:44, height:5, borderRadius:9999, background:'rgba(247,242,234,0.25)'}}/>
        <div title={bi('關閉','Close',lang)} style={{position:'absolute', right:18, top:8, width:32, height:32, borderRadius:9999, background:'rgba(247,242,234,0.08)', border:`1px solid ${C_PALETTE.border}`, display:'flex', alignItems:'center', justifyContent:'center', color:C_PALETTE.muted, fontSize:14}}>✕</div>
      </div>
      <div style={{padding:'0 22px 4px', fontSize:10, color:C_PALETTE.muted, textAlign:'center', letterSpacing:1.5, fontWeight:700, position:'relative', zIndex:2}}>{bi('下滑關閉 · 或點 ✕','SWIPE DOWN · OR TAP ✕',lang)}</div>
      <div style={{flex:1, overflow:'auto', padding:'4px 22px 110px', position:'relative', zIndex:1}}>
        <div style={{fontSize:11, fontWeight:800, letterSpacing:1.5, color:C_PALETTE.muted}}>{bi('獎勵進行中','REWARD IN FLIGHT',lang)}</div>
        <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:30, marginTop:4}}>{bi('吃冰淇淋','Ice cream trip',lang)}</div>
        <div style={{display:'flex', alignItems:'center', gap:12, marginTop:16, padding:14, background:C_PALETTE.surface, borderRadius:18, border:`1px solid ${C_PALETTE.border}`}}>
          <div style={{width:58, height:58, borderRadius:14, background:'linear-gradient(135deg,#FFCFA3,#F5A623)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:32}}>🍦</div>
          <div style={{flex:1}}>
            <div style={{fontSize:11, color:C_PALETTE.muted, fontWeight:700, letterSpacing:0.8}}>#0042</div>
            <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:22, color:C_PALETTE.accent}}>− ★ 50</div>
          </div>
        </div>
        <div style={{marginTop:26, position:'relative'}}>
          {steps.map((s,i)=>(
            <div key={i} style={{display:'flex', gap:14, paddingBottom:20, position:'relative'}}>
              <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
                <div style={{width:28, height:28, borderRadius:9999, background: s.done?C_PALETTE.green:s.current?C_PALETTE.primary:C_PALETTE.surface, color: s.done||s.current?C_PALETTE.bg:C_PALETTE.muted, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, border: s.current?`2px solid ${C_PALETTE.primary}`:`1px solid ${C_PALETTE.border}`, zIndex:1}}>{s.done?'✓':i+1}</div>
                {i<steps.length-1 && <div style={{flex:1, width:2, background: s.done?C_PALETTE.green:C_PALETTE.border, marginTop:4, minHeight:28}}/>}
              </div>
              <div style={{flex:1, paddingTop:2}}>
                <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:16, color: s.current?C_PALETTE.primary:s.done?C_PALETTE.text:C_PALETTE.muted}}>{bi(s.zh,s.en,lang)}</div>
                <div style={{fontSize:12, color:C_PALETTE.muted, marginTop:2}}>{s.when}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{position:'absolute', bottom:22, left:22, right:22, zIndex:3, display:'flex', gap:10}}>
        <div style={{flex:1, padding:'14px 16px', background:'rgba(247,242,234,0.08)', color:C_PALETTE.text, borderRadius:9999, textAlign:'center', fontFamily:'var(--font-display)', fontWeight:800, fontSize:14, border:`1px solid ${C_PALETTE.border}`}}>{bi('取消訂單','Cancel order',lang)}</div>
        <div style={{flex:2, padding:'14px 16px', background:C_PALETTE.primary, color:C_PALETTE.bg, borderRadius:9999, textAlign:'center', fontFamily:'var(--font-display)', fontWeight:800, fontSize:15}}>{bi('回到任務','Back to missions',lang)}</div>
      </div>
    </div>
  );
}

function C_ParentAssign({ lang }) {
  return (
    <div style={{height:'100%', background:C_PALETTE.bg, color:C_PALETTE.text, overflow:'auto', paddingBottom:30, position:'relative'}}>
      <CStarfield count={20} />
      <div style={{padding:'16px 22px', display:'flex', justifyContent:'space-between', alignItems:'center', position:'relative', zIndex:1}}>
        <div style={{fontSize:18, color:C_PALETTE.muted}}>✕</div>
        <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:16}}>{bi('新任務','New mission',lang)}</div>
        <div style={{padding:'6px 14px', borderRadius:9999, background:C_PALETTE.primary, color:C_PALETTE.bg, fontSize:12, fontWeight:800}}>{bi('發佈','Publish',lang)}</div>
      </div>
      <div style={{padding:'8px 22px', position:'relative', zIndex:1}}>
        <div style={{padding:18, background:C_PALETTE.surface, borderRadius:20, border:`1px solid ${C_PALETTE.border}`}}>
          <div style={{fontSize:11, fontWeight:800, color:C_PALETTE.muted, letterSpacing:1}}>{bi('任務名稱','TITLE',lang)}</div>
          <input defaultValue={bi('整理書桌','Clean your desk',lang)} style={{border:0, background:'transparent', color:C_PALETTE.text, fontFamily:'var(--font-display)', fontWeight:800, fontSize:22, width:'100%', marginTop:6, outline:'none', padding:0}} />
          <div style={{marginTop:18, display:'flex', gap:10}}>
            <div style={{flex:1, padding:'10px 12px', background:C_PALETTE.bg, borderRadius:12, border:`1px solid ${C_PALETTE.border}`}}>
              <div style={{fontSize:10, fontWeight:800, color:C_PALETTE.muted, letterSpacing:1}}>★ {bi('星光','STARLIGHT',lang)}</div>
              <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:22, color:C_PALETTE.primary, marginTop:2}}>10</div>
            </div>
            <div style={{flex:1, padding:'10px 12px', background:C_PALETTE.bg, borderRadius:12, border:`1px solid ${C_PALETTE.border}`}}>
              <div style={{fontSize:10, fontWeight:800, color:C_PALETTE.muted, letterSpacing:1}}>{bi('頻率','FREQ',lang)}</div>
              <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:16, marginTop:4}}>{bi('每日','Daily',lang)}</div>
            </div>
          </div>
        </div>
        <div style={{marginTop:16, padding:16, background:C_PALETTE.surface, borderRadius:20, border:`1px solid ${C_PALETTE.border}`}}>
          <div style={{fontSize:11, fontWeight:800, color:C_PALETTE.muted, letterSpacing:1}}>{bi('指派給','ASSIGN TO',lang)}</div>
          <div style={{display:'flex', gap:10, marginTop:12}}>
            {window.MFK_DATA.family.kids.map((k,i)=>(
              <div key={k.id} style={{flex:1, padding:12, borderRadius:14, background: i===0?'rgba(232,217,122,0.12)':C_PALETTE.bg, border: i===0?`2px solid ${C_PALETTE.primary}`:`1px solid ${C_PALETTE.border}`, display:'flex', alignItems:'center', gap:8}}>
                <div style={{width:28, height:28, borderRadius:9999, background:k.color, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800}}>{bi(k.zh[0], k.name[0], lang)}</div>
                <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:14}}>{bi(k.zh, k.name, lang)}</div>
                {i===0 && <div style={{marginLeft:'auto', color:C_PALETTE.primary, fontSize:12, fontWeight:800}}>✓</div>}
              </div>
            ))}
          </div>
        </div>
        <div style={{marginTop:16, padding:16, background:C_PALETTE.surface, borderRadius:20, border:`1px solid ${C_PALETTE.border}`}}>
          <div style={{fontSize:11, fontWeight:800, color:C_PALETTE.muted, letterSpacing:1}}>{bi('審核方式','REVIEW MODE',lang)}</div>
          <div style={{display:'flex', gap:8, marginTop:10, flexWrap:'wrap'}}>
            {['auto','semi','manual'].map((m,i)=>(
              <div key={m} style={{padding:'8px 14px', borderRadius:9999, background: i===1?C_PALETTE.primary:'transparent', color: i===1?C_PALETTE.bg:C_PALETTE.text, border:`1px solid ${i===1?C_PALETTE.primary:C_PALETTE.border}`, fontSize:12, fontWeight:700}}>{m==='auto'?bi('自動','Auto',lang):m==='semi'?bi('半自動','Semi',lang):bi('我決定','Manual',lang)}</div>
            ))}
          </div>
          <div style={{fontSize:12, color:C_PALETTE.muted, marginTop:10, lineHeight:1.5}}>{bi('AI 先幫你看，不確定的才送到你這裡。', 'AI screens first; only uncertain ones come to you.', lang)}</div>
        </div>
      </div>
    </div>
  );
}

function C_ParentReview({ lang, load }) {
  const t = useT(lang);
  const subs = load==='light' ? [] : window.MFK_DATA.reviewQueue;
  const urgent = subs.filter(s=>s.ai!=='pass');
  const passed = subs.filter(s=>s.ai==='pass');
  return (
    <div style={{height:'100%', background:C_PALETTE.bg, color:C_PALETTE.text, position:'relative', display:'flex', flexDirection:'column'}}><div style={{flex:1, overflow:'auto', paddingBottom:20, position:'relative'}}>
      <CStarfield count={30} />
      <div style={{padding:'20px 22px', position:'relative', zIndex:1}}>
        <div style={{fontSize:11, fontWeight:800, letterSpacing:1.5, color:C_PALETTE.muted}}>{bi('今天 · 審核','TODAY · REVIEW',lang)}</div>
        <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:32, marginTop:2}}>{subs.length === 0 ? t('allCaught') : bi(`${subs.length} 個等你看`, `${subs.length} waiting on you`, lang)}</div>
        {subs.length === 0 && <div style={{marginTop:14, padding:16, background:C_PALETTE.surface, borderRadius:16, border:`1px solid ${C_PALETTE.border}`, display:'flex', gap:12, alignItems:'center'}}>
          <Owl size={48} mood="cheer" direction="C" />
          <div style={{fontSize:13, color:C_PALETTE.muted}}>{bi('AI 都處理好了，去陪孩子吧 ✨', 'AI handled everything — go be with your kids ✨', lang)}</div>
        </div>}
      </div>
      {urgent.length>0 && <div style={{padding:'4px 22px 8px', position:'relative', zIndex:1}}>
        <div style={{fontSize:11, fontWeight:800, letterSpacing:1.5, color:C_PALETTE.accentHot, marginBottom:10}}>⚠ {bi('需要你決定','NEEDS YOUR CALL',lang)} · {urgent.length}</div>
        {urgent.map(s=><CReviewCard key={s.id} sub={s} lang={lang} />)}
      </div>}
      {passed.length>0 && <div style={{padding:'12px 22px 8px', position:'relative', zIndex:1}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10}}>
          <div style={{fontSize:11, fontWeight:800, letterSpacing:1.5, color:C_PALETTE.green}}>✓ AI {bi('通過','APPROVED',lang)} · {passed.length}</div>
          <div style={{padding:'6px 14px', borderRadius:9999, background:C_PALETTE.primary, color:C_PALETTE.bg, fontSize:11, fontWeight:800}}>{t('approveAll')}</div>
        </div>
        {passed.map(s=><CReviewCard key={s.id} sub={s} lang={lang} />)}
      </div>}
      </div>
      <window.TabBar role="parent" active="review" lang={lang} direction="C" />
    </div>
  );
}

function CReviewCard({ sub, lang }) {
  const colors = { pass:C_PALETTE.green, uncertain:C_PALETTE.accent, fail:C_PALETTE.accentHot };
  return (
    <div style={{display:'flex', gap:12, alignItems:'center', padding:12, background:C_PALETTE.surface, borderRadius:16, border:`1px solid ${C_PALETTE.border}`, marginBottom:8}}>
      <div style={{width:56, height:56, borderRadius:12, background:sub.photo, flexShrink:0, border:`2px solid ${colors[sub.ai]}`}}/>
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontSize:10, fontWeight:800, color:colors[sub.ai], letterSpacing:1}}>AI {sub.ai==='pass'?'✓':sub.ai==='uncertain'?'?':'✗'}</div>
        <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:15, marginTop:2}}>{bi(sub.taskZh, sub.taskEn, lang)}</div>
        <div style={{fontSize:11, color:C_PALETTE.muted}}>{sub.kid} · {sub.when} · ★{sub.points}</div>
      </div>
      <div style={{display:'flex', flexDirection:'column', gap:4}}>
        <div style={{width:32, height:32, borderRadius:9999, background:C_PALETTE.green, color:C_PALETTE.bg, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800}}>✓</div>
        <div style={{width:32, height:32, borderRadius:9999, background:'transparent', color:C_PALETTE.accentHot, border:`1px solid ${C_PALETTE.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800}}>✕</div>
      </div>
    </div>
  );
}

// ----- 11 Parent · Rewards setup (set up reward catalog) -----
function C_ParentRewards({ lang }) {
  const rewards = window.MFK_DATA.rewards;
  return (
    <div style={{height:'100%', background:C_PALETTE.bg, color:C_PALETTE.text, overflow:'auto', paddingBottom:40, position:'relative'}}>
      <CStarfield count={20} />
      <div style={{padding:'18px 22px 8px', position:'relative', zIndex:1, display:'flex', justifyContent:'space-between', alignItems:'flex-end'}}>
        <div>
          <div style={{fontSize:11, fontWeight:800, letterSpacing:1.5, color:C_PALETTE.muted}}>{bi('禮物目錄','REWARDS CATALOG',lang)}</div>
          <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:28, marginTop:2, lineHeight:1.1}}>{bi('小美 可以換的','What Mei can earn',lang)}</div>
        </div>
        <div style={{padding:'8px 14px', borderRadius:9999, background:C_PALETTE.primary, color:C_PALETTE.bg, fontSize:12, fontWeight:800, whiteSpace:'nowrap'}}>+ {bi('新增','New',lang)}</div>
      </div>
      <div style={{padding:'8px 22px 0', position:'relative', zIndex:1}}>
        <div style={{display:'flex', gap:8, marginBottom:14}}>
          <div style={{padding:'7px 14px', borderRadius:9999, background:C_PALETTE.primary, color:C_PALETTE.bg, fontSize:12, fontWeight:800}}>{bi('可兌換','Active',lang)} · 4</div>
          <div style={{padding:'7px 14px', borderRadius:9999, background:'transparent', color:C_PALETTE.muted, fontSize:12, fontWeight:700, border:`1px solid ${C_PALETTE.border}`}}>{bi('草稿','Draft',lang)} · 2</div>
        </div>
        {rewards.slice(0,5).map((r,i)=>(
          <div key={r.id} style={{display:'flex', alignItems:'center', gap:12, padding:14, marginBottom:8, background: i===0?C_PALETTE.surfaceCream:C_PALETTE.surface, color: i===0?'#1C1A14':C_PALETTE.text, borderRadius:16, border: i===0?'none':`1px solid ${C_PALETTE.border}`}}>
            <div style={{width:52, height:52, borderRadius:12, background:`linear-gradient(135deg, ${r.color}, ${r.color}dd)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, flexShrink:0}}>{r.emoji}</div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:16, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{bi(r.zh, r.en, lang)}</div>
              <div style={{fontSize:11, color: i===0?'#8A8275':C_PALETTE.muted, marginTop:2}}>{bi('每週最多 1 次', 'Max 1/week', lang)} · {r.affordable?bi('上架中','Active',lang):bi('需家長同意','Approval needed',lang)}</div>
            </div>
            <div style={{textAlign:'right', flexShrink:0}}>
              <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:18, color: i===0?C_PALETTE.primaryDark:C_PALETTE.primary}}>★ {r.cost}</div>
              <div style={{fontSize:10, color: i===0?'#8A8275':C_PALETTE.muted, marginTop:2}}>{bi('編輯 →','Edit →',lang)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ----- 12 Parent · Redeem confirm (child asked to cash in a reward) -----
function C_ParentRedeemConfirm({ lang, kid }) {
  return (
    <div style={{height:'100%', background:`radial-gradient(circle at 50% 30%, ${C_PALETTE.surfaceHi} 0%, ${C_PALETTE.bg} 70%)`, color:C_PALETTE.text, overflow:'auto', paddingBottom:40, position:'relative'}}>
      <CStarfield count={30} />
      <div style={{padding:'18px 22px', position:'relative', zIndex:1}}>
        <div style={{fontSize:18, color:C_PALETTE.muted}}>✕</div>
      </div>
      <div style={{padding:'0 22px', position:'relative', zIndex:1, textAlign:'center'}}>
        <div style={{fontSize:11, fontWeight:800, letterSpacing:1.5, color:C_PALETTE.accent}}>⏳ {bi('兌換要求','REDEEM REQUEST',lang)}</div>
        <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:26, marginTop:8, lineHeight:1.2}}>{bi(`${kid?.zh || '小美'} 想要換…`, `${kid?.name || 'Mei'} wants to cash in…`, lang)}</div>
      </div>
      <div style={{margin:'22px 22px 0', padding:22, background:C_PALETTE.surfaceCream, color:'#1C1A14', borderRadius:22, position:'relative', zIndex:1, textAlign:'center'}}>
        <div style={{width:96, height:96, borderRadius:22, background:'linear-gradient(135deg,#FFCFA3,#F5A623)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:52, margin:'0 auto'}}>🍦</div>
        <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:24, marginTop:14}}>{bi('吃冰淇淋','Ice cream trip',lang)}</div>
        <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:28, color:C_PALETTE.primaryDark, marginTop:6}}>− ★ 50</div>
        <div style={{marginTop:14, padding:'12px 14px', background:'rgba(28,26,20,0.06)', borderRadius:14, display:'flex', justifyContent:'space-between', fontSize:13}}>
          <div><div style={{fontSize:10, fontWeight:800, color:'#8A8275', letterSpacing:1}}>{bi('現有','BALANCE',lang)}</div><div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:18, marginTop:2}}>★ {kid?.stars || 142}</div></div>
          <div style={{alignSelf:'center', fontSize:22, color:'#8A8275'}}>→</div>
          <div><div style={{fontSize:10, fontWeight:800, color:'#8A8275', letterSpacing:1}}>{bi('之後','AFTER',lang)}</div><div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:18, marginTop:2}}>★ {(kid?.stars || 142) - 50}</div></div>
        </div>
        <div style={{marginTop:14, fontSize:12, color:'#6B6257', lineHeight:1.5}}>{bi('上次兌換：3 週前','Last redeemed: 3 weeks ago',lang)}</div>
      </div>
      {/* Reason / message — prompted BEFORE the buttons so "晚點再說" has a built-in explanation */}
      <div style={{margin:'18px 22px 0', padding:14, background:C_PALETTE.surface, borderRadius:14, border:`1px solid ${C_PALETTE.border}`, position:'relative', zIndex:1}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:8}}>
          <div style={{fontSize:10, fontWeight:800, letterSpacing:1.2, color:C_PALETTE.muted}}>{bi('跟孩子說一聲','A WORD FOR YOUR KID',lang)}</div>
          <div style={{fontSize:10, fontWeight:800, color:C_PALETTE.accent, letterSpacing:0.5}}>{bi('晚點再說 · 必填','Not now · required',lang)}</div>
        </div>
        <div style={{marginTop:8, padding:'10px 12px', background:C_PALETTE.bg, borderRadius:10, border:`1px dashed ${C_PALETTE.border}`, fontSize:13, color:C_PALETTE.text, lineHeight:1.5, minHeight:44}}>
          {bi('今天先不吃冰，這週末帶你去 😋','Not today — let\'s do it this weekend 😋',lang)}
        </div>
        {/* Quick-reply chips, especially for 晚點再說 */}
        <div style={{display:'flex', gap:6, flexWrap:'wrap', marginTop:10}}>
          {[
            bi('週末再說','This weekend',lang),
            bi('今天太晚了','Too late today',lang),
            bi('先做完功課','After homework',lang),
            bi('下次再答應','Next time',lang),
          ].map((txt,i)=>(
            <div key={i} style={{padding:'6px 10px', borderRadius:9999, background:'rgba(245,166,35,0.12)', color:C_PALETTE.accent, fontSize:11, fontWeight:700, border:`1px solid ${C_PALETTE.border}`}}>{txt}</div>
          ))}
        </div>
      </div>
      {/* Action buttons — moved to the bottom so the reason comes first */}
      <div style={{padding:'16px 22px 0', position:'relative', zIndex:1, display:'flex', gap:10}}>
        <div style={{flex:1, padding:'14px', textAlign:'center', borderRadius:14, background:'transparent', border:`1px solid ${C_PALETTE.border}`, color:C_PALETTE.text, fontFamily:'var(--font-display)', fontWeight:800, fontSize:15}}>{bi('晚點再說','Not now',lang)}</div>
        <div style={{flex:2, padding:'14px', textAlign:'center', borderRadius:14, background:C_PALETTE.primary, color:C_PALETTE.bg, fontFamily:'var(--font-display)', fontWeight:800, fontSize:15}}>✓ {bi('好，答應她','Yes, approve',lang)}</div>
      </div>
    </div>
  );
}

// ----- 13 Parent · Task history -----
// Now just delegates to C_ParentTasksManage with the 歷程 sub-tab pre-selected.
// The sub-tabs inside that component are live — clicking 管理/歷程 swaps the view.
function C_ParentHistory({ lang }) {
  return <window.C_ParentTasksManage lang={lang} initialTab="history" />;
}

// ----- 14 Parent · Permissions & family settings -----
function C_ParentSettings({ lang }) {
  const kids = window.MFK_DATA.family.kids;
  const Row = ({label, value, toggle, danger}) => (
    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 0', borderBottom:`1px solid ${C_PALETTE.border}`}}>
      <div style={{flex:1}}>
        <div style={{fontFamily:'var(--font-display)', fontWeight:700, fontSize:14, color: danger?C_PALETTE.accentHot:C_PALETTE.text}}>{label}</div>
        {value && <div style={{fontSize:11, color:C_PALETTE.muted, marginTop:2, lineHeight:1.4}}>{value}</div>}
      </div>
      {toggle !== undefined ? (
        <div style={{width:40, height:22, borderRadius:9999, background: toggle?C_PALETTE.primary:C_PALETTE.surfaceHi, position:'relative', flexShrink:0}}>
          <div style={{width:18, height:18, borderRadius:9999, background:'#fff', position:'absolute', top:2, left: toggle?20:2, transition:'left 0.2s'}}/>
        </div>
      ) : <div style={{fontSize:14, color:C_PALETTE.muted, flexShrink:0}}>›</div>}
    </div>
  );
  return (
    <div style={{height:'100%', background:C_PALETTE.bg, color:C_PALETTE.text, position:'relative', display:'flex', flexDirection:'column'}}><div style={{flex:1, overflow:'auto', paddingBottom:20, position:'relative'}}>
      <CStarfield count={14} />
      <div style={{padding:'18px 22px 8px', position:'relative', zIndex:1}}>
        <div style={{fontSize:11, fontWeight:800, letterSpacing:1.5, color:C_PALETTE.muted}}>{bi('家庭設定','FAMILY SETTINGS',lang)}</div>
        <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:28, marginTop:2}}>{bi('權限與隱私','Roles & privacy',lang)}</div>
      </div>
      <div style={{padding:'10px 22px 0', position:'relative', zIndex:1}}>
        <div style={{fontSize:10, fontWeight:800, letterSpacing:1.5, color:C_PALETTE.muted, marginBottom:6, marginTop:10}}>{bi('家庭成員','MEMBERS',lang)}</div>
        <div style={{padding:'4px 14px', background:C_PALETTE.surface, borderRadius:16, border:`1px solid ${C_PALETTE.border}`, marginBottom:16}}>
          {[
            {name:bi('媽','Mom',lang), role:bi('管理員','Admin',lang), color:'#1A8A7A'},
            {name:bi('爸','Dad',lang), role:bi('管理員','Admin',lang), color:'#8A8275'},
            ...kids.map(k=>({name:bi(k.zh,k.name,lang), role:bi(`小孩 · ${k.age} 歲`, `Child · age ${k.age}`, lang), color:k.color})),
          ].map((m,i,arr)=>(
            <div key={i} style={{display:'flex', alignItems:'center', gap:12, padding:'12px 0', borderBottom: `1px solid ${C_PALETTE.border}`}}>
              <div style={{width:34, height:34, borderRadius:9999, background:m.color, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800}}>{m.name[0]}</div>
              <div style={{flex:1}}>
                <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:14}}>{m.name}</div>
                <div style={{fontSize:11, color:C_PALETTE.muted}}>{m.role}</div>
              </div>
              <div style={{fontSize:14, color:C_PALETTE.muted}}>›</div>
            </div>
          ))}
          <div style={{display:'flex', alignItems:'center', gap:12, padding:'14px 0'}}>
            <div style={{width:34, height:34, borderRadius:9999, background:'transparent', border:`1.5px dashed ${C_PALETTE.border}`, color:C_PALETTE.primary, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:800}}>+</div>
            <div style={{flex:1}}>
              <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:14, color:C_PALETTE.primary}}>{bi('新增成員','Add member',lang)}</div>
              <div style={{fontSize:11, color:C_PALETTE.muted, marginTop:2}}>{bi('邀請爸媽、阿公阿嬤或孩子','Invite a parent, grandparent, or child',lang)}</div>
            </div>
            <div style={{fontSize:14, color:C_PALETTE.muted}}>›</div>
          </div>
        </div>

        <div style={{fontSize:10, fontWeight:800, letterSpacing:1.5, color:C_PALETTE.muted, marginBottom:6}}>{bi('審核與兌換','REVIEW & REDEEM',lang)}</div>
        <div style={{padding:'0 14px', background:C_PALETTE.surface, borderRadius:16, border:`1px solid ${C_PALETTE.border}`, marginBottom:16}}>
          <Row label={bi('自動通過明確完成的任務', 'Auto-approve clear wins', lang)} value={bi('AI 有把握時直接送星光','Pass starlight instantly when confident',lang)} toggle={true} />
          <Row label={bi('兌換需要家長同意', 'Require approval to redeem', lang)} value={bi('小孩按「兌換」會先通知你','Kid taps redeem, you confirm',lang)} toggle={true} />
          <Row label={bi('每週星光上限', 'Weekly starlight cap', lang)} value={bi('150 ★','150 ★',lang)} />
        </div>

        <div style={{fontSize:10, fontWeight:800, letterSpacing:1.5, color:C_PALETTE.muted, marginBottom:6}}>{bi('隱私','PRIVACY',lang)}</div>
        <div style={{padding:'0 14px', background:C_PALETTE.surface, borderRadius:16, border:`1px solid ${C_PALETTE.border}`, marginBottom:16}}>
          <Row label={bi('照片只保留 30 天', 'Keep photos 30 days only', lang)} value={bi('到期自動刪除','Auto-delete after expiry',lang)} toggle={true} />
          <Row label={bi('不分享資料做訓練', 'No data sharing for training', lang)} toggle={true} />
        </div>

        <div style={{padding:'0 14px', background:C_PALETTE.surface, borderRadius:16, border:`1px solid ${C_PALETTE.border}`}}>
          <Row label={bi('刪除家庭帳號', 'Delete family account', lang)} danger />
        </div>
      </div>
      </div>
      <window.TabBar role="parent" active="settings" lang={lang} direction="C" />
    </div>
  );
}

Object.assign(window, { C_Home, C_TaskDetail, C_Camera, C_AIReview, C_Pending, C_Celebration, C_Rewards, C_Order, C_ParentAssign, C_ParentReview, C_ParentRewards, C_ParentRedeemConfirm, C_ParentHistory, C_ParentSettings });
