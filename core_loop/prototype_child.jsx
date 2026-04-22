/* eslint-disable */
// Child-side screens, connected to MFKStore.
// All screens assume world is loaded; they read state on render.

// ============ CHILD · Tasks Home ============
function ChildTasksHome({ kidId, onOpenTask }){
  MFKStore.useWorld();
  const kid = MFKStore.select.kid(kidId);
  const tasks = MFKStore.select.tasksForKid(kidId).filter(t => !t.paused);
  const todo = tasks.filter(t => t.state === 'todo' || t.state === 'rejected');
  const inFlight = tasks.filter(t => t.state === 'submitted');
  const doneToday = tasks.filter(t => t.state === 'approved');
  const total = tasks.length;
  const pct = total ? Math.round((doneToday.length/total)*100) : 0;

  const Card = ({t, tone}) => (
    <div onClick={()=>onOpenTask(t.id)} style={{padding:'14px', background:P.surface, border:`1px solid ${P.border}`, borderRadius:14, marginBottom:8, cursor:'pointer', display:'flex', alignItems:'center', gap:12, position:'relative', overflow:'hidden'}}>
      {t.state === 'rejected' && <div style={{position:'absolute', left:0, top:0, bottom:0, width:4, background:P.accentHot}}/>}
      <div style={{width:44, height:44, borderRadius:12, background:tone==='done'?`${P.green}22`:tone==='pending'?`${P.accent}22`:`${P.primary}18`, border:`1px solid ${P.border}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:22}}>{t.emoji}</div>
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:15, textDecoration: tone==='done'?'line-through':'none', color: tone==='done'?P.muted:P.text}}>{t.zh}</div>
        <div style={{fontSize:11, color:P.muted, marginTop:2}}>
          {t.state==='todo' && '今天要做'}
          {t.state==='rejected' && <span style={{color:P.accentHot, fontWeight:700}}>要再試一次 · {t.parentNote || ''}</span>}
          {t.state==='submitted' && <span style={{color:P.accent, fontWeight:700}}>⏳ 等爸媽看 · {MFKStore.fmtWhen(t.submittedAt)}</span>}
          {t.state==='approved' && '完成 ✓'}
        </div>
      </div>
      <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:14, color: tone==='done'?P.muted:P.primary, flexShrink:0}}>★ {t.points}</div>
    </div>
  );

  return (
    <div style={{flex:1, overflow:'auto', position:'relative'}}>
      <PStarfield count={22}/>
      <div style={{padding:'18px 22px 0', position:'relative', zIndex:1}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
          <div>
            <div style={{fontSize:11, fontWeight:800, letterSpacing:1.5, color:P.muted}}>今天的任務</div>
            <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:26, marginTop:2}}>嗨，{kid.zh}</div>
          </div>
          <div style={{padding:'6px 12px', borderRadius:9999, background:`${P.primary}18`, border:`1px solid ${P.border}`, display:'flex', alignItems:'center', gap:6}}>
            <PRoughStar size={14}/>
            <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:14, color:P.primary}}>{kid.stars}</div>
          </div>
        </div>
        {/* Progress */}
        <div style={{marginTop:14, padding:14, background:P.surface, borderRadius:14, border:`1px solid ${P.border}`}}>
          <div style={{display:'flex', justifyContent:'space-between', marginBottom:8}}>
            <div style={{fontSize:11, fontWeight:800, color:P.muted, letterSpacing:1}}>今天完成 {doneToday.length}/{total}</div>
            <div style={{fontSize:11, fontWeight:800, color:P.primary, fontFamily:'DM Sans,sans-serif'}}>{pct}%</div>
          </div>
          <div style={{height:6, borderRadius:9999, background:P.surfaceHi, overflow:'hidden'}}>
            <div style={{height:'100%', width: pct+'%', background:`linear-gradient(to right, ${P.primary}, ${P.accent})`, transition:'width 0.4s'}}/>
          </div>
        </div>
      </div>
      <div style={{padding:'18px 22px 100px', position:'relative', zIndex:1}}>
        {todo.length > 0 && (<>
          <div style={{fontSize:11, fontWeight:800, letterSpacing:1.5, color:P.muted, marginBottom:8}}>要做的</div>
          {todo.map(t => <Card key={t.id} t={t} tone="todo"/>)}
        </>)}
        {inFlight.length > 0 && (<>
          <div style={{fontSize:11, fontWeight:800, letterSpacing:1.5, color:P.muted, marginBottom:8, marginTop:14}}>等爸媽看</div>
          {inFlight.map(t => <Card key={t.id} t={t} tone="pending"/>)}
        </>)}
        {doneToday.length > 0 && (<>
          <div style={{fontSize:11, fontWeight:800, letterSpacing:1.5, color:P.muted, marginBottom:8, marginTop:14}}>完成了</div>
          {doneToday.map(t => <Card key={t.id} t={t} tone="done"/>)}
        </>)}
        {tasks.length === 0 && <PEmpty emoji="✦" title="今天沒有任務" body="休息一下，明天再來！"/>}
      </div>
    </div>
  );
}

// ============ CHILD · Task Detail / Submit ============
function ChildTaskDetail({ kidId, taskId, onClose, onSubmit }){
  MFKStore.useWorld();
  const t = MFKStore.select.task(taskId);
  const [hasPhoto, setHasPhoto] = React.useState(false);
  if (!t) return null;
  return (
    <div style={{position:'absolute', inset:0, background:P.bg, zIndex:10, display:'flex', flexDirection:'column'}}>
      <PStarfield count={20}/>
      {/* Sheet header */}
      <div style={{padding:'10px 0 6px', display:'flex', justifyContent:'center', alignItems:'center', position:'relative', zIndex:2}}>
        <div style={{width:44, height:5, borderRadius:9999, background:'rgba(247,242,234,0.25)'}}/>
        <div onClick={onClose} title="關閉" style={{position:'absolute', right:18, top:8, width:32, height:32, borderRadius:9999, background:'rgba(247,242,234,0.08)', border:`1px solid ${P.border}`, display:'flex', alignItems:'center', justifyContent:'center', color:P.muted, fontSize:14, cursor:'pointer'}}>✕</div>
      </div>
      <div style={{flex:1, overflow:'auto', padding:'8px 22px 20px', position:'relative', zIndex:1}}>
        <div style={{fontSize:11, fontWeight:800, letterSpacing:1.5, color:P.muted}}>任務</div>
        <div style={{display:'flex', alignItems:'center', gap:14, marginTop:8}}>
          <div style={{width:64, height:64, borderRadius:16, background:`${P.primary}18`, border:`1px solid ${P.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:34}}>{t.emoji}</div>
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:22}}>{t.zh}</div>
            <div style={{fontSize:13, color:P.muted, marginTop:2}}>做完 +★ {t.points}</div>
          </div>
        </div>

        {t.state === 'rejected' && (
          <div style={{marginTop:14, padding:14, borderRadius:14, background:`${P.accentHot}18`, border:`1px solid ${P.accentHot}33`}}>
            <div style={{fontSize:11, fontWeight:800, letterSpacing:1, color:P.accentHot}}>爸媽說要再試一次</div>
            <div style={{fontSize:14, color:P.text, marginTop:6, lineHeight:1.5}}>{t.parentNote || '可以再做一次喔！'}</div>
          </div>
        )}

        {/* Photo capture card */}
        <div style={{marginTop:16, aspectRatio:'4/3', borderRadius:18, background: hasPhoto ? 'linear-gradient(135deg,#C0AC80,#8A7A54)' : P.surface, border:`1.5px dashed ${P.border}`, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', position:'relative', overflow:'hidden', cursor:'pointer'}} onClick={()=>setHasPhoto(h => !h)}>
          {hasPhoto ? (
            <div style={{position:'absolute', right:12, top:12, padding:'4px 10px', borderRadius:9999, background:'rgba(11,14,26,0.6)', color:P.text, fontSize:11, fontWeight:800}}>點一下重拍</div>
          ) : (<>
            <div style={{fontSize:48}}>📷</div>
            <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:16, marginTop:8}}>拍一張照給爸媽看</div>
            <div style={{fontSize:12, color:P.muted, marginTop:4}}>點一下拍照</div>
          </>)}
        </div>

        <div style={{marginTop:14, padding:14, background:P.surface, borderRadius:14, border:`1px solid ${P.border}`}}>
          <div style={{fontSize:11, fontWeight:800, letterSpacing:1, color:P.muted}}>想說什麼？（選填）</div>
          <div style={{marginTop:8, padding:'10px 12px', background:P.bg, borderRadius:10, border:`1px dashed ${P.border}`, fontSize:13, color:P.text, lineHeight:1.5, minHeight:44}}>
            {t.zh === '整理書桌' ? '書跟鉛筆都放回去了！' : '做完囉～'}
          </div>
        </div>
      </div>
      <div style={{padding:'12px 22px 22px', flexShrink:0, borderTop:`1px solid ${P.border}`, display:'flex', gap:10, alignItems:'center', background:P.bg, position:'relative', zIndex:2}}>
        <div onClick={onClose} style={{padding:'13px 16px', borderRadius:9999, border:`1px solid ${P.border}`, color:P.muted, fontSize:13, fontWeight:800, cursor:'pointer'}}>晚點做</div>
        <div onClick={()=>hasPhoto && onSubmit(taskId)} style={{flex:1, padding:'13px 16px', borderRadius:9999, background: hasPhoto?P.primary:P.surfaceHi, color: hasPhoto?P.bg:P.muted, fontFamily:'var(--font-display)', fontWeight:800, fontSize:15, textAlign:'center', cursor: hasPhoto?'pointer':'default', boxShadow: hasPhoto?'0 8px 24px rgba(255,217,102,0.28)':'none', display:'flex', alignItems:'center', justifyContent:'center', gap:8}}>
          <PRoughStar size={16} color={hasPhoto?P.bg:P.muted}/>
          完成任務
        </div>
      </div>
    </div>
  );
}

// ============ CHILD · Wait / Pending (sheet while parent reviews) ============
function ChildWait({ kidId, taskId, onClose, onSeeResult }){
  MFKStore.useWorld();
  const t = MFKStore.select.task(taskId);
  if (!t) return null;
  const isSettled = t.state === 'approved' || t.state === 'rejected';
  // Elapsed time
  const [, force] = React.useReducer(x=>x+1,0);
  React.useEffect(()=>{ const id=setInterval(force,1000); return ()=>clearInterval(id); },[]);
  const waitText = t.submittedAt ? MFKStore.fmtWhen(t.submittedAt) : '剛剛';

  return (
    <div style={{position:'absolute', inset:0, background:P.bg, zIndex:10, display:'flex', flexDirection:'column'}}>
      <PStarfield count={40}/>
      <div style={{padding:'10px 0 6px', display:'flex', justifyContent:'center', alignItems:'center', position:'relative', zIndex:2}}>
        <div style={{width:44, height:5, borderRadius:9999, background:'rgba(247,242,234,0.25)'}}/>
        <div onClick={onClose} style={{position:'absolute', right:18, top:8, width:32, height:32, borderRadius:9999, background:'rgba(247,242,234,0.08)', border:`1px solid ${P.border}`, display:'flex', alignItems:'center', justifyContent:'center', color:P.muted, fontSize:14, cursor:'pointer'}}>✕</div>
      </div>
      <div style={{flex:1, overflow:'auto', padding:'24px 22px', position:'relative', zIndex:1, display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center'}}>
        <div style={{fontSize:72, marginBottom:12, filter: isSettled?'none':'drop-shadow(0 0 24px rgba(255,217,102,0.4))'}}>
          {t.state === 'submitted' && '✨'}
          {t.state === 'approved' && '🎉'}
          {t.state === 'rejected' && '📮'}
        </div>
        <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:28, lineHeight:1.2}}>
          {t.state === 'submitted' && '星光傳送中…'}
          {t.state === 'approved' && `${t.zh} 通過啦！`}
          {t.state === 'rejected' && '爸媽回信了'}
        </div>
        <div style={{fontSize:14, color:P.muted, marginTop:8, maxWidth:280, lineHeight:1.5}}>
          {t.state === 'submitted' && `等爸媽看一眼就好 · ${waitText}`}
          {t.state === 'approved' && `+★ ${t.points}，好棒！`}
          {t.state === 'rejected' && t.parentNote}
        </div>

        {t.state === 'submitted' && (
          <div style={{marginTop:32, width:'100%', maxWidth:320, padding:20, background:P.surface, borderRadius:18, border:`1px solid ${P.border}`}}>
            <div style={{display:'flex', gap:14, alignItems:'center'}}>
              <div style={{width:48, height:48, borderRadius:12, background:`${P.primary}18`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:26}}>{t.emoji}</div>
              <div style={{flex:1, textAlign:'left'}}>
                <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:15}}>{t.zh}</div>
                <div style={{fontSize:12, color:P.muted, marginTop:2}}>提交 {waitText}</div>
              </div>
              <PRoughStar size={16}/>
              <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:14, color:P.primary}}>{t.points}</div>
            </div>
            <div style={{marginTop:14, height:3, borderRadius:9999, background:P.surfaceHi, overflow:'hidden'}}>
              <div style={{height:'100%', width:'60%', background:`linear-gradient(to right, transparent, ${P.primary}, transparent)`, animation:'pShimmer 1.8s linear infinite'}}/>
            </div>
          </div>
        )}

        <style>{`@keyframes pShimmer{0%{transform:translateX(-100%)}100%{transform:translateX(240%)}}`}</style>
      </div>
      <div style={{padding:'12px 22px 22px', flexShrink:0, display:'flex', gap:10}}>
        {t.state === 'submitted' && (
          <div onClick={onClose} style={{flex:1, padding:'13px', borderRadius:9999, border:`1px solid ${P.border}`, color:P.text, fontSize:14, fontWeight:800, textAlign:'center', cursor:'pointer'}}>回到任務</div>
        )}
        {t.state === 'approved' && (<>
          <div onClick={onClose} style={{flex:1, padding:'13px', borderRadius:9999, background:'rgba(247,242,234,0.08)', color:P.text, fontSize:13, fontWeight:800, textAlign:'center', cursor:'pointer', border:`1px solid ${P.border}`}}>看獎勵</div>
          <div onClick={()=>{ onSeeResult('celebrate'); }} style={{flex:1.4, padding:'13px', borderRadius:9999, background:P.primary, color:P.bg, fontFamily:'var(--font-display)', fontWeight:800, fontSize:14, textAlign:'center', cursor:'pointer', boxShadow:'0 8px 24px rgba(255,217,102,0.28)', display:'flex', alignItems:'center', justifyContent:'center', gap:8}}>
            <PRoughStar size={16} color={P.bg}/>慶祝一下
          </div>
        </>)}
        {t.state === 'rejected' && (<>
          <div onClick={onClose} style={{flex:1, padding:'13px', borderRadius:9999, border:`1px solid ${P.border}`, color:P.muted, fontSize:13, fontWeight:800, textAlign:'center', cursor:'pointer'}}>先不做</div>
          <div onClick={()=>{ MFKStore.actions.retryTask(taskId); onClose(); }} style={{flex:1.4, padding:'13px', borderRadius:9999, background:P.primary, color:P.bg, fontFamily:'var(--font-display)', fontWeight:800, fontSize:14, textAlign:'center', cursor:'pointer'}}>再試一次</div>
        </>)}
      </div>
    </div>
  );
}

// ============ CHILD · Celebration ============
function ChildCelebrate({ kidId, taskId, onClose }){
  MFKStore.useWorld();
  const t = MFKStore.select.task(taskId);
  const kid = MFKStore.select.kid(kidId);
  if (!t) return null;
  return (
    <div style={{position:'absolute', inset:0, background:`radial-gradient(circle at 50% 38%, ${P.primary}26 0%, ${P.bg} 60%)`, zIndex:10, display:'flex', flexDirection:'column', overflow:'hidden'}}>
      <PStarfield count={70}/>
      {/* Confetti rays */}
      <div style={{position:'absolute', inset:0, pointerEvents:'none'}}>
        {Array.from({length:14}).map((_,i)=>{
          const a = (i/14)*Math.PI*2;
          return <div key={i} style={{position:'absolute', left:'50%', top:'30%', width:2, height:120, background:`linear-gradient(to top, transparent, ${P.primary})`, transformOrigin:'center bottom', transform:`translate(-50%,0) rotate(${a*180/Math.PI}deg)`, opacity:0.5}}/>;
        })}
      </div>
      <div style={{flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', position:'relative', zIndex:2, padding:'0 22px', textAlign:'center'}}>
        <div style={{fontSize:88, filter:`drop-shadow(0 8px 32px ${P.primaryGlow})`}}>🎉</div>
        <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:32, marginTop:16, lineHeight:1.15}}>做得好！</div>
        <div style={{fontSize:15, color:P.muted, marginTop:8}}>{t.zh}</div>
        <div style={{display:'flex', alignItems:'center', gap:8, marginTop:20, padding:'10px 18px', borderRadius:9999, background:`${P.primary}22`, border:`1px solid ${P.border}`}}>
          <PRoughStar size={22}/>
          <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:22, color:P.primary}}>+{t.points}</div>
        </div>
        <div style={{marginTop:28, fontSize:12, color:P.muted, letterSpacing:1, fontWeight:700}}>目前總星光</div>
        <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:30, color:P.text, marginTop:4}}>★ {kid.stars}</div>
      </div>
      <div style={{padding:'12px 22px 22px', flexShrink:0, position:'relative', zIndex:2, display:'flex', gap:10}}>
        <div onClick={onClose} style={{flex:1, padding:'14px', borderRadius:9999, background:'rgba(247,242,234,0.08)', color:P.text, fontSize:13, fontWeight:800, textAlign:'center', cursor:'pointer', border:`1px solid ${P.border}`}}>看獎勵</div>
        <div onClick={onClose} style={{flex:1.4, padding:'14px', borderRadius:9999, background:P.primary, color:P.bg, fontFamily:'var(--font-display)', fontWeight:800, fontSize:14, textAlign:'center', cursor:'pointer', boxShadow:'0 8px 24px rgba(255,217,102,0.28)', display:'flex', alignItems:'center', justifyContent:'center', gap:8}}>
          <PRoughStar size={16} color={P.bg}/>下一個任務
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ChildTasksHome, ChildTaskDetail, ChildWait, ChildCelebrate });
