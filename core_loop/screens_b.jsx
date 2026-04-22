/* eslint-disable */
// Direction B — Editorial Playbook. Respects tokens, restructures layout.
// Magazine-style with indexed rows, big date masthead, serif-feel display weight.

const B_PALETTE = {
  bg: '#F7F2EA', surface: '#FFFDF7', primary: '#146B5E', primaryDark: '#0F4A40',
  primaryLight: '#E0F5F0', accent: '#F5A623', accentLight: '#FFF3D6',
  text: '#1C1A14', muted: '#8A8275', border: '#D8D2C4', rule: '#1C1A14',
};

const BMast = ({ lang, kid, label }) => (
  <div style={{padding: '12px 20px 0'}}>
    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `2px solid ${B_PALETTE.rule}`, paddingBottom: 10}}>
      <div>
        <div style={{fontSize: 10, fontWeight: 800, color: B_PALETTE.muted, letterSpacing: 2, textTransform: 'uppercase'}}>{label || 'MISSION FOR KIDS · VOL. 01'}</div>
        <div style={{fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, lineHeight: 1.05, letterSpacing: '-0.02em', marginTop: 4, fontStyle: 'italic', whiteSpace: 'nowrap'}}>{bi('週三 · 4月8日', 'WED · APR 8', lang)}</div>
      </div>
      {kid && <div style={{textAlign: 'right', flexShrink: 0, paddingLeft: 12}}>
        <div style={{fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 22, color: B_PALETTE.accent, whiteSpace: 'nowrap'}}>★ {kid.stars}</div>
        <div style={{fontSize: 10, fontWeight: 800, color: B_PALETTE.muted, letterSpacing: 1}}>{bi(kid.zh, kid.name, lang)}</div>
      </div>}
    </div>
  </div>
);

function B_Home({ lang, load, kid }) {
  const t = useT(lang);
  const tasks = load === 'light' ? window.MFK_DATA.tasksLight : window.MFK_DATA.tasksFull;
  return (
    <div style={{height: '100%', overflow: 'auto', paddingBottom: 80, background: B_PALETTE.bg}}>
      <BMast lang={lang} kid={kid} />
      <div style={{padding: '20px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline'}}>
        <div style={{fontSize: 11, fontWeight: 800, letterSpacing: 1.5, color: B_PALETTE.muted}}>{bi("今天的任務 — TODAY'S BRIEF", "TODAY'S BRIEF", lang)}</div>
        <div style={{fontFamily: 'DM Sans, sans-serif', fontSize: 11, color: B_PALETTE.muted}}>{tasks.filter(x=>x.status==='done').length}/{tasks.length}</div>
      </div>
      {load === 'light' ? (
        <div style={{padding: '40px 20px', textAlign: 'center'}}>
          <div style={{fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 800, fontSize: 32, lineHeight: 1.1}}>{bi('今天輕鬆一下。', 'An easy day.', lang)}</div>
          <div style={{fontSize: 14, color: B_PALETTE.muted, marginTop: 8}}>{bi('只有一個小任務，做完就可以玩了', 'Just one small thing, then you\'re free', lang)}</div>
        </div>
      ) : (
        <div style={{padding: '12px 20px 0'}}>
          {tasks.map((x, i) => {
            const done = x.status === 'done', pending = x.status === 'pending';
            return (
              <div key={x.id} style={{display: 'flex', gap: 14, alignItems: 'flex-start', padding: '14px 0', borderBottom: `1px solid ${B_PALETTE.border}`, opacity: done ? 0.55 : 1}}>
                <div style={{fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 22, color: B_PALETTE.muted, fontVariantNumeric: 'tabular-nums', minWidth: 28}}>{String(i+1).padStart(2, '0')}</div>
                <div style={{flex: 1}}>
                  <div style={{fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, lineHeight: 1.15, textDecoration: done ? 'line-through' : 'none', textDecorationThickness: 2}}>{bi(x.zh, x.en, lang)}</div>
                  <div style={{display: 'flex', gap: 10, marginTop: 4, alignItems: 'center'}}>
                    <span style={{fontSize: 12, fontWeight: 800, color: pending ? B_PALETTE.accent : done ? '#3D8B4E' : B_PALETTE.primary}}>{done ? `★ ${x.points} ${bi('已獲得','earned',lang)}` : pending ? `☆ ${x.points} ${t('pendingStars')}` : `★ ${x.points}`}</span>
                    {!done && !pending && <span style={{fontSize: 11, color: B_PALETTE.muted, fontWeight: 700, letterSpacing: 0.4}}>· {bi('待完成', 'TO DO', lang)}</span>}
                  </div>
                </div>
                {!done && !pending && <div style={{width: 40, height: 40, borderRadius: 10, background: B_PALETTE.primary, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18}}>›</div>}
                {done && <GeomIcon kind="check" size={28} color="#3D8B4E" accent="#fff" />}
                {pending && <div style={{fontSize: 20, color: B_PALETTE.accent}}>☆</div>}
              </div>
            );
          })}
        </div>
      )}
      <div style={{position: 'absolute', bottom: 0, left: 0, right: 0, background: B_PALETTE.surface, borderTop: `1px solid ${B_PALETTE.border}`, padding: '10px 20px 24px', display: 'flex', gap: 20, fontFamily: 'DM Sans, sans-serif', fontSize: 11, fontWeight: 700, letterSpacing: 1.2}}>
        <div style={{color: B_PALETTE.primary, borderBottom: `2px solid ${B_PALETTE.primary}`, paddingBottom: 4}}>{t('tasks').toUpperCase()}</div>
        <div style={{color: B_PALETTE.muted}}>{t('rewards').toUpperCase()}</div>
        <div style={{color: B_PALETTE.muted}}>{t('me').toUpperCase()}</div>
      </div>
    </div>
  );
}

function B_TaskDetail({ lang }) {
  const task = window.MFK_DATA.tasksFull[0];
  return (
    <div style={{height: '100%', overflow: 'auto', padding: '12px 20px 24px', background: B_PALETTE.bg}}>
      <div style={{fontSize: 18}}>‹ {bi('回到任務','Back',lang)}</div>
      <div style={{borderBottom: `2px solid ${B_PALETTE.rule}`, paddingBottom: 12, marginTop: 16}}>
        <div style={{fontSize: 10, fontWeight: 800, letterSpacing: 2, color: B_PALETTE.muted}}>01 · {bi('任務','MISSION',lang)}</div>
        <div style={{fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 800, fontSize: 40, lineHeight: 1, letterSpacing: '-0.02em', marginTop: 4}}>{bi(task.zh, task.en, lang)}</div>
      </div>
      <div style={{display: 'flex', gap: 16, marginTop: 14, fontSize: 12, fontWeight: 700, color: B_PALETTE.muted, letterSpacing: 0.6}}>
        <span>★ {task.points}</span>·<span>{bi('今天','TODAY',lang)}</span>·<span>{bi('半自動','SEMI-AUTO',lang)}</span>
      </div>
      <div style={{background: B_PALETTE.primaryLight, borderRadius: 4, padding: 36, marginTop: 18, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <GeomIcon kind={iconForTask(task)} size={110} color={B_PALETTE.primary} accent={B_PALETTE.accent} />
      </div>
      <div style={{marginTop: 18, padding: '16px 0', borderTop: `1px solid ${B_PALETTE.border}`, borderBottom: `1px solid ${B_PALETTE.border}`}}>
        <div style={{fontSize: 11, fontWeight: 800, letterSpacing: 1.2, color: B_PALETTE.muted}}>{bi('家長留言 — FROM MOM', 'FROM MOM', lang)}</div>
        <div style={{fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 17, marginTop: 6, lineHeight: 1.4}}>{bi('"記得把書本放回書櫃，鉛筆也要收好喔！"', '"Put the books back on the shelf and tidy up your pencils!"', lang)}</div>
      </div>
      <div style={{background: B_PALETTE.primary, color: '#fff', padding: 18, fontFamily: 'var(--font-display)', fontWeight: 800, fontStyle: 'italic', fontSize: 20, textAlign: 'center', marginTop: 24, borderRadius: 4}}>📷 {bi('開始拍照 →', 'Take photo →', lang)}</div>
    </div>
  );
}

function B_Camera({ lang }) {
  const task = window.MFK_DATA.tasksFull[0];
  return (
    <div style={{height: '100%', background: '#0E0D0A', display: 'flex', flexDirection: 'column'}}>
      <div style={{padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <div style={{color: '#fff', fontSize: 22}}>✕</div>
          <div style={{color: '#F5A623', fontSize: 10, fontWeight: 800, letterSpacing: 2}}>REC · 03</div>
          <div style={{width: 20}} />
        </div>
        <div style={{color: '#fff', fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 800, fontSize: 24, marginTop: 6}}>{bi(task.zh, task.en, lang)}</div>
      </div>
      <div style={{flex: 1, position: 'relative', background: 'linear-gradient(180deg,#2a2620 0%, #14110D 100%)'}}>
        <div style={{position: 'absolute', inset: 24, border: '1px solid rgba(255,255,255,0.2)'}} />
        <div style={{position: 'absolute', inset: 24, top: 'auto', height: 4, background: '#F5A623'}} />
        <div style={{position: 'absolute', bottom: 50, left: 40, right: 40, height: 120, background: 'linear-gradient(180deg,#3a3428,#2a251d)'}} />
        <div style={{position: 'absolute', bottom: 12, right: 12, display: 'flex', gap: 6, alignItems: 'center'}}>
          <Owl size={44} mood="watch" direction="B" />
          <div style={{background: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: 4, color: '#fff', fontSize: 10, fontWeight: 800, letterSpacing: 1}}>PIP</div>
        </div>
      </div>
      <div style={{padding: '20px 0 36px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 36}}>
        <div style={{color: '#fff', fontSize: 11, fontWeight: 800, letterSpacing: 1.2}}>{bi('相簿', 'ALBUM', lang)}</div>
        <div style={{width: 72, height: 72, borderRadius: 9999, background: '#fff', border: '4px solid rgba(255,255,255,0.3)'}} />
        <div style={{color: '#fff', fontSize: 11, fontWeight: 800, letterSpacing: 1.2}}>↻</div>
      </div>
    </div>
  );
}

function B_AIReview({ lang }) {
  const t = useT(lang);
  return (
    <div style={{height: '100%', background: B_PALETTE.bg, padding: '48px 28px', display: 'flex', flexDirection: 'column'}}>
      <div style={{fontSize: 10, fontWeight: 800, letterSpacing: 2, color: B_PALETTE.muted}}>04 · AI REVIEW</div>
      <div style={{borderBottom: `1px solid ${B_PALETTE.border}`, paddingBottom: 20}} />
      <div style={{flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'}}>
        <Owl size={140} mood="think" direction="B" />
        <div style={{fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 800, fontSize: 28, textAlign: 'center', marginTop: 24, lineHeight: 1.15}}>{bi('Pip 正在看…', 'Pip is looking…', lang)}</div>
        <div style={{fontSize: 13, color: B_PALETTE.muted, marginTop: 8}}>{t('aiLooking')}</div>
      </div>
      <div style={{display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 800, color: B_PALETTE.muted, letterSpacing: 1.2}}>
        <span>01 ── 02 ── 03 ── <span style={{color: B_PALETTE.primary}}>04 ●</span> ── 05 ── 06</span>
      </div>
    </div>
  );
}

function B_Pending({ lang }) {
  const task = window.MFK_DATA.tasksFull[0];
  return (
    <div style={{height: '100%', background: B_PALETTE.bg, padding: '20px 24px', overflow: 'auto'}}>
      <div style={{fontSize: 10, fontWeight: 800, letterSpacing: 2, color: B_PALETTE.muted}}>05 · {bi('等待','WAITING',lang)}</div>
      <div style={{borderBottom: `2px solid ${B_PALETTE.rule}`, paddingBottom: 10}}>
        <div style={{fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 800, fontSize: 28, marginTop: 4}}>{bi('已送出，等爸媽。', 'Sent. Waiting for parent.', lang)}</div>
      </div>
      <div style={{marginTop: 18, aspectRatio: '4/3', background: 'linear-gradient(135deg,#C0AC80,#8A7A54)', borderRadius: 4}} />
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 12, paddingBottom: 12, borderBottom: `1px solid ${B_PALETTE.border}`}}>
        <div>
          <div style={{fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, fontStyle: 'italic'}}>{bi(task.zh, task.en, lang)}</div>
          <div style={{fontSize: 12, color: B_PALETTE.muted}}>{bi('4:32 PM · AI 通過', '4:32 PM · AI passed', lang)}</div>
        </div>
        <div style={{fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 32, color: B_PALETTE.accent}}>☆ {task.points}</div>
      </div>
      <div style={{marginTop: 16, padding: '14px 16px', background: B_PALETTE.primaryLight, borderRadius: 4, display: 'flex', gap: 12, alignItems: 'center'}}>
        <Owl size={40} mood="watch" direction="B" />
        <div>
          <div style={{fontSize: 13, color: B_PALETTE.primaryDark, fontWeight: 700}}>{bi('Pip 會提醒你', 'Pip will remind you', lang)}</div>
          <div style={{fontSize: 11, color: B_PALETTE.muted}}>{bi('通常不到 48 小時', 'Usually within 48 hours', lang)}</div>
        </div>
      </div>
    </div>
  );
}

function B_Celebration({ lang, motion }) {
  const t = useT(lang);
  return (
    <div style={{height: '100%', background: B_PALETTE.bg, padding: '24px 28px', position: 'relative'}}>
      <div style={{fontSize: 10, fontWeight: 800, letterSpacing: 2, color: B_PALETTE.accent}}>06 · {bi('大事發生','BIG MOMENT',lang)}</div>
      <div style={{borderBottom: `2px solid ${B_PALETTE.rule}`, paddingBottom: 8}} />
      <div style={{textAlign: 'center', marginTop: 40, position: 'relative'}}>
        {motion !== 'reduce' && [...Array(14)].map((_,i)=>(
          <span key={i} style={{position:'absolute', left:`${(i*43)%95}%`, top:`${(i*29)%180-20}px`, color:i%2?B_PALETTE.accent:B_PALETTE.primary, fontSize:14+(i%3)*6, fontWeight:800, transform:`rotate(${i*37}deg)`, animation:`bconf 2s ease-out ${(i*0.08)}s`}}>★</span>
        ))}
        <div style={{fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 800, fontSize: 56, lineHeight: 1, letterSpacing: '-0.02em'}}>{t('niceJob')}</div>
        <div style={{fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 72, color: B_PALETTE.accent, marginTop: 20}}>+10 ★</div>
        <div style={{fontSize: 13, color: B_PALETTE.muted, letterSpacing: 1, marginTop: 8, fontWeight: 700}}>{bi('總計 ★ 152', 'TOTAL ★ 152', lang)}</div>
      </div>
      <div style={{position: 'absolute', bottom: 32, left: 28, right: 28, background: B_PALETTE.primary, color: '#fff', padding: 16, fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 800, fontSize: 18, textAlign: 'center', borderRadius: 4}}>{bi('繼續下一個 →', 'Onwards →', lang)}</div>
      <style>{`@keyframes bconf{0%{transform:translateY(-30px) rotate(0);opacity:0}40%{opacity:1}100%{transform:translateY(40px) rotate(280deg);opacity:0}}`}</style>
    </div>
  );
}

function B_Rewards({ lang, kid }) {
  const t = useT(lang);
  return (
    <div style={{height: '100%', overflow: 'auto', background: B_PALETTE.bg, paddingBottom: 80}}>
      <BMast lang={lang} kid={kid} label={bi('獎勵專欄 · VOL 01','REWARD ISSUE · VOL 01',lang)} />
      <div style={{padding: '16px 20px 0', fontSize: 11, fontWeight: 800, color: B_PALETTE.muted, letterSpacing: 1.5}}>{bi('這期特別精選','THIS ISSUE',lang)}</div>
      <div style={{padding: '0 20px'}}>
        {window.MFK_DATA.rewards.map((r, i) => {
          const ok = kid.stars >= r.cost;
          return (
            <div key={r.id} style={{display:'flex',gap:14,alignItems:'center',padding:'14px 0',borderBottom:`1px solid ${B_PALETTE.border}`, opacity: ok?1:0.55}}>
              <div style={{fontFamily:'DM Sans, sans-serif', fontWeight:700, fontSize:18, color:B_PALETTE.muted, minWidth: 26}}>{String(i+1).padStart(2,'0')}</div>
              <div style={{width: 64, height: 64, borderRadius: 4, background: r.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, position:'relative'}}>
                {r.emoji}
                <div style={{position:'absolute', bottom:2, right:2, fontSize: 8, background:'rgba(255,255,255,0.8)', padding:'1px 4px', color:B_PALETTE.muted, fontWeight:700}}>{bi('照','PHOTO',lang)}</div>
              </div>
              <div style={{flex:1}}>
                <div style={{fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:800, fontSize:18}}>{bi(r.zh, r.en, lang)}</div>
                <div style={{fontSize:12, color: ok ? B_PALETTE.accent : B_PALETTE.muted, fontWeight:700}}>★ {r.cost} {!ok && `· ${t('needMore',{n:r.cost-kid.stars})}`}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function B_Order({ lang }) {
  const steps = [
    {zh:'已下單',en:'ORDERED',done:true, when:'Yesterday 7:30 PM'},
    {zh:'爸媽確認',en:'PARENT CONFIRMED',done:true, when:'Yesterday 8:12 PM'},
    {zh:'已交付',en:'DELIVERED',done:false,current:true, when:'Today 4:00 PM'},
    {zh:'你確認',en:'YOU CONFIRM',done:false, when:'—'},
  ];
  return (
    <div style={{height:'100%', overflow:'auto', padding:'16px 20px 24px', background: B_PALETTE.bg}}>
      <div style={{fontSize:10, fontWeight:800, letterSpacing:2, color:B_PALETTE.muted}}>08 · {bi('獎勵進度','REWARD PROGRESS',lang)}</div>
      <div style={{borderBottom: `2px solid ${B_PALETTE.rule}`, paddingBottom:8}}>
        <div style={{fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:800, fontSize:32, marginTop:4}}>{bi('吃冰淇淋','Ice cream trip',lang)}</div>
      </div>
      <div style={{display:'flex', gap:12, marginTop:14, alignItems:'center'}}>
        <div style={{width:64, height:64, borderRadius:4, background:'#FFCFA3', display:'flex', alignItems:'center', justifyContent:'center', fontSize:36}}>🍦</div>
        <div>
          <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:22, color:B_PALETTE.accent}}>− ★ 50</div>
          <div style={{fontSize:11, color:B_PALETTE.muted, fontWeight:700, letterSpacing:0.6}}>{bi('訂單編號 #0042','ORDER #0042',lang)}</div>
        </div>
      </div>
      <div style={{marginTop:24}}>
        {steps.map((s,i)=>(
          <div key={i} style={{display:'flex', gap:14, paddingBottom:14, borderBottom: i<steps.length-1 ? `1px solid ${B_PALETTE.border}`:'none', paddingTop: i>0?14:0}}>
            <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:13, color:B_PALETTE.muted, minWidth: 26}}>{String(i+1).padStart(2,'0')}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:11, fontWeight:800, letterSpacing:1.2, color:s.done?'#3D8B4E':s.current?B_PALETTE.accent:B_PALETTE.muted}}>{s.done?'✓ '+bi('完成','DONE',lang):s.current?bi('進行中','IN PROGRESS',lang):bi('待完成','PENDING',lang)}</div>
              <div style={{fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:800, fontSize:17, marginTop:2}}>{bi(s.zh,s.en,lang)}</div>
              <div style={{fontSize:11, color:B_PALETTE.muted, marginTop:2, fontFamily:'DM Sans, sans-serif'}}>{s.when}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function B_ParentAssign({ lang }) {
  return (
    <div style={{height:'100%', overflow:'auto', background:B_PALETTE.bg, padding:'12px 20px 24px'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
        <div style={{fontSize:18}}>‹</div>
        <div style={{fontSize:10, fontWeight:800, letterSpacing:2, color:B_PALETTE.muted}}>09 · NEW MISSION</div>
        <div style={{fontSize:12, fontWeight:800, color:B_PALETTE.primary, letterSpacing:1}}>{bi('發佈','PUBLISH',lang)}</div>
      </div>
      <div style={{borderBottom:`2px solid ${B_PALETTE.rule}`, paddingBottom:10, marginTop:10}}>
        <input placeholder={bi('任務名稱','Title',lang)} style={{border:0, background:'transparent', fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:800, fontSize:30, width:'100%', padding:0, outline:'none'}} defaultValue={bi('整理書桌','Clean your desk',lang)} />
      </div>
      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginTop:16, paddingBottom:16, borderBottom:`1px solid ${B_PALETTE.border}`}}>
        <div><div style={{fontSize:10, fontWeight:800, letterSpacing:1.5, color:B_PALETTE.muted}}>{bi('星星','STARS',lang)}</div><div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:28, color:B_PALETTE.accent, marginTop:4}}>★ 10</div></div>
        <div><div style={{fontSize:10, fontWeight:800, letterSpacing:1.5, color:B_PALETTE.muted}}>{bi('頻率','FREQUENCY',lang)}</div><div style={{fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:800, fontSize:22, marginTop:2}}>{bi('每日','Daily',lang)}</div></div>
      </div>
      <div style={{marginTop:16}}>
        <div style={{fontSize:10, fontWeight:800, letterSpacing:1.5, color:B_PALETTE.muted}}>{bi('指派給','ASSIGN TO',lang)}</div>
        <div style={{display:'flex',gap:8,marginTop:10}}>
          {window.MFK_DATA.family.kids.map((k,i)=>(
            <div key={k.id} style={{flex:1,display:'flex',gap:8,alignItems:'center',padding:10, background:i===0?B_PALETTE.surface:'transparent', border:i===0?`2px solid ${B_PALETTE.primary}`:`1px solid ${B_PALETTE.border}`, borderRadius:4}}>
              <div style={{width:28,height:28,borderRadius:9999,background:k.color,color:'#fff',fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13}}>{bi(k.zh[0],k.name[0],lang)}</div>
              <div style={{fontFamily:'var(--font-display)',fontStyle:'italic',fontWeight:800,fontSize:15}}>{bi(k.zh,k.name,lang)}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{marginTop:20}}>
        <div style={{fontSize:10, fontWeight:800, letterSpacing:1.5, color:B_PALETTE.muted}}>{bi('審核方式','REVIEW',lang)}</div>
        <div style={{marginTop:10, fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:800, fontSize:18}}>{bi('半自動 — AI 先看一下','Semi-auto — AI looks first',lang)}</div>
        <div style={{fontSize:12, color:B_PALETTE.muted, marginTop:4}}>{bi('不確定時才會找你','Only comes to you when uncertain',lang)}</div>
      </div>
    </div>
  );
}

function B_ParentReview({ lang, load }) {
  const t = useT(lang);
  const subs = load === 'light' ? [] : window.MFK_DATA.reviewQueue;
  const urgent = subs.filter(s=>s.ai!=='pass');
  const passed = subs.filter(s=>s.ai==='pass');
  return (
    <div style={{height:'100%', overflow:'auto', background:B_PALETTE.bg, paddingBottom:80}}>
      <div style={{padding:'12px 20px 0'}}>
        <div style={{borderBottom:`2px solid ${B_PALETTE.rule}`, paddingBottom:10}}>
          <div style={{fontSize:10, fontWeight:800, letterSpacing:2, color:B_PALETTE.muted}}>10 · {bi('今天的審核','TODAY IN REVIEW',lang)}</div>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end'}}>
            <div style={{fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:800, fontSize:32}}>{bi(`${subs.length} 筆`,`${subs.length} items`,lang)}</div>
            {passed.length>0 && <div style={{fontSize:11, fontWeight:800, color:B_PALETTE.primary, letterSpacing:1}}>{t('approveAll').toUpperCase()} →</div>}
          </div>
        </div>
      </div>
      {subs.length === 0 ? (
        <div style={{padding:'60px 28px', textAlign:'center'}}>
          <div style={{fontFamily:'var(--font-display)', fontStyle:'italic', fontWeight:800, fontSize:30, lineHeight:1.1}}>{t('allCaught')}.</div>
          <div style={{fontSize:13, color:B_PALETTE.muted, marginTop:8}}>{bi('回去看看孩子吧','Go see your kids',lang)}</div>
        </div>
      ) : <>
        {urgent.length>0 && <div style={{padding:'14px 20px 4px', fontSize:10, fontWeight:800, letterSpacing:2, color:'#C0392B'}}>⚠ {bi('請你看一下','YOUR CALL',lang)} · {urgent.length}</div>}
        <div style={{padding:'0 20px'}}>{urgent.map(s=><BReviewRow key={s.id} sub={s} lang={lang} />)}</div>
        {passed.length>0 && <div style={{padding:'18px 20px 4px', fontSize:10, fontWeight:800, letterSpacing:2, color:'#3D8B4E'}}>✓ AI APPROVED · {passed.length}</div>}
        <div style={{padding:'0 20px'}}>{passed.map(s=><BReviewRow key={s.id} sub={s} lang={lang} />)}</div>
      </>}
    </div>
  );
}

function BReviewRow({ sub, lang }) {
  const verdicts = { pass:{fg:'#3D8B4E',label:'AI ✓'}, uncertain:{fg:'#E88A0A',label:'AI ?'}, fail:{fg:'#C0392B',label:'AI ✗'} };
  const v = verdicts[sub.ai];
  return (
    <div style={{display:'flex',gap:14,alignItems:'center',padding:'12px 0',borderBottom:`1px solid ${B_PALETTE.border}`}}>
      <div style={{width:56,height:56,borderRadius:4,background:sub.photo,flexShrink:0}}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:10,fontWeight:800,letterSpacing:1.2,color:v.fg}}>{v.label}</div>
        <div style={{fontFamily:'var(--font-display)',fontStyle:'italic',fontWeight:800,fontSize:17, marginTop:2}}>{bi(sub.taskZh,sub.taskEn,lang)}</div>
        <div style={{fontSize:11,color:B_PALETTE.muted, fontFamily:'DM Sans,sans-serif'}}>{sub.kid} · {sub.when} · ★{sub.points}</div>
      </div>
      <div style={{display:'flex',gap:4}}>
        <div style={{width:34,height:34,background:'#3D8B4E',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800}}>✓</div>
        <div style={{width:34,height:34,background:'transparent',color:'#C0392B',border:`1px solid ${B_PALETTE.border}`,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800}}>✕</div>
      </div>
    </div>
  );
}

Object.assign(window, { B_Home, B_TaskDetail, B_Camera, B_AIReview, B_Pending, B_Celebration, B_Rewards, B_Order, B_ParentAssign, B_ParentReview });
