/* eslint-disable */
// Direction A — Warm Flat textbook. Follows DESIGN.md exactly.
// 10 screens: 01 Home · 02 Task detail · 03 Camera · 04 AI review · 05 Pending
// 06 Celebration · 07 Rewards · 08 Order progress · 09 Parent assign · 10 Parent review

const A_PALETTE = {
  bg: '#F7F2EA', surface: '#FFFDF7', primary: '#1A8A7A', primaryDark: '#146B5E',
  primaryLight: '#E0F5F0', accent: '#F5A623', accentLight: '#FFF3D6',
  text: '#1C1A14', muted: '#8A8275', border: '#D8D2C4',
};

// ----- 01 Home (child) -----
function A_Home({ lang, load, kid, parent: _p }) {
  const t = useT(lang);
  const tasks = load === 'light' ? window.MFK_DATA.tasksLight : window.MFK_DATA.tasksFull;
  const next = tasks.find(x => x.status === 'todo');
  const rest = tasks.filter(x => x !== next);

  return (
    <div style={{height: '100%', overflow: 'auto', paddingBottom: 80}}>
      {/* header */}
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 20px 12px'}}>
        <div style={{display: 'flex', gap: 10, alignItems: 'center'}}>
          <div style={{width: 40, height: 40, borderRadius: 9999, background: kid.color, color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>{bi(kid.zh[0], kid.name[0], lang)}</div>
          <div>
            <div style={{fontSize: 11, fontWeight: 800, color: A_PALETTE.muted, letterSpacing: 0.6}}>{t('today').toUpperCase()}</div>
            <div style={{fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17}}>{bi(kid.zh, kid.name, lang)}</div>
          </div>
        </div>
        <div style={{background: A_PALETTE.accentLight, color: '#8B5A00', padding: '8px 14px', borderRadius: 9999, fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 16}}>★ {kid.stars}</div>
      </div>

      {load === 'light' ? (
        <div style={{padding: '40px 20px', textAlign: 'center'}}>
          <div style={{margin: '0 auto', width: 140, height: 140, borderRadius: 9999, background: A_PALETTE.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <GeomIcon kind="check" size={72} color={A_PALETTE.primary} accent={A_PALETTE.accent} />
          </div>
          <div style={{fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, marginTop: 20}}>{bi('今天沒任務了', 'No missions today', lang)}</div>
          <div style={{fontSize: 14, color: A_PALETTE.muted, marginTop: 6}}>{bi('好好玩吧！', 'Have a great day!', lang)}</div>
        </div>
      ) : next && (
        <div style={{padding: '0 20px'}}>
          {/* hero */}
          <div style={{background: A_PALETTE.surface, border: `2px solid ${A_PALETTE.primary}`, borderRadius: 24, padding: 24, boxShadow: '0 4px 12px rgba(28,26,20,0.08)'}}>
            <div style={{fontSize: 11, fontWeight: 800, color: A_PALETTE.primary, letterSpacing: 1.2}}>{t('nextMission').toUpperCase()}</div>
            <div style={{display: 'flex', gap: 14, alignItems: 'center', marginTop: 10}}>
              <div style={{width: 56, height: 56, borderRadius: 14, background: A_PALETTE.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
                <GeomIcon kind={iconForTask(next)} size={36} color={A_PALETTE.primary} accent={A_PALETTE.accent} />
              </div>
              <div>
                <div style={{fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, lineHeight: 1.1}}>{bi(next.zh, next.en, lang)}</div>
                <div style={{color: A_PALETTE.accent, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, marginTop: 4}}>★ {next.points}</div>
              </div>
            </div>
            <div style={{background: A_PALETTE.primary, color: '#fff', padding: 16, borderRadius: 14, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17, textAlign: 'center', marginTop: 18, boxShadow: `0 3px 0 0 ${A_PALETTE.primaryDark}`}}>📷 {t('takePhoto')}</div>
          </div>

          <div style={{fontSize: 11, fontWeight: 800, color: A_PALETTE.muted, letterSpacing: 1, marginTop: 22}}>{bi('今天的其他任務', "TODAY'S OTHER MISSIONS", lang)}</div>
          <div style={{display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10}}>
            {rest.map(x => {
              const done = x.status === 'done', pending = x.status === 'pending';
              return (
                <div key={x.id} style={{display: 'flex', alignItems: 'center', gap: 12, background: A_PALETTE.surface, padding: 12, borderRadius: 14, opacity: done ? 0.6 : 1, boxShadow: '0 1px 3px rgba(28,26,20,0.06)'}}>
                  <div style={{width: 40, height: 40, borderRadius: 10, background: done ? '#E3F1E6' : A_PALETTE.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
                    {done ? <GeomIcon kind="check" size={28} color="#3D8B4E" accent="#fff"/> : <GeomIcon kind={iconForTask(x)} size={28} color={A_PALETTE.primary} accent={A_PALETTE.accent}/>}
                  </div>
                  <div style={{flex: 1}}>
                    <div style={{fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15}}>{bi(x.zh, x.en, lang)}</div>
                    <div style={{fontSize: 12, color: pending ? A_PALETTE.accent : A_PALETTE.muted, fontWeight: 700}}>
                      {done ? `★ ${x.points} ${bi('已獲得', 'earned', lang)}` : pending ? `☆ ${x.points} ${t('pendingStars')}` : `★ ${x.points}`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <AChildTabs active="tasks" lang={lang} />
    </div>
  );
}

function AChildTabs({ active, lang }) {
  const t = useT(lang);
  const tabs = [{ id: 'tasks', label: t('tasks'), icon: 'homework' }, { id: 'rewards', label: t('rewards'), icon: 'star' }, { id: 'me', label: t('me'), icon: 'check' }];
  return (
    <div style={{position: 'absolute', bottom: 0, left: 0, right: 0, background: A_PALETTE.surface, borderTop: `1px solid ${A_PALETTE.border}`, display: 'flex', padding: '8px 8px 20px'}}>
      {tabs.map(x => (
        <div key={x.id} style={{flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: active === x.id ? A_PALETTE.primary : A_PALETTE.muted, padding: '4px 0'}}>
          <GeomIcon kind={x.icon} size={26} color={active === x.id ? A_PALETTE.primary : A_PALETTE.muted} accent={active === x.id ? A_PALETTE.accent : A_PALETTE.muted} />
          <span style={{fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 11}}>{x.label}</span>
        </div>
      ))}
    </div>
  );
}

// ----- 02 Task detail -----
function A_TaskDetail({ lang, kid }) {
  const t = useT(lang);
  const task = window.MFK_DATA.tasksFull[0];
  return (
    <div style={{height: '100%', overflow: 'auto', paddingBottom: 24}}>
      <div style={{padding: '8px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <div style={{width: 40, height: 40, borderRadius: 12, background: A_PALETTE.surface, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(28,26,20,0.06)'}}>
          <span style={{fontSize: 22}}>‹</span>
        </div>
        <div style={{fontSize: 11, fontWeight: 800, color: A_PALETTE.muted, letterSpacing: 1}}>{bi('任務詳情', 'TASK DETAIL', lang)}</div>
        <div style={{width: 40}} />
      </div>
      <div style={{padding: '16px 20px'}}>
        <div style={{background: A_PALETTE.primaryLight, borderRadius: 24, padding: 40, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <GeomIcon kind={iconForTask(task)} size={120} color={A_PALETTE.primary} accent={A_PALETTE.accent} />
        </div>
        <div style={{fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 32, marginTop: 20, lineHeight: 1.1}}>{bi(task.zh, task.en, lang)}</div>
        <div style={{display: 'flex', gap: 6, marginTop: 12}}>
          <span style={{background: A_PALETTE.accentLight, color: '#8B5A00', padding: '5px 12px', borderRadius: 9999, fontSize: 13, fontWeight: 800}}>★ {task.points}</span>
          <span style={{background: A_PALETTE.primaryLight, color: A_PALETTE.primaryDark, padding: '5px 12px', borderRadius: 9999, fontSize: 13, fontWeight: 800}}>{bi('今天到期', 'Due today', lang)}</span>
        </div>
        <div style={{background: A_PALETTE.surface, padding: 16, borderRadius: 14, marginTop: 20, boxShadow: '0 1px 3px rgba(28,26,20,0.06)'}}>
          <div style={{fontSize: 13, fontWeight: 800, color: A_PALETTE.muted, letterSpacing: 0.6}}>{bi('家長的提示', 'NOTE FROM PARENT', lang)}</div>
          <div style={{fontSize: 15, marginTop: 6}}>{bi('記得把書本放回書櫃，鉛筆也要收好喔！', 'Put the books back on the shelf and tidy up your pencils!', lang)}</div>
        </div>
        <div style={{background: A_PALETTE.primary, color: '#fff', padding: 18, borderRadius: 14, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, textAlign: 'center', marginTop: 20, boxShadow: `0 3px 0 0 ${A_PALETTE.primaryDark}`}}>📷 {t('takePhoto')}</div>
      </div>
    </div>
  );
}

// ----- 03 Camera -----
function A_Camera({ lang }) {
  const task = window.MFK_DATA.tasksFull[0];
  return (
    <div style={{height: '100%', background: '#1C1A14', display: 'flex', flexDirection: 'column'}}>
      <div style={{padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <div style={{width: 40, height: 40, borderRadius: 9999, background: 'rgba(255,255,255,0.18)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700}}>✕</div>
        <div style={{color: '#fff', background: 'rgba(0,0,0,0.4)', padding: '8px 14px', borderRadius: 9999, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15}}>📷 {bi(task.zh, task.en, lang)}</div>
        <div style={{width: 40}} />
      </div>
      <div style={{flex: 1, margin: '0 16px', borderRadius: 20, background: 'linear-gradient(135deg,#2a2620 0%, #12110D 100%)', position: 'relative', overflow: 'hidden'}}>
        {/* viewfinder dashed frame */}
        <div style={{position: 'absolute', inset: 20, border: '2px dashed rgba(255,255,255,0.2)', borderRadius: 14}} />
        {/* desk-ish hint */}
        <div style={{position: 'absolute', bottom: 40, left: 30, right: 30, height: 120, background: 'linear-gradient(180deg,#3a3428,#2a251d)', borderRadius: 8, opacity: 0.9}} />
        {/* Pip peeking */}
        <div style={{position: 'absolute', bottom: 16, right: 16}}>
          <Owl size={56} mood="watch" direction="A" />
        </div>
      </div>
      <div style={{padding: '20px 0 36px', display: 'flex', justifyContent: 'center', gap: 40, alignItems: 'center'}}>
        <div style={{width: 44, height: 44, borderRadius: 9999, background: 'rgba(255,255,255,0.15)'}} />
        <div style={{width: 80, height: 80, borderRadius: 9999, background: '#fff', border: '6px solid rgba(255,255,255,0.3)'}} />
        <div style={{width: 44, height: 44, borderRadius: 9999, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'}}>↻</div>
      </div>
    </div>
  );
}

// ----- 04 AI review -----
function A_AIReview({ lang }) {
  const t = useT(lang);
  return (
    <div style={{height: '100%', background: A_PALETTE.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center'}}>
      <div style={{position: 'relative', width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <div style={{position: 'absolute', inset: 0, borderRadius: 9999, background: A_PALETTE.primaryLight}} />
        <div style={{position: 'absolute', inset: -6, border: `3px dashed ${A_PALETTE.primary}`, borderRadius: 9999, animation: 'aspin 3s linear infinite'}} />
        <Owl size={120} mood="think" direction="A" />
      </div>
      <div style={{fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, marginTop: 28, lineHeight: 1.2}}>{t('aiLooking')}</div>
      <div style={{fontSize: 13, color: A_PALETTE.muted, marginTop: 8}}>{bi('Pip 貓頭鷹正在檢查…', 'Pip the owl is checking…', lang)}</div>
      <div style={{display: 'flex', gap: 6, marginTop: 20}}>
        <div style={{width: 8, height: 8, borderRadius: 9999, background: A_PALETTE.primary, animation: 'bounce 1.4s ease-in-out infinite'}} />
        <div style={{width: 8, height: 8, borderRadius: 9999, background: A_PALETTE.primary, animation: 'bounce 1.4s ease-in-out 0.2s infinite'}} />
        <div style={{width: 8, height: 8, borderRadius: 9999, background: A_PALETTE.primary, animation: 'bounce 1.4s ease-in-out 0.4s infinite'}} />
      </div>
      <style>{`@keyframes aspin{to{transform:rotate(360deg)}} @keyframes bounce{0%,100%{transform:translateY(0);opacity:0.4}50%{transform:translateY(-6px);opacity:1}}`}</style>
    </div>
  );
}

// ----- 05 Pending -----
function A_Pending({ lang }) {
  const t = useT(lang);
  const task = window.MFK_DATA.tasksFull[0];
  return (
    <div style={{height: '100%', padding: '16px 20px 24px', overflow: 'auto'}}>
      <div style={{textAlign: 'center', paddingTop: 20}}>
        <div style={{display: 'inline-flex', alignItems: 'center', gap: 6, background: A_PALETTE.accentLight, color: '#8B5A00', padding: '6px 14px', borderRadius: 9999, fontWeight: 800, fontSize: 13}}>
          <span>AI ✓</span><span>{bi('AI 通過，等家長確認', 'AI passed · waiting for parent', lang)}</span>
        </div>
      </div>
      <div style={{marginTop: 20, background: A_PALETTE.surface, borderRadius: 20, padding: 24, textAlign: 'center', boxShadow: '0 4px 12px rgba(28,26,20,0.08)'}}>
        <div style={{margin: '0 auto', width: 140, height: 100, borderRadius: 14, background: 'linear-gradient(135deg,#C0AC80,#8A7A54)'}} />
        <div style={{fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, marginTop: 16}}>{bi(task.zh, task.en, lang)}</div>
        <div style={{display: 'flex', justifyContent: 'center', gap: 10, marginTop: 12, alignItems: 'center'}}>
          <div style={{fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 32, color: A_PALETTE.accent, fontVariantNumeric: 'tabular-nums'}}>☆ {task.points}</div>
          <div style={{fontSize: 13, color: A_PALETTE.muted, fontWeight: 700}}>{t('pendingStars')}</div>
        </div>
        <div style={{fontSize: 13, color: A_PALETTE.muted, marginTop: 10}}>{bi('家長確認後會變成 ★', 'Becomes ★ after parent approves', lang)}</div>
      </div>
      <div style={{marginTop: 16, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', background: A_PALETTE.primaryLight, borderRadius: 12}}>
        <Owl size={36} mood="watch" direction="A" />
        <div style={{fontSize: 13, color: A_PALETTE.primaryDark, fontWeight: 700}}>{bi('Pip 會幫你盯著！', 'Pip is keeping watch!', lang)}</div>
      </div>
    </div>
  );
}

// ----- 06 Celebration -----
function A_Celebration({ lang, motion }) {
  const t = useT(lang);
  const confetti = motion !== 'reduce';
  return (
    <div style={{height: '100%', background: A_PALETTE.bg, position: 'relative', overflow: 'hidden'}}>
      {confetti && <>
        {[...Array(18)].map((_, i) => (
          <span key={i} style={{position: 'absolute', left: `${(i * 41) % 95}%`, top: `${(i * 27) % 80}%`, color: i % 2 ? A_PALETTE.accent : A_PALETTE.primary, fontSize: 12 + (i % 4) * 6, fontFamily: 'var(--font-display)', fontWeight: 800, transform: `rotate(${i * 37}deg)`, animation: `conf 1.8s ease-out ${(i*0.06)}s`}}>★</span>
        ))}
      </>}
      <div style={{height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center'}}>
        <div style={{fontSize: 120, color: A_PALETTE.accent, fontFamily: 'var(--font-display)', fontWeight: 800, lineHeight: 1}}>★</div>
        <div style={{fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 36, marginTop: 16}}>{t('niceJob')}</div>
        <div style={{fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 48, color: A_PALETTE.accent, marginTop: 14, fontVariantNumeric: 'tabular-nums'}}>+10 ★</div>
        <div style={{fontSize: 14, color: A_PALETTE.muted, marginTop: 8}}>{bi('總共：★ 152', 'Total: ★ 152', lang)}</div>
        <div style={{background: A_PALETTE.primary, color: '#fff', padding: '14px 28px', borderRadius: 14, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17, marginTop: 32, boxShadow: `0 3px 0 0 ${A_PALETTE.primaryDark}`}}>{bi('繼續任務', 'Keep going', lang)}</div>
      </div>
      <style>{`@keyframes conf{0%{transform:translateY(-20px) rotate(0);opacity:0}40%{opacity:1}100%{transform:translateY(20px) rotate(280deg);opacity:0}}`}</style>
    </div>
  );
}

// ----- 07 Rewards -----
function A_Rewards({ lang, kid }) {
  const t = useT(lang);
  return (
    <div style={{height: '100%', overflow: 'auto', padding: '12px 20px 80px'}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <div style={{fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26}}>{t('rewards')}</div>
        <div style={{background: A_PALETTE.accentLight, color: '#8B5A00', padding: '8px 14px', borderRadius: 9999, fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 16}}>★ {kid.stars}</div>
      </div>
      <div style={{fontSize: 13, color: A_PALETTE.muted, marginTop: 4}}>{bi('用星星換你想要的', 'Spend stars on what you want', lang)}</div>
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16}}>
        {window.MFK_DATA.rewards.map(r => {
          const ok = kid.stars >= r.cost;
          return (
            <div key={r.id} style={{background: A_PALETTE.surface, borderRadius: 16, padding: 12, boxShadow: '0 1px 3px rgba(28,26,20,0.06)', opacity: ok ? 1 : 0.55}}>
              <div style={{aspectRatio: 1, borderRadius: 12, background: r.color, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative'}}>
                <div style={{fontSize: 48}}>{r.emoji}</div>
                <div style={{position: 'absolute', top: 6, right: 6, fontSize: 10, background: 'rgba(255,255,255,0.8)', padding: '2px 6px', borderRadius: 4, color: A_PALETTE.muted, fontWeight: 700}}>{bi('照片', 'PHOTO', lang)}</div>
              </div>
              <div style={{fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, marginTop: 10}}>{bi(r.zh, r.en, lang)}</div>
              <div style={{color: A_PALETTE.accent, fontWeight: 800, fontSize: 14}}>★ {r.cost}</div>
              {!ok && <div style={{fontSize: 11, color: A_PALETTE.muted, fontWeight: 700, marginTop: 2}}>{t('needMore', {n: r.cost - kid.stars})}</div>}
            </div>
          );
        })}
      </div>
      <AChildTabs active="rewards" lang={lang} />
    </div>
  );
}

// ----- 08 Order progress -----
function A_Order({ lang }) {
  const steps = [
    { key: 'pending', zh: '已下單', en: 'Ordered', done: true },
    { key: 'approved', zh: '爸媽確認', en: 'Parent confirmed', done: true },
    { key: 'delivered', zh: '已交付', en: 'Delivered', done: false, current: true },
    { key: 'completed', zh: '你確認收到', en: 'You confirm', done: false },
  ];
  return (
    <div style={{height: '100%', overflow: 'auto', padding: '16px 20px'}}>
      <div style={{fontSize: 11, fontWeight: 800, color: A_PALETTE.muted, letterSpacing: 1}}>{bi('獎勵進度', 'REWARD PROGRESS', lang)}</div>
      <div style={{background: A_PALETTE.surface, borderRadius: 20, padding: 20, marginTop: 10, boxShadow: '0 4px 12px rgba(28,26,20,0.08)'}}>
        <div style={{display: 'flex', gap: 14, alignItems: 'center'}}>
          <div style={{width: 72, height: 72, borderRadius: 14, background: '#FFCFA3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36}}>🍦</div>
          <div>
            <div style={{fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20}}>{bi('吃冰淇淋', 'Ice cream trip', lang)}</div>
            <div style={{fontSize: 13, color: A_PALETTE.muted}}>{bi('下單時間 · 昨天 7:30 PM', 'Ordered · Yesterday 7:30 PM', lang)}</div>
            <div style={{color: A_PALETTE.accent, fontWeight: 800, fontSize: 16, marginTop: 2}}>− ★ 50</div>
          </div>
        </div>
      </div>
      <div style={{marginTop: 20}}>
        {steps.map((s, i) => (
          <div key={s.key} style={{display: 'flex', gap: 14, alignItems: 'stretch'}}>
            <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
              <div style={{width: 28, height: 28, borderRadius: 9999, background: s.done ? A_PALETTE.primary : s.current ? A_PALETTE.accent : A_PALETTE.border, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14}}>{s.done ? '✓' : i+1}</div>
              {i < steps.length - 1 && <div style={{flex: 1, width: 2, background: s.done ? A_PALETTE.primary : A_PALETTE.border, minHeight: 32}} />}
            </div>
            <div style={{paddingBottom: 20, paddingTop: 2}}>
              <div style={{fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: s.done || s.current ? A_PALETTE.text : A_PALETTE.muted}}>{bi(s.zh, s.en, lang)}</div>
              {s.current && <div style={{fontSize: 13, color: A_PALETTE.accent, fontWeight: 700, marginTop: 2}}>{bi('進行中 · 72 小時後自動完成', 'In progress · auto-completes in 72h', lang)}</div>}
            </div>
          </div>
        ))}
      </div>
      <div style={{marginTop: 6, padding: 14, background: A_PALETTE.primaryLight, borderRadius: 12, display: 'flex', gap: 10, alignItems: 'center'}}>
        <Owl size={36} mood="cheer" direction="A" />
        <div style={{fontSize: 13, color: A_PALETTE.primaryDark, fontWeight: 700}}>{bi('記得拿到後按「我收到了」', 'Remember to tap "I got it" when delivered', lang)}</div>
      </div>
    </div>
  );
}

// ----- 09 Parent assign -----
function A_ParentAssign({ lang }) {
  const t = useT(lang);
  return (
    <div style={{height: '100%', overflow: 'auto', padding: '12px 20px'}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <div style={{fontSize: 20}}>‹</div>
        <div style={{fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17}}>{t('assign')}</div>
        <div style={{color: A_PALETTE.primary, fontWeight: 800, fontSize: 14}}>{t('save')}</div>
      </div>
      <div style={{marginTop: 16}}>
        <label style={{fontSize: 12, fontWeight: 800, color: A_PALETTE.muted, letterSpacing: 0.6}}>{bi('任務名稱', 'TITLE', lang)}</label>
        <div style={{background: A_PALETTE.surface, border: `1px solid ${A_PALETTE.border}`, borderRadius: 12, padding: 14, marginTop: 6, fontSize: 17, fontFamily: 'var(--font-display)', fontWeight: 700}}>{bi('整理書桌', 'Clean your desk', lang)}</div>
      </div>
      <div style={{display: 'flex', gap: 12, marginTop: 16}}>
        <div style={{flex: 1}}>
          <label style={{fontSize: 12, fontWeight: 800, color: A_PALETTE.muted, letterSpacing: 0.6}}>{bi('星星', 'STARS', lang)}</label>
          <div style={{background: A_PALETTE.surface, border: `1px solid ${A_PALETTE.border}`, borderRadius: 12, padding: 14, marginTop: 6, fontFamily: 'DM Sans, sans-serif', fontWeight: 700, fontSize: 20, color: A_PALETTE.accent}}>★ 10</div>
        </div>
        <div style={{flex: 1}}>
          <label style={{fontSize: 12, fontWeight: 800, color: A_PALETTE.muted, letterSpacing: 0.6}}>{bi('頻率', 'FREQUENCY', lang)}</label>
          <div style={{background: A_PALETTE.surface, border: `1px solid ${A_PALETTE.border}`, borderRadius: 12, padding: 14, marginTop: 6, fontSize: 15, fontWeight: 700}}>{bi('每日 ▾', 'Daily ▾', lang)}</div>
        </div>
      </div>
      <div style={{marginTop: 16}}>
        <label style={{fontSize: 12, fontWeight: 800, color: A_PALETTE.muted, letterSpacing: 0.6}}>{t('assignee').toUpperCase()}</label>
        <div style={{display: 'flex', gap: 8, marginTop: 8}}>
          {window.MFK_DATA.family.kids.map((k, i) => (
            <div key={k.id} style={{flex: 1, background: i === 0 ? A_PALETTE.primaryLight : A_PALETTE.surface, border: i === 0 ? `2px solid ${A_PALETTE.primary}` : `1px solid ${A_PALETTE.border}`, borderRadius: 12, padding: 12, display: 'flex', gap: 10, alignItems: 'center'}}>
              <div style={{width: 32, height: 32, borderRadius: 9999, background: k.color, color: '#fff', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>{bi(k.zh[0], k.name[0], lang)}</div>
              <div style={{fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15}}>{bi(k.zh, k.name, lang)}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{marginTop: 16}}>
        <label style={{fontSize: 12, fontWeight: 800, color: A_PALETTE.muted, letterSpacing: 0.6}}>{t('reviewMode').toUpperCase()}</label>
        <div style={{display: 'flex', gap: 8, marginTop: 8}}>
          {[{k: 'semi_auto', zh: '半自動', en: 'Semi-auto'}, {k: 'manual', zh: '人工', en: 'Manual'}].map((m, i) => (
            <div key={m.k} style={{flex: 1, background: i === 0 ? '#D8EAF4' : A_PALETTE.surface, border: i === 0 ? '2px solid #2E86C1' : `1px solid ${A_PALETTE.border}`, borderRadius: 12, padding: 12, textAlign: 'center', fontWeight: 800, fontSize: 14, color: i === 0 ? '#164A75' : A_PALETTE.text}}>{bi(m.zh, m.en, lang)}</div>
          ))}
        </div>
        <div style={{fontSize: 12, color: A_PALETTE.muted, marginTop: 8}}>{bi('AI 先看，不確定時由你來判斷', 'AI checks first, you decide when uncertain', lang)}</div>
      </div>
    </div>
  );
}

// ----- 10 Parent review -----
function A_ParentReview({ lang, load }) {
  const t = useT(lang);
  const subs = load === 'light' ? [] : window.MFK_DATA.reviewQueue;
  const urgent = subs.filter(s => s.ai !== 'pass');
  const passed = subs.filter(s => s.ai === 'pass');
  return (
    <div style={{height: '100%', overflow: 'auto', padding: '12px 20px 80px'}}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <div>
          <div style={{fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26}}>{t('review')}</div>
          <div style={{fontSize: 13, color: A_PALETTE.muted}}>{bi(`${subs.length} 筆待審核`, `${subs.length} pending`, lang)}</div>
        </div>
        {passed.length > 0 && <div style={{background: A_PALETTE.primary, color: '#fff', padding: '10px 14px', borderRadius: 12, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13, boxShadow: `0 3px 0 0 ${A_PALETTE.primaryDark}`}}>{t('approveAll')} ({passed.length})</div>}
      </div>
      {subs.length === 0 ? (
        <div style={{textAlign: 'center', padding: '60px 20px'}}>
          <div style={{margin: '0 auto', width: 120, height: 120, borderRadius: 9999, background: A_PALETTE.primaryLight, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
            <GeomIcon kind="check" size={64} color={A_PALETTE.primary} accent={A_PALETTE.accent} />
          </div>
          <div style={{fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, marginTop: 20}}>{t('allCaught')}</div>
          <div style={{fontSize: 14, color: A_PALETTE.muted, marginTop: 4}}>{bi('今天沒有任務要審', 'No submissions today', lang)}</div>
        </div>
      ) : (
        <>
          {urgent.length > 0 && <div style={{marginTop: 18, fontSize: 11, fontWeight: 800, color: '#E88A0A', letterSpacing: 1}}>⚠ {t('needsAttention').toUpperCase()} · {urgent.length}</div>}
          <div style={{display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10}}>
            {urgent.map(s => <AReviewRow key={s.id} sub={s} lang={lang} urgent />)}
          </div>
          {passed.length > 0 && <div style={{marginTop: 20, fontSize: 11, fontWeight: 800, color: A_PALETTE.primary, letterSpacing: 1}}>✓ {t('aiApproved').toUpperCase()} · {passed.length}</div>}
          <div style={{display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10}}>
            {passed.map(s => <AReviewRow key={s.id} sub={s} lang={lang} />)}
          </div>
        </>
      )}
    </div>
  );
}

function AReviewRow({ sub, lang, urgent }) {
  const verdicts = {
    pass: { bg: '#E3F1E6', fg: '#1F5A2C', label: 'AI ✓' },
    uncertain: { bg: '#FCEBCD', fg: '#7A4806', label: 'AI ?' },
    fail: { bg: '#F7DCD7', fg: '#7A1F14', label: 'AI ✗' },
  };
  const v = verdicts[sub.ai];
  return (
    <div style={{display: 'flex', gap: 10, alignItems: 'center', background: A_PALETTE.surface, padding: 12, borderRadius: 14, boxShadow: '0 1px 3px rgba(28,26,20,0.06)', border: urgent ? '1px solid #E88A0A33' : 'none'}}>
      <div style={{width: 60, height: 60, borderRadius: 10, background: sub.photo, flexShrink: 0, position: 'relative'}}>
        <span style={{position: 'absolute', top: -6, left: -6, background: v.bg, color: v.fg, fontWeight: 800, fontSize: 10, padding: '2px 5px', borderRadius: 6}}>{v.label}</span>
      </div>
      <div style={{flex: 1, minWidth: 0}}>
        <div style={{fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15}}>{bi(sub.taskZh, sub.taskEn, lang)}</div>
        <div style={{fontSize: 12, color: A_PALETTE.muted}}>{sub.kid} · {sub.when} · ★ {sub.points}</div>
      </div>
      <div style={{display: 'flex', gap: 6}}>
        <div style={{width: 38, height: 38, borderRadius: 10, background: '#3D8B4E', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 18}}>✓</div>
        <div style={{width: 38, height: 38, borderRadius: 10, background: '#F7DCD7', color: '#C0392B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16}}>✕</div>
      </div>
    </div>
  );
}

Object.assign(window, { A_Home, A_TaskDetail, A_Camera, A_AIReview, A_Pending, A_Celebration, A_Rewards, A_Order, A_ParentAssign, A_ParentReview });
