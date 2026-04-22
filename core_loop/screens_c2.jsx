/* eslint-disable */
// Direction C · Phase 2 — new nav-aware screens:
// Child: Tasks home (daily/weekly/other), Rewards+redeem history, Me page, Notifications
// Parent: Tasks management, Rewards+redeem log, Keyboard accessory demo

const C2 = {
  bg: '#1E2547', surface: '#2D3460', surfaceHi: '#3A4278', surfaceCream: '#F7F2EA',
  primary: '#FFD966', primaryDark: '#D4AF37',
  text: '#F7F2EA', muted: '#B8B6C8', border: 'rgba(247,242,234,0.18)',
  accent: '#F5A623', accentHot: '#FF6B47', green: '#5EE0A8', star: '#FFE066',
};

const CStarfield2 = ({ count = 30 }) => (
  <div style={{position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden'}}>
    {[...Array(count)].map((_,i)=>(
      <div key={i} style={{position:'absolute', left:`${(i*47)%100}%`, top:`${(i*31)%100}%`, width: i%7===0?3:1.5, height: i%7===0?3:1.5, borderRadius: 9999, background: i%9===0?'#FFE066':'#F5F2E8', opacity: 0.3 + (i%5)*0.12, boxShadow: i%7===0 ? '0 0 6px #FFE066':'none'}} />
    ))}
  </div>
);

// =========================================================
// CHILD · 01 Tasks home — grouped by daily / weekly / other
// =========================================================
function C_TasksHome({ lang, load, kid }) {
  const daily = [
    { id:'t2', zh:'刷牙', en:'Brush teeth', pts:5, status:'done', due:'晚上 9:00' },
    { id:'t1', zh:'整理書桌', en:'Clean desk', pts:10, status:'todo', due:'晚上 9:00' },
    { id:'t5', zh:'餵魚', en:'Feed the fish', pts:3, status:'done', due:'早上 8:00' },
    { id:'t6', zh:'寫作業', en:'Homework', pts:15, status:'pending', due:'晚上 8:00' },
  ];
  const weekly = [
    { id:'w1', zh:'倒垃圾', en:'Take out trash', pts:20, status:'todo', due:'週四 · 2 天後' },
    { id:'w2', zh:'整理玩具', en:'Tidy toys', pts:15, status:'todo', due:'週六 · 4 天後' },
  ];
  const other = [
    { id:'o1', zh:'寫信給阿嬤', en:'Write to Grandma', pts:30, status:'todo', due:'4月20日' },
  ];
  const items = load==='light' ? { daily: daily.slice(0,1), weekly: [], other: [] } : { daily, weekly, other };
  const allDone = Object.values(items).flat().filter(x=>x.status==='done').length;
  const all = Object.values(items).flat().length;

  const Section = ({ title, tasks, hint, accent }) => tasks.length===0 ? null : (
    <div style={{marginTop:22}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:10}}>
        <div style={{display:'flex', alignItems:'center', gap:8}}>
          <div style={{width:6, height:6, borderRadius:9999, background:accent}}/>
          <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:15, letterSpacing:1.2}}>{title}</div>
          <div style={{fontSize:11, color:C2.muted, fontFamily:'DM Sans,sans-serif'}}>{tasks.filter(t=>t.status==='done').length}/{tasks.length}</div>
        </div>
        <div style={{fontSize:11, color:C2.muted}}>{hint}</div>
      </div>
      {tasks.map(x => {
        const isDone = x.status==='done', isPending = x.status==='pending';
        return (
          <div key={x.id} style={{display:'flex', gap:12, alignItems:'center', padding:'12px 14px', background:C2.surface, border:`1px solid ${C2.border}`, borderRadius:16, marginBottom:8, opacity:isDone?0.55:1}}>
            <div style={{width:38, height:38, borderRadius:10, background: isDone?'rgba(94,224,168,0.15)':isPending?'rgba(245,166,35,0.15)':'rgba(255,217,102,0.12)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}>
              <window.GeomIcon kind={window.iconForTask(x)} size={24} color={isDone?C2.green:isPending?C2.accent:C2.primary} accent={C2.accentHot} />
            </div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:15, textDecoration:isDone?'line-through':'none'}}>{window.bi(x.zh,x.en,lang)}</div>
              <div style={{fontSize:11, color: isPending?C2.accent:isDone?C2.green:C2.muted, marginTop:2, fontWeight:600}}>{isDone?`✓ ${window.bi('拿到','got',lang)} ★${x.pts}`:isPending?`⏳ ${window.bi('星光傳送中','starlight traveling',lang)}`:`★ ${x.pts} · ${x.due}`}</div>
            </div>
            {!isDone && !isPending && <div style={{width:28, height:28, borderRadius:9999, background:C2.primary, color:C2.bg, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:800, fontSize:14}}>→</div>}
          </div>
        );
      })}
    </div>
  );

  return (
    <div style={{height:'100%', background:`radial-gradient(ellipse at top, #1A1E3D 0%, ${C2.bg} 55%)`, color:C2.text, position:'relative', display:'flex', flexDirection:'column'}}><div style={{flex:1, overflow:'auto', paddingBottom:90, position:'relative'}}>
      <CStarfield2 count={40} />
      <div style={{padding:'20px 22px 4px', position:'relative', zIndex:1}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div style={{fontSize:11, fontWeight:800, letterSpacing:2, color:C2.muted}}>{window.bi('星期三晚上','WED · NIGHT',lang)}</div>
          <div style={{display:'flex', gap:6, alignItems:'center', background:C2.surface, padding:'6px 12px', borderRadius:9999, border:`1px solid ${C2.border}`}}>
            <span style={{color:C2.star}}>★</span>
            <span style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:14, color:C2.star}}>{kid.stars}</span>
          </div>
        </div>
        <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:28, lineHeight:1.1, marginTop:12, letterSpacing:'-0.01em'}}>
          {window.bi('嗨 ','Hey ',lang)}<span style={{color:C2.primary}}>{window.bi(kid.zh,kid.name,lang)}</span>,<br/>{window.bi('今天的任務','today\'s missions',lang)}
        </div>
        <div style={{marginTop:14, padding:'10px 14px', background:C2.surface, borderRadius:14, border:`1px solid ${C2.border}`, display:'flex', alignItems:'center', gap:12}}>
          <div style={{position:'relative', width:40, height:40}}>
            <svg width="40" height="40" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="17" fill="none" stroke={C2.surfaceHi} strokeWidth="4" />
              <circle cx="20" cy="20" r="17" fill="none" stroke={C2.primary} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(allDone/all)*106.8} 200`} transform="rotate(-90 20 20)" />
            </svg>
            <div style={{position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:12}}>{allDone}</div>
          </div>
          <div style={{flex:1, fontSize:12, color:C2.muted}}>{window.bi(`${all-allDone} 個等你，收集星光`, `${all-allDone} waiting for you`,lang)}</div>
        </div>
      </div>
      <div style={{padding:'0 22px 10px', position:'relative', zIndex:1}}>
        <Section title={window.bi('每日','DAILY',lang)} tasks={items.daily} hint={window.bi('今晚結束','by tonight',lang)} accent={C2.primary} />
        <Section title={window.bi('每週','WEEKLY',lang)} tasks={items.weekly} hint={window.bi('這週任一天','anytime this week',lang)} accent={C2.accent} />
        <Section title={window.bi('其他','OTHER',lang)} tasks={items.other} hint={window.bi('特別任務','special',lang)} accent={C2.green} />
        {all===0 && <div style={{marginTop:40, textAlign:'center', color:C2.muted, fontSize:13}}>{window.bi('今天沒事，去玩吧 ✨','Nothing today — go play ✨',lang)}</div>}
      </div>
      </div><window.TabBar role="child" active="tasks" lang={lang} direction="C" />
    </div>
  );
}

// =========================================================
// CHILD · Rewards tab (with redeem history sub-tab)
// =========================================================
function C_ChildRewardsTab({ lang, kid }) {
  const [tab, setTab] = React.useState('shop');
  const rewards = window.MFK_DATA.rewards;
  const history = [
    { zh:'吃冰淇淋', en:'Ice cream', emoji:'🍦', cost:50, state:'enjoyed', when: window.bi('3 週前','3 weeks ago',lang) },
    { zh:'遊戲 30 分鐘', en:'30 min game', emoji:'🎮', cost:30, state:'enjoyed', when: window.bi('上週','Last week',lang) },
    { zh:'選電影', en:'Pick a movie', emoji:'🎬', cost:100, state:'waiting', when: window.bi('今天','Today',lang) },
  ];
  return (
    <div style={{height:'100%', background:C2.bg, color:C2.text, position:'relative', display:'flex', flexDirection:'column'}}><div style={{flex:1, overflow:'auto', paddingBottom:20, position:'relative'}}>
      <CStarfield2 count={20} />
      <div style={{padding:'20px 22px 0', position:'relative', zIndex:1}}>
        <div style={{fontSize:11, fontWeight:800, letterSpacing:1.5, color:C2.muted}}>{window.bi('獎勵','REWARDS',lang)}</div>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:4}}>
          <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:28}}>{window.bi('你有 ','You have ',lang)}<span style={{color:C2.primary}}>★ {kid.stars}</span></div>
        </div>
        <div style={{display:'flex', gap:4, marginTop:16, background:C2.surface, padding:4, borderRadius:12, border:`1px solid ${C2.border}`}}>
          {[{k:'shop',zh:'可兌換',en:'Shop'},{k:'history',zh:'我換過的',en:'History'}].map(t=>(
            <div key={t.k} onClick={()=>setTab(t.k)} style={{flex:1, padding:'9px 8px', textAlign:'center', borderRadius:9, background: tab===t.k?C2.primary:'transparent', color: tab===t.k?C2.bg:C2.muted, fontSize:12, fontWeight:800, cursor:'pointer'}}>{window.bi(t.zh,t.en,lang)}</div>
          ))}
        </div>
      </div>
      {tab==='shop' ? (
        <div style={{padding:'18px 22px 0', display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, position:'relative', zIndex:1}}>
          {rewards.map(r=>(
            <div key={r.id} style={{padding:14, borderRadius:16, background:C2.surface, border:`1px solid ${C2.border}`, opacity:r.affordable?1:0.5, position:'relative'}}>
              <div style={{width:52, height:52, borderRadius:12, background:`linear-gradient(135deg,${r.color},${r.color}dd)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:26}}>{r.emoji}</div>
              <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:13, marginTop:10, lineHeight:1.2}}>{window.bi(r.zh,r.en,lang)}</div>
              <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:15, color: r.affordable?C2.primary:C2.muted, marginTop:4}}>★ {r.cost}</div>
              {!r.affordable && <div style={{fontSize:10, color:C2.muted, marginTop:2}}>{window.bi(`還差 ${r.cost - kid.stars}`,`${r.cost-kid.stars} more`,lang)}</div>}
            </div>
          ))}
        </div>
      ) : (
        <div style={{padding:'18px 22px 0', position:'relative', zIndex:1}}>
          {history.map((h,i)=>(
            <div key={i} style={{display:'flex', gap:12, alignItems:'center', padding:'12px 14px', background:C2.surface, borderRadius:14, border:`1px solid ${C2.border}`, marginBottom:8}}>
              <div style={{width:40, height:40, borderRadius:10, background:'#FFF1DE', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22}}>{h.emoji}</div>
              <div style={{flex:1}}>
                <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:14}}>{window.bi(h.zh,h.en,lang)}</div>
                <div style={{fontSize:11, color:C2.muted, marginTop:2}}>{h.when} · <span style={{color: h.state==='enjoyed'?C2.green:C2.accent}}>{h.state==='enjoyed'?window.bi('✓ 已完成','✓ enjoyed',lang):window.bi('⏳ 等爸媽','⏳ waiting',lang)}</span></div>
              </div>
              <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:14, color:C2.muted}}>− ★ {h.cost}</div>
            </div>
          ))}
          <div style={{marginTop:16, textAlign:'center', fontSize:11, color:C2.muted}}>{window.bi('總共花了 ★ 180','Total spent · ★ 180',lang)}</div>
        </div>
      )}
      </div><window.TabBar role="child" active="rewards" lang={lang} direction="C" />
    </div>
  );
}

// =========================================================
// CHILD · Me page
// =========================================================
function C_ChildMe({ lang, kid }) {
  const badges = [
    { zh:'第一次', en:'First star', icon:'★', got:true },
    { zh:'連 7 天', en:'7 day streak', icon:'🔥', got:true },
    { zh:'早睡達人', en:'Early bird', icon:'🌙', got:true },
    { zh:'100 星光', en:'100 stars', icon:'✨', got:true },
    { zh:'音樂家', en:'Musician', icon:'♪', got:false },
    { zh:'讀書蟲', en:'Bookworm', icon:'📖', got:false },
  ];
  return (
    <div style={{height:'100%', background:C2.bg, color:C2.text, position:'relative', display:'flex', flexDirection:'column'}}><div style={{flex:1, overflow:'auto', paddingBottom:20, position:'relative'}}>
      <CStarfield2 count={25} />
      <div style={{padding:'24px 22px 0', position:'relative', zIndex:1, textAlign:'center'}}>
        <div style={{width:96, height:96, borderRadius:9999, background:`linear-gradient(135deg,${kid.color},#F5A623)`, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontWeight:800, fontSize:40, color:'#fff', border:`3px solid ${C2.primary}`}}>{window.bi(kid.zh[0],kid.name[0],lang)}</div>
        <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:24, marginTop:12}}>{window.bi(kid.zh,kid.name,lang)}</div>
        <div style={{fontSize:12, color:C2.muted, marginTop:2}}>{window.bi(`${kid.age} 歲 · 加入 3 個月`,`Age ${kid.age} · 3 months in`,lang)}</div>
      </div>
      <div style={{padding:'20px 22px 0', position:'relative', zIndex:1}}>
        <div style={{display:'flex', gap:10}}>
          <div style={{flex:1, padding:14, borderRadius:14, background:C2.surface, border:`1px solid ${C2.border}`, textAlign:'center'}}>
            <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:22, color:C2.primary}}>★ {kid.stars}</div>
            <div style={{fontSize:10, color:C2.muted, marginTop:2, letterSpacing:1}}>{window.bi('總星光','TOTAL',lang)}</div>
          </div>
          <div style={{flex:1, padding:14, borderRadius:14, background:C2.surface, border:`1px solid ${C2.border}`, textAlign:'center'}}>
            <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:22, color:C2.accent}}>🔥 7</div>
            <div style={{fontSize:10, color:C2.muted, marginTop:2, letterSpacing:1}}>{window.bi('連續天數','STREAK',lang)}</div>
          </div>
          <div style={{flex:1, padding:14, borderRadius:14, background:C2.surface, border:`1px solid ${C2.border}`, textAlign:'center'}}>
            <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:22, color:C2.green}}>4</div>
            <div style={{fontSize:10, color:C2.muted, marginTop:2, letterSpacing:1}}>{window.bi('徽章','BADGES',lang)}</div>
          </div>
        </div>
        <div style={{marginTop:20, padding:16, borderRadius:16, background:C2.surface, border:`1px solid ${C2.border}`}}>
          <div style={{fontSize:11, fontWeight:800, letterSpacing:1.5, color:C2.muted, marginBottom:4}}>{window.bi('本週進度','THIS WEEK',lang)}</div>
          <div style={{display:'flex', gap:4, marginTop:10, alignItems:'flex-end', height:50}}>
            {[3,5,2,4,5,0,0].map((v,i)=>(
              <div key={i} style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4}}>
                <div style={{width:'100%', height:v*8, background: i<5?C2.primary:C2.surfaceHi, borderRadius:4}}/>
                <div style={{fontSize:10, color:C2.muted}}>{['一','二','三','四','五','六','日'][i]}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{marginTop:16}}>
          <div style={{fontSize:11, fontWeight:800, letterSpacing:1.5, color:C2.muted, marginBottom:10}}>{window.bi('徽章','BADGES',lang)}</div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10}}>
            {badges.map((b,i)=>(
              <div key={i} style={{padding:12, borderRadius:14, background: b.got?C2.surface:'transparent', border:`1px ${b.got?'solid':'dashed'} ${C2.border}`, textAlign:'center', opacity:b.got?1:0.5}}>
                <div style={{fontSize:28, lineHeight:1}}>{b.icon}</div>
                <div style={{fontFamily:'var(--font-display)', fontWeight:700, fontSize:11, marginTop:6}}>{window.bi(b.zh,b.en,lang)}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{marginTop:16, padding:'2px 14px', background:C2.surface, borderRadius:14, border:`1px solid ${C2.border}`}}>
          {[
            {zh:'語言', en:'Language', v:'中文 / English'},
            {zh:'家長協助', en:'Parent help', v:'→'},
            {zh:'登出', en:'Sign out', v:'→'},
          ].map((r,i,arr)=>(
            <div key={i} style={{display:'flex', justifyContent:'space-between', padding:'14px 0', borderBottom: i<arr.length-1?`1px solid ${C2.border}`:'none', fontSize:13}}>
              <div style={{fontWeight:700}}>{window.bi(r.zh,r.en,lang)}</div>
              <div style={{color:C2.muted}}>{r.v}</div>
            </div>
          ))}
        </div>
      </div>
      </div><window.TabBar role="child" active="me" lang={lang} direction="C" />
    </div>
  );
}

// =========================================================
// CHILD · Notifications
// =========================================================
function C_ChildNotif({ lang }) {
  const items = [
    { kind:'approved', zh:'媽媽通過了「整理書桌」✓', en:'Mom approved "Clean desk" ✓', star:'+10', when:window.bi('5 分鐘前','5 min ago',lang), unread:true },
    { kind:'new', zh:'新任務：練鋼琴', en:'New mission: Piano', when:window.bi('1 小時前','1 hr ago',lang), unread:true },
    { kind:'reward', zh:'你離「新的書」還差 58 ★', en:'58 ★ until "New book"', when:window.bi('今天早上','This morning',lang) },
    { kind:'redeem', zh:'爸爸答應了「選電影」🎬', en:'Dad approved "Pick a movie" 🎬', when:window.bi('昨天','Yesterday',lang) },
    { kind:'streak', zh:'連續 7 天收集星光！🔥', en:'7 day streak! 🔥', when:window.bi('2 天前','2 days ago',lang) },
    { kind:'redo', zh:'「整理玩具」再試一次', en:'"Tidy toys" try again', when:window.bi('3 天前','3 days ago',lang) },
  ];
  const iconFor = k => ({approved:'✓', new:'✦', reward:'★', redeem:'🎁', streak:'🔥', redo:'↻'}[k]);
  const colorFor = k => ({approved:C2.green, new:C2.primary, reward:C2.accent, redeem:C2.primary, streak:C2.accentHot, redo:C2.accent}[k]);
  return (
    <div style={{height:'100%', background:C2.bg, color:C2.text, position:'relative', display:'flex', flexDirection:'column'}}><div style={{flex:1, overflow:'auto', paddingBottom:20, position:'relative'}}>
      <CStarfield2 count={16} />
      <div style={{padding:'20px 22px 12px', position:'relative', zIndex:1, display:'flex', justifyContent:'space-between', alignItems:'flex-end'}}>
        <div>
          <div style={{fontSize:11, fontWeight:800, letterSpacing:1.5, color:C2.muted}}>{window.bi('通知','ALERTS',lang)}</div>
          <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:26, marginTop:2}}>{window.bi('今天的消息','Today\'s news',lang)}</div>
        </div>
        <div style={{fontSize:12, color:C2.muted}}>{window.bi('全部標示已讀','Mark all read',lang)}</div>
      </div>
      <div style={{padding:'0 22px', position:'relative', zIndex:1}}>
        {items.map((n,i)=>(
          <div key={i} style={{display:'flex', gap:12, padding:'14px 14px', background: n.unread?C2.surface:'transparent', borderRadius:14, border:`1px solid ${n.unread?C2.border:'transparent'}`, marginBottom:6, position:'relative'}}>
            {n.unread && <div style={{position:'absolute', top:16, right:14, width:8, height:8, borderRadius:9999, background:C2.primary}}/>}
            <div style={{width:36, height:36, borderRadius:9999, background:`${colorFor(n.kind)}22`, color:colorFor(n.kind), display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:800, flexShrink:0}}>{iconFor(n.kind)}</div>
            <div style={{flex:1, minWidth:0, paddingRight:12}}>
              <div style={{fontFamily:'var(--font-display)', fontWeight:700, fontSize:14, lineHeight:1.3}}>{window.bi(n.zh,n.en,lang)}</div>
              <div style={{fontSize:11, color:C2.muted, marginTop:3}}>{n.when}{n.star && <span style={{color:C2.primary, marginLeft:8, fontWeight:700}}>{n.star}</span>}</div>
            </div>
          </div>
        ))}
      </div>
      </div><window.TabBar role="child" active="notif" lang={lang} direction="C" />
    </div>
  );
}

// =========================================================
// PARENT · Tasks management (not assign — browse & edit)
// Now contains both "管理" and "歷程" sub-tabs; the user can switch inline.
// The `initialTab` prop lets index.html show the same screen twice with
// each sub-tab pre-selected so reviewers can compare them side-by-side.
// =========================================================
function C_ParentTasksManage({ lang, initialTab }) {
  const [tab, setTab] = React.useState(initialTab || 'manage');
  const tasks = [
    { id:'t1', emoji:'🧹', zh:'整理書桌', en:'Clean desk', pts:10, kid:'小美', freq:window.bi('每日','Daily',lang), rate:'92%', state:'active' },
    { id:'t2', emoji:'🪥', zh:'刷牙', en:'Brush teeth', pts:5, kid:'小美 + 小凱', freq:window.bi('每日 × 2','Daily × 2',lang), rate:'100%', state:'active' },
    { id:'t3', emoji:'🎹', zh:'練鋼琴', en:'Piano', pts:10, kid:'小美', freq:window.bi('週一三五','Mon/Wed/Fri',lang), rate:'74%', state:'active' },
    { id:'w1', emoji:'🗑️', zh:'倒垃圾', en:'Take out trash', pts:20, kid:'小凱', freq:window.bi('每週','Weekly',lang), rate:'85%', state:'active' },
    { id:'p1', emoji:'🧸', zh:'整理玩具', en:'Tidy toys', pts:8, kid:'小凱', freq:window.bi('每週','Weekly',lang), rate:'40%', state:'paused' },
  ];
  const history = [
    { when:window.bi('今天','Today',lang), items:[
      { zh:'整理書桌', en:'Clean desk', kid:'小美', stars:10, ok:true, time:'4:32 PM' },
      { zh:'練鋼琴', en:'Piano', kid:'小美', stars:10, ok:true, time:'3:15 PM' },
      { zh:'寫作業', en:'Homework', kid:'小凱', stars:15, ok:null, time:'6:10 PM' },
    ]},
    { when:window.bi('昨天','Yesterday',lang), items:[
      { zh:'刷牙', en:'Brush teeth', kid:'小美', stars:5, ok:true, time:'7:42 AM' },
      { zh:'整理玩具', en:'Tidy toys', kid:'小凱', stars:8, ok:false, time:'2:40 PM' },
      { zh:'閱讀 20 分鐘', en:'Read 20 min', kid:'小美', stars:8, ok:true, time:'8:00 PM' },
    ]},
    { when:window.bi('4月6日','Apr 6',lang), items:[
      { zh:'餵魚', en:'Feed fish', kid:'小美', stars:3, ok:true, time:'5:20 PM' },
    ]},
  ];
  return (
    <div style={{height:'100%', background:C2.bg, color:C2.text, position:'relative', display:'flex', flexDirection:'column'}}><div style={{flex:1, overflow:'auto', paddingBottom:100, position:'relative'}}>
      <CStarfield2 count={14} />
      <div style={{padding:'20px 22px 4px', position:'relative', zIndex:1}}>
        <div style={{fontSize:11, fontWeight:800, letterSpacing:1.5, color:C2.muted}}>{window.bi('任務','TASKS',lang)}</div>
        <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:26, marginTop:2}}>
          {tab==='manage' ? window.bi('5 個任務在跑','5 missions running',lang) : window.bi('過去 7 天','Last 7 days',lang)}
        </div>
        {/* Sub-tabs — actually wired to setTab so clicking swaps the view */}
        <div style={{display:'flex', gap:4, marginTop:14, background:C2.surface, padding:4, borderRadius:12, border:`1px solid ${C2.border}`}}>
          {[{k:'manage',zh:'管理',en:'Manage'},{k:'history',zh:'歷程',en:'History'}].map(s=>{
            const on = tab===s.k;
            return (
              <div key={s.k} onClick={()=>setTab(s.k)} style={{flex:1, padding:'9px 8px', textAlign:'center', borderRadius:9, background: on?C2.primary:'transparent', color: on?C2.bg:C2.muted, fontSize:12, fontWeight:800, cursor:'pointer', transition:'all 0.15s'}}>{window.bi(s.zh,s.en,lang)}</div>
            );
          })}
        </div>
      </div>
      {tab==='manage' ? (<>
      <div style={{padding:'8px 22px 0', position:'relative', zIndex:1, display:'flex', gap:8}}>
        <div style={{padding:'6px 12px', borderRadius:9999, background:C2.primary, color:C2.bg, fontSize:11, fontWeight:800}}>{window.bi('全部','All',lang)} · 5</div>
        <div style={{padding:'6px 12px', borderRadius:9999, border:`1px solid ${C2.border}`, color:C2.muted, fontSize:11, fontWeight:700}}>{window.bi('小美','Mei',lang)}</div>
        <div style={{padding:'6px 12px', borderRadius:9999, border:`1px solid ${C2.border}`, color:C2.muted, fontSize:11, fontWeight:700}}>{window.bi('小凱','Kai',lang)}</div>
        <div style={{padding:'6px 12px', borderRadius:9999, border:`1px solid ${C2.border}`, color:C2.muted, fontSize:11, fontWeight:700}}>{window.bi('暫停','Paused',lang)}</div>
      </div>
      <div style={{padding:'14px 22px 0', position:'relative', zIndex:1}}>
        {tasks.map(t=>{
          const paused = t.state==='paused';
          return (
            <div key={t.id} style={{padding:'14px 14px', background:C2.surface, border:`1px solid ${C2.border}`, borderRadius:14, marginBottom:8, opacity:paused?0.6:1}}>
              <div style={{display:'flex', alignItems:'flex-start', gap:12}}>
                <div style={{width:40, height:40, borderRadius:10, background:`${C2.primary}18`, border:`1px solid ${C2.border}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:22}}>{t.emoji}</div>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', gap:8}}>
                    <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:15, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{window.bi(t.zh,t.en,lang)}</div>
                    <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:13, color:C2.primary, flexShrink:0}}>★ {t.pts}</div>
                  </div>
                  <div style={{fontSize:11, color:C2.muted, marginTop:2}}>{t.kid} · {t.freq}{paused && <span style={{color:C2.accent, marginLeft:6}}>· {window.bi('已暫停','Paused',lang)}</span>}</div>
                </div>
              </div>
              <div style={{display:'flex', gap:10, marginTop:10, alignItems:'center'}}>
                <div style={{flex:1, height:4, borderRadius:9999, background:C2.surfaceHi, overflow:'hidden'}}>
                  <div style={{height:'100%', width:t.rate, background:paused?C2.muted:C2.green}}/>
                </div>
                <div style={{fontSize:11, color:C2.muted, fontFamily:'DM Sans,sans-serif', fontWeight:700}}>{t.rate} {window.bi('完成率','done',lang)}</div>
                <div style={{fontSize:16, color:C2.muted, marginLeft:4}}>⋯</div>
              </div>
            </div>
          );
        })}
      </div>
      {/* Floating new-task button */}
      <div style={{position:'absolute', right:18, bottom:92, width:56, height:56, borderRadius:9999, background:C2.primary, color:C2.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, fontWeight:800, boxShadow:'0 12px 24px rgba(0,0,0,0.35)', zIndex:4}}>+</div>
      </>) : (<>
      {/* History view */}
      <div style={{padding:'8px 22px 14px', position:'relative', zIndex:1, display:'flex', gap:10}}>
        <div style={{flex:1, padding:12, borderRadius:14, background:C2.surface, border:`1px solid ${C2.border}`}}>
          <div style={{fontSize:10, fontWeight:800, letterSpacing:1, color:C2.muted}}>{window.bi('完成','COMPLETED',lang)}</div>
          <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:22, color:C2.green, marginTop:4}}>18</div>
        </div>
        <div style={{flex:1, padding:12, borderRadius:14, background:C2.surface, border:`1px solid ${C2.border}`}}>
          <div style={{fontSize:10, fontWeight:800, letterSpacing:1, color:C2.muted}}>{window.bi('星光','STARS',lang)}</div>
          <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:22, color:C2.primary, marginTop:4}}>★ 128</div>
        </div>
        <div style={{flex:1, padding:12, borderRadius:14, background:C2.surface, border:`1px solid ${C2.border}`}}>
          <div style={{fontSize:10, fontWeight:800, letterSpacing:1, color:C2.muted}}>{window.bi('需重做','REDO',lang)}</div>
          <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:22, color:C2.accentHot, marginTop:4}}>1</div>
        </div>
      </div>
      {history.map((d,di)=>(
        <div key={di} style={{position:'relative', zIndex:1}}>
          <div style={{padding:'4px 22px 6px', fontSize:11, fontWeight:800, letterSpacing:1.5, color:C2.muted}}>{d.when}</div>
          {d.items.map((it,i)=>(
            <div key={i} style={{margin:'0 22px 6px', padding:'12px 14px', background:C2.surface, borderRadius:14, border:`1px solid ${C2.border}`, display:'flex', alignItems:'center', gap:12}}>
              <div style={{width:34, height:34, borderRadius:9999, background: it.ok===true?'rgba(94,224,168,0.15)':it.ok===false?'rgba(255,107,71,0.15)':'rgba(245,166,35,0.15)', color: it.ok===true?C2.green:it.ok===false?C2.accentHot:C2.accent, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:800, flexShrink:0}}>{it.ok===true?'✓':it.ok===false?'✗':'?'}</div>
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:14}}>{window.bi(it.zh,it.en,lang)}</div>
                <div style={{fontSize:11, color:C2.muted, marginTop:2}}>{it.kid} · {it.time}</div>
              </div>
              <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:15, color: it.ok===true?C2.primary:C2.muted, flexShrink:0}}>★ {it.stars}</div>
            </div>
          ))}
        </div>
      ))}
      </>)}
      </div><window.TabBar role="parent" active="tasks" lang={lang} direction="C" />
    </div>
  );
}

// =========================================================
// PARENT · Rewards tab with catalog + redeem log
// =========================================================
function C_ParentRewardsTab({ lang }) {
  const [tab, setTab] = React.useState('catalog');
  const rewards = window.MFK_DATA.rewards;
  const log = [
    { zh:'選電影', en:'Pick a movie', emoji:'🎬', kid:window.bi('小美','Mei',lang), cost:100, state:'pending', when:window.bi('10 分鐘前','10 min ago',lang) },
    { zh:'吃冰淇淋', en:'Ice cream', emoji:'🍦', kid:window.bi('小美','Mei',lang), cost:50, state:'done', when:window.bi('昨天','Yesterday',lang) },
    { zh:'遊戲 30 分鐘', en:'30 min game', emoji:'🎮', kid:window.bi('小凱','Kai',lang), cost:30, state:'done', when:window.bi('上週日','Last Sun',lang) },
    { zh:'晚睡 30 分鐘', en:'Stay up 30 min', emoji:'🌙', kid:window.bi('小凱','Kai',lang), cost:80, state:'declined', when:window.bi('上週','Last week',lang) },
  ];
  const stateLabel = s => ({pending:{zh:'等你同意',en:'Pending you',color:C2.accent}, done:{zh:'已完成',en:'Enjoyed',color:C2.green}, declined:{zh:'未通過',en:'Declined',color:C2.accentHot}}[s]);
  return (
    <div style={{height:'100%', background:C2.bg, color:C2.text, position:'relative', display:'flex', flexDirection:'column'}}><div style={{flex:1, overflow:'auto', paddingBottom:20, position:'relative'}}>
      <CStarfield2 count={14} />
      <div style={{padding:'20px 22px 10px', position:'relative', zIndex:1}}>
        <div style={{fontSize:11, fontWeight:800, letterSpacing:1.5, color:C2.muted}}>{window.bi('獎勵','REWARDS',lang)}</div>
        <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:26, marginTop:2}}>{window.bi('管理與紀錄','Manage & log',lang)}</div>
        <div style={{display:'flex', gap:4, marginTop:14, background:C2.surface, padding:4, borderRadius:12, border:`1px solid ${C2.border}`}}>
          {[{k:'catalog',zh:'禮物目錄',en:'Catalog'},{k:'log',zh:'兌換紀錄',en:'Redeem log'}].map(t=>(
            <div key={t.k} onClick={()=>setTab(t.k)} style={{flex:1, padding:'9px 8px', textAlign:'center', borderRadius:9, background: tab===t.k?C2.primary:'transparent', color: tab===t.k?C2.bg:C2.muted, fontSize:12, fontWeight:800, cursor:'pointer'}}>{window.bi(t.zh,t.en,lang)}</div>
          ))}
        </div>
      </div>
      {tab==='catalog' ? (
        <div style={{padding:'14px 22px 0', position:'relative', zIndex:1}}>
          {rewards.slice(0,5).map((r,i)=>(
            <div key={r.id} style={{display:'flex', alignItems:'center', gap:12, padding:14, marginBottom:8, background:C2.surface, borderRadius:14, border:`1px solid ${C2.border}`}}>
              <div style={{width:48, height:48, borderRadius:10, background:`linear-gradient(135deg,${r.color},${r.color}dd)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0}}>{r.emoji}</div>
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:14}}>{window.bi(r.zh,r.en,lang)}</div>
                <div style={{fontSize:11, color:C2.muted, marginTop:2}}>{window.bi('每週最多 1 次','Max 1/week',lang)}</div>
              </div>
              <div style={{textAlign:'right', flexShrink:0}}>
                <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:14, color:C2.primary}}>★ {r.cost}</div>
                <div style={{fontSize:10, color:C2.muted, marginTop:2}}>{window.bi('編輯 →','Edit →',lang)}</div>
              </div>
            </div>
          ))}
          <div style={{padding:'14px', textAlign:'center', border:`1px dashed ${C2.border}`, borderRadius:14, color:C2.muted, fontSize:12, fontWeight:700, marginTop:6}}>+ {window.bi('新增禮物','Add reward',lang)}</div>
        </div>
      ) : (
        <div style={{padding:'14px 22px 0', position:'relative', zIndex:1}}>
          {log.map((l,i)=>{
            const s = stateLabel(l.state);
            return (
              <div key={i} style={{display:'flex', alignItems:'center', gap:12, padding:14, marginBottom:8, background:C2.surface, borderRadius:14, border:`1px solid ${C2.border}`}}>
                <div style={{width:44, height:44, borderRadius:10, background:'#FFF1DE', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0}}>{l.emoji}</div>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:13}}>{window.bi(l.zh,l.en,lang)}</div>
                  <div style={{fontSize:11, color:C2.muted, marginTop:2}}>{l.kid} · {l.when} · <span style={{color:s.color, fontWeight:700}}>{window.bi(s.zh,s.en,lang)}</span></div>
                </div>
                <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:13, color:C2.muted, flexShrink:0}}>− ★ {l.cost}</div>
              </div>
            );
          })}
          <div style={{marginTop:14, textAlign:'center', fontSize:11, color:C2.muted}}>{window.bi('本月共兌換 ★ 260','This month · ★ 260 redeemed',lang)}</div>
        </div>
      )}
      </div><window.TabBar role="parent" active="rewards" lang={lang} direction="C" />
    </div>
  );
}

// =========================================================
// PARENT · Keyboard accessory demo (assign form with keyboard up)
// =========================================================
function C_KeyboardDemo({ lang }) {
  return (
    <div style={{height:'100%', background:C2.bg, color:C2.text, position:'relative', overflow:'hidden'}}>
      <CStarfield2 count={10} />
      {/* Screen header (sheet) */}
      <div style={{padding:'16px 22px', display:'flex', justifyContent:'space-between', alignItems:'center', position:'relative', zIndex:2}}>
        <div style={{fontSize:18, color:C2.muted}}>✕</div>
        <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:14}}>{window.bi('新任務','New mission',lang)}</div>
        <div style={{color:C2.muted, fontSize:13, fontWeight:700}}>{window.bi('草稿','Draft',lang)}</div>
      </div>
      {/* Scrollable content (pushed up by keyboard) */}
      <div style={{padding:'8px 22px 0', height:320, overflow:'auto', position:'relative', zIndex:1}}>
        <div style={{padding:18, background:C2.surface, borderRadius:18, border:`1px solid ${C2.border}`}}>
          <div style={{fontSize:10, fontWeight:800, color:C2.muted, letterSpacing:1}}>{window.bi('任務名稱','TITLE',lang)}</div>
          <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:22, color:C2.text, marginTop:8, borderBottom:`2px solid ${C2.primary}`, paddingBottom:6, display:'flex', alignItems:'center'}}>
            {window.bi('整理書桌','Clean your desk',lang)}<span style={{display:'inline-block', width:2, height:24, background:C2.primary, marginLeft:4, animation:'blink 1s infinite'}}/>
          </div>
          <div style={{marginTop:14, display:'flex', gap:10}}>
            <div style={{flex:1, padding:'8px 12px', background:C2.bg, borderRadius:10, border:`1px solid ${C2.border}`}}>
              <div style={{fontSize:9, fontWeight:800, color:C2.muted, letterSpacing:1}}>★ {window.bi('星光','STARLIGHT',lang)}</div>
              <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:18, color:C2.primary, marginTop:2}}>10</div>
            </div>
            <div style={{flex:1, padding:'8px 12px', background:C2.bg, borderRadius:10, border:`1px solid ${C2.border}`}}>
              <div style={{fontSize:9, fontWeight:800, color:C2.muted, letterSpacing:1}}>{window.bi('頻率','FREQ',lang)}</div>
              <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:14, marginTop:4}}>{window.bi('每日','Daily',lang)}</div>
            </div>
          </div>
        </div>
      </div>
      {/* Accessory bar — pinned just above keyboard */}
      <div style={{position:'absolute', left:0, right:0, bottom:260, padding:'10px 16px', background:C2.surfaceHi, borderTop:`1px solid ${C2.border}`, borderBottom:`1px solid ${C2.border}`, display:'flex', justifyContent:'space-between', alignItems:'center', zIndex:3}}>
        <div style={{display:'flex', gap:12, color:C2.muted, fontSize:14}}>
          <span>‹</span><span>›</span>
        </div>
        <div style={{padding:'8px 18px', background:C2.primary, color:C2.bg, borderRadius:9999, fontFamily:'var(--font-display)', fontWeight:800, fontSize:13}}>✓ {window.bi('發佈任務','Publish',lang)}</div>
      </div>
      {/* iOS-style keyboard */}
      <div style={{position:'absolute', left:0, right:0, bottom:0, height:260, background:'#2A2F4E', borderTop:`1px solid ${C2.border}`, padding:'8px 4px 24px', zIndex:2}}>
        {[['q','w','e','r','t','y','u','i','o','p'],['a','s','d','f','g','h','j','k','l'],['⇧','z','x','c','v','b','n','m','⌫']].map((row,ri)=>(
          <div key={ri} style={{display:'flex', gap:5, marginBottom:8, padding: ri===1?'0 18px':ri===2?'0 4px':'0 4px'}}>
            {row.map(k=>(
              <div key={k} style={{flex: k.length>1?1.5:1, padding:'10px 0', textAlign:'center', background:'#4A4F70', borderRadius:5, fontSize:13, fontFamily:'system-ui', color:'#F7F2EA', boxShadow:'0 1px 0 rgba(0,0,0,0.3)'}}>{k}</div>
            ))}
          </div>
        ))}
        <div style={{display:'flex', gap:5, padding:'0 4px'}}>
          <div style={{flex:1.3, padding:'10px 0', textAlign:'center', background:'#3A3F60', borderRadius:5, fontSize:11, color:'#F7F2EA'}}>123</div>
          <div style={{width:38, padding:'10px 0', textAlign:'center', background:'#3A3F60', borderRadius:5, fontSize:14, color:'#F7F2EA'}}>😀</div>
          <div style={{flex:4, padding:'10px 0', textAlign:'center', background:'#4A4F70', borderRadius:5, fontSize:13, color:'#F7F2EA'}}>{window.bi('空白','space',lang)}</div>
          <div style={{flex:1.5, padding:'10px 0', textAlign:'center', background:C2.primary, color:C2.bg, borderRadius:5, fontSize:13, fontWeight:800}}>{window.bi('完成','done',lang)}</div>
        </div>
      </div>
      <style>{`@keyframes blink{0%,50%{opacity:1}51%,100%{opacity:0}}`}</style>
    </div>
  );
}

Object.assign(window, { C_TasksHome, C_ChildRewardsTab, C_ChildMe, C_ChildNotif, C_ParentTasksManage, C_ParentRewardsTab, C_KeyboardDemo });


// =========================================================
// PARENT · New Reward sheet (+ 新增禮物 points here)
// =========================================================
function C_ParentRewardEdit({ lang }) {
  return (
    <div style={{height:'100%', background:C2.bg, color:C2.text, position:'relative', display:'flex', flexDirection:'column'}}>
      <CStarfield2 count={12} />
      <div style={{padding:'10px 0 6px', display:'flex', justifyContent:'center', position:'relative', zIndex:2}}>
        <div style={{width:44, height:5, borderRadius:9999, background:'rgba(247,242,234,0.25)'}}/>
      </div>
      <div style={{padding:'4px 22px 10px', display:'flex', justifyContent:'space-between', alignItems:'center', position:'relative', zIndex:2}}>
        <div style={{fontSize:14, color:C2.muted}}>{window.bi('取消','Cancel',lang)}</div>
        <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:15}}>{window.bi('新增禮物','New reward',lang)}</div>
        <div style={{padding:'6px 12px', borderRadius:9999, background:C2.primary, color:C2.bg, fontSize:12, fontWeight:800}}>{window.bi('儲存','Save',lang)}</div>
      </div>
      <div style={{flex:1, overflow:'auto', padding:'4px 22px 24px', position:'relative', zIndex:1}}>
        {/* Big emoji + title card */}
        <div style={{padding:18, background:C2.surface, borderRadius:20, border:`1px solid ${C2.border}`, display:'flex', gap:14, alignItems:'center'}}>
          <div style={{width:72, height:72, borderRadius:18, background:'linear-gradient(135deg,#FFCFA3,#F5A623)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:36, flexShrink:0}}>🍦</div>
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize:10, fontWeight:800, color:C2.muted, letterSpacing:1}}>{window.bi('名字','NAME',lang)}</div>
            <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:20, color:C2.text, marginTop:4, borderBottom:`2px solid ${C2.primary}`, paddingBottom:4}}>{window.bi('吃冰淇淋','Ice cream trip',lang)}</div>
          </div>
        </div>

        {/* Emoji picker row */}
        <div style={{marginTop:14, padding:'14px 14px', background:C2.surface, borderRadius:16, border:`1px solid ${C2.border}`}}>
          <div style={{fontSize:10, fontWeight:800, color:C2.muted, letterSpacing:1, marginBottom:10}}>{window.bi('選個圖案','PICK AN ICON',lang)}</div>
          <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
            {['🍦','🎮','🎬','📚','🍕','🧸','🌙','🎨','⚽','🎧'].map((e,i)=>(
              <div key={i} style={{width:40, height:40, borderRadius:10, background: i===0?`${C2.primary}33`:C2.bg, border: i===0?`2px solid ${C2.primary}`:`1px solid ${C2.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20}}>{e}</div>
            ))}
            {/* Camera (use a real photo) */}
            <div title={window.bi('拍照當圖案','Use a photo',lang)} style={{width:40, height:40, borderRadius:10, background:C2.bg, border:`1.5px dashed ${C2.border}`, display:'flex', alignItems:'center', justifyContent:'center', color:C2.muted}}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="6" width="18" height="13" rx="2.5"/><circle cx="12" cy="12.5" r="3"/><path d="M8 5.5l1.2-1.2h5.6L16 5.5"/></svg>
            </div>
            {/* Add more emoji */}
            <div title={window.bi('新增圖案','Add icon',lang)} style={{width:40, height:40, borderRadius:10, background:C2.bg, border:`1.5px dashed ${C2.border}`, display:'flex', alignItems:'center', justifyContent:'center', color:C2.primary, fontSize:18, fontWeight:800}}>+</div>
          </div>
          <div style={{fontSize:11, color:C2.muted, marginTop:10, lineHeight:1.5}}>{window.bi('沒有合適的圖案？直接拍一張照片當封面。','None fit? Snap a photo to use as the cover.',lang)}</div>
        </div>

        {/* Cost stepper */}
        <div style={{marginTop:14, padding:'14px 16px', background:C2.surface, borderRadius:16, border:`1px solid ${C2.border}`}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <div style={{fontSize:10, fontWeight:800, color:C2.muted, letterSpacing:1}}>★ {window.bi('星光價格','COST',lang)}</div>
            <div style={{display:'flex', alignItems:'center', gap:10}}>
              <div style={{width:32, height:32, borderRadius:9999, background:C2.bg, color:C2.muted, border:`1px solid ${C2.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18}}>−</div>
              <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:22, color:C2.primary, minWidth:44, textAlign:'center'}}>★ 50</div>
              <div style={{width:32, height:32, borderRadius:9999, background:C2.primary, color:C2.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:800}}>+</div>
            </div>
          </div>
          {/* Per-child balance preview */}
          <div style={{marginTop:12, display:'flex', flexDirection:'column', gap:6}}>
            {window.MFK_DATA.family.kids.map((k,i)=>{
              const after = (k.stars||0) - 50;
              const can = after >= 0;
              return (
                <div key={k.id} style={{display:'flex', alignItems:'center', gap:10, padding:'8px 10px', background:C2.bg, borderRadius:10, border:`1px solid ${C2.border}`}}>
                  <div style={{width:22, height:22, borderRadius:9999, background:k.color, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, flexShrink:0}}>{window.bi(k.zh[0],k.name[0],lang)}</div>
                  <div style={{flex:1, fontFamily:'var(--font-display)', fontWeight:700, fontSize:12}}>{window.bi(k.zh,k.name,lang)}</div>
                  <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:12, color:C2.muted}}>★ {k.stars}</div>
                  <div style={{color:C2.muted, fontSize:11}}>→</div>
                  <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:800, fontSize:12, color: can?C2.primary:C2.accentHot, minWidth:44, textAlign:'right'}}>★ {can?after:0}</div>
                  {!can && <div style={{fontSize:9, fontWeight:800, color:C2.accentHot, letterSpacing:0.5}}>{window.bi('不夠','LOW',lang)}</div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Who can redeem */}
        <div style={{marginTop:14, padding:'14px 16px', background:C2.surface, borderRadius:16, border:`1px solid ${C2.border}`}}>
          <div style={{fontSize:10, fontWeight:800, color:C2.muted, letterSpacing:1, marginBottom:10}}>{window.bi('誰可以換','WHO CAN REDEEM',lang)}</div>
          <div style={{display:'flex', gap:8}}>
            {[{n:'小美',en:'Mei',on:true, color:'#5EA8E8'},{n:'小凱',en:'Kai',on:true, color:'#F5A623'}].map((k,i)=>(
              <div key={i} style={{flex:1, padding:'10px 12px', borderRadius:12, background: k.on?`${C2.primary}22`:C2.bg, border: k.on?`2px solid ${C2.primary}`:`1px solid ${C2.border}`, display:'flex', alignItems:'center', gap:8}}>
                <div style={{width:26, height:26, borderRadius:9999, background:k.color, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800}}>{window.bi(k.n[0],k.en[0],lang)}</div>
                <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:13}}>{window.bi(k.n,k.en,lang)}</div>
                {k.on && <div style={{marginLeft:'auto', color:C2.primary, fontSize:13, fontWeight:800}}>✓</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Limits */}
        <div style={{marginTop:14, padding:'4px 16px', background:C2.surface, borderRadius:16, border:`1px solid ${C2.border}`}}>
          {[
            {zh:'每週最多',en:'Max per week',v:'1 次'},
            {zh:'兌換需我同意',en:'Require my approval',toggle:true},
            {zh:'有效期限',en:'Expires',v:window.bi('永久','Never',lang)},
          ].map((r,i,arr)=>(
            <div key={i} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 0', borderBottom: i<arr.length-1?`1px solid ${C2.border}`:'none'}}>
              <div style={{fontFamily:'var(--font-display)', fontWeight:700, fontSize:14}}>{window.bi(r.zh,r.en,lang)}</div>
              {r.toggle !== undefined ? (
                <div style={{width:40, height:22, borderRadius:9999, background:C2.primary, position:'relative'}}>
                  <div style={{width:18, height:18, borderRadius:9999, background:'#fff', position:'absolute', top:2, left:20}}/>
                </div>
              ) : <div style={{fontSize:13, color:C2.muted, fontWeight:700}}>{r.v} ›</div>}
            </div>
          ))}
        </div>

        {/* Note to kid */}
        <div style={{marginTop:14, padding:'14px 16px', background:C2.surface, borderRadius:16, border:`1px solid ${C2.border}`}}>
          <div style={{fontSize:10, fontWeight:800, color:C2.muted, letterSpacing:1}}>{window.bi('給孩子的一句話','A LINE FOR YOUR KID',lang)}</div>
          <div style={{marginTop:8, padding:'10px 12px', background:C2.bg, borderRadius:10, border:`1px dashed ${C2.border}`, fontSize:13, color:C2.text, lineHeight:1.5}}>
            {window.bi('累積 50 星光，週末帶你去吃冰 🍦','Collect 50 stars — weekend ice cream on me 🍦',lang)}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { C_ParentRewardEdit });
