/* eslint-disable */
// Child-side screens continued: rewards tab, redeem flow, order progress, notifs, me.

// ============ CHILD · Rewards Tab ============
function ChildRewards({ kidId, onRequestRedeem, onSeeOrder }){
  MFKStore.useWorld();
  const kid = MFKStore.select.kid(kidId);
  const rewards = MFKStore.world.rewards;
  const active = MFKStore.select.activeOrderForKid(kidId);
  const history = MFKStore.select.ordersForKid(kidId).filter(o => o.state === 'delivered' || o.state === 'declined');
  return (
    <div style={{flex:1, overflow:'auto', position:'relative', paddingBottom:100}}>
      <PStarfield count={18}/>
      <div style={{padding:'18px 22px 0', position:'relative', zIndex:1}}>
        <div style={{fontSize:11, fontWeight:800, letterSpacing:1.5, color:P.muted}}>獎勵</div>
        <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:26, marginTop:2}}>用星光換禮物</div>
        <div style={{marginTop:12, padding:14, borderRadius:14, background:P.surface, border:`1px solid ${P.border}`, display:'flex', alignItems:'center', gap:12}}>
          <PRoughStar size={28}/>
          <div style={{flex:1}}>
            <div style={{fontSize:11, fontWeight:800, color:P.muted, letterSpacing:1}}>你有</div>
            <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:22, color:P.primary}}>{kid.stars} 顆星光</div>
          </div>
        </div>
      </div>

      {/* Active order banner */}
      {active && (
        <div onClick={()=>onSeeOrder(active.id)} style={{margin:'14px 22px 0', padding:14, borderRadius:14, background:active.state==='confirmed'?`${P.green}22`:`${P.accent}22`, border:`1px solid ${active.state==='confirmed'?P.green:P.accent}33`, display:'flex', alignItems:'center', gap:12, cursor:'pointer', position:'relative', zIndex:1}}>
          <div style={{fontSize:28}}>{MFKStore.select.reward(active.rewardId).emoji}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:11, fontWeight:800, letterSpacing:1, color:active.state==='confirmed'?P.green:P.accent}}>
              {active.state==='requested' && '⏳ 等爸媽確認'}
              {active.state==='confirmed' && '✓ 準備好了！'}
            </div>
            <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:15, marginTop:2}}>{MFKStore.select.reward(active.rewardId).zh}</div>
          </div>
          <div style={{fontSize:18, color:P.muted}}>›</div>
        </div>
      )}

      <div style={{padding:'16px 22px 0', position:'relative', zIndex:1}}>
        <div style={{fontSize:11, fontWeight:800, letterSpacing:1.5, color:P.muted, marginBottom:10}}>可以換</div>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
          {rewards.map(r => {
            const can = kid.stars >= r.cost && !active;
            const short = Math.max(0, r.cost - kid.stars);
            return (
              <div key={r.id} onClick={()=>can && onRequestRedeem(r.id)} style={{padding:14, borderRadius:14, background:P.surface, border:`1px solid ${P.border}`, cursor:can?'pointer':'default', opacity:can?1:0.5, position:'relative'}}>
                <div style={{width:48, height:48, borderRadius:12, background:`linear-gradient(135deg, ${r.color}, ${r.color}aa)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:26}}>{r.emoji}</div>
                <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:14, marginTop:10, lineHeight:1.3}}>{r.zh}</div>
                <div style={{display:'flex', alignItems:'center', gap:4, marginTop:6}}>
                  <PRoughStar size={12}/>
                  <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:13, color:can?P.primary:P.muted}}>{r.cost}</div>
                  {!can && short>0 && <div style={{fontSize:10, color:P.muted, marginLeft:4}}>· 還差 {short}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {history.length > 0 && (
        <div style={{padding:'16px 22px 0', position:'relative', zIndex:1}}>
          <div style={{fontSize:11, fontWeight:800, letterSpacing:1.5, color:P.muted, marginBottom:10}}>換過的</div>
          {history.map(o => {
            const r = MFKStore.select.reward(o.rewardId);
            return (
              <div key={o.id} style={{padding:'10px 12px', background:P.surface, border:`1px solid ${P.border}`, borderRadius:12, marginBottom:6, display:'flex', alignItems:'center', gap:10, opacity: o.state==='declined'?0.7:1}}>
                <div style={{fontSize:20}}>{r.emoji}</div>
                <div style={{flex:1}}>
                  <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:13}}>{r.zh}</div>
                  <div style={{fontSize:10, color:P.muted, marginTop:1}}>{o.state==='delivered'?'已拿到':'爸媽說：'+ (o.parentNote||'晚點再說')}</div>
                </div>
                <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:12, color:P.muted}}>−★ {o.cost}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============ CHILD · Redeem confirm sheet ============
function ChildRedeemConfirm({ kidId, rewardId, onClose, onConfirm }){
  MFKStore.useWorld();
  const kid = MFKStore.select.kid(kidId);
  const r = MFKStore.select.reward(rewardId);
  if (!r) return null;
  return (
    <div style={{position:'absolute', inset:0, background:P.bg, zIndex:12, display:'flex', flexDirection:'column'}}>
      <PStarfield count={24}/>
      <div style={{padding:'10px 0 6px', display:'flex', justifyContent:'center', alignItems:'center', position:'relative', zIndex:2}}>
        <div style={{width:44, height:5, borderRadius:9999, background:'rgba(247,242,234,0.25)'}}/>
        <div onClick={onClose} style={{position:'absolute', right:18, top:8, width:32, height:32, borderRadius:9999, background:'rgba(247,242,234,0.08)', border:`1px solid ${P.border}`, display:'flex', alignItems:'center', justifyContent:'center', color:P.muted, fontSize:14, cursor:'pointer'}}>✕</div>
      </div>
      <div style={{flex:1, overflow:'auto', padding:'16px 22px', position:'relative', zIndex:1, textAlign:'center'}}>
        <div style={{fontSize:11, fontWeight:800, letterSpacing:1.5, color:P.accent}}>要換這個嗎？</div>
        <div style={{width:100, height:100, borderRadius:22, background:`linear-gradient(135deg,${r.color},${r.color}aa)`, margin:'16px auto 0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:52, boxShadow:`0 16px 40px ${r.color}44`}}>{r.emoji}</div>
        <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:26, marginTop:16}}>{r.zh}</div>
        <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginTop:10}}>
          <PRoughStar size={22}/>
          <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:26, color:P.primary}}>−{r.cost}</div>
        </div>
        {/* Before / after */}
        <div style={{margin:'22px auto 0', maxWidth:280, padding:14, background:P.surface, borderRadius:14, border:`1px solid ${P.border}`, display:'flex', justifyContent:'space-between', textAlign:'left'}}>
          <div>
            <div style={{fontSize:10, fontWeight:800, letterSpacing:1, color:P.muted}}>現在</div>
            <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:20, marginTop:2}}>★ {kid.stars}</div>
          </div>
          <div style={{alignSelf:'center', fontSize:20, color:P.muted}}>→</div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:10, fontWeight:800, letterSpacing:1, color:P.muted}}>之後</div>
            <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:20, marginTop:2}}>★ {kid.stars - r.cost}</div>
          </div>
        </div>
        <div style={{marginTop:18, fontSize:12, color:P.muted}}>爸媽要先說好才算完成</div>
      </div>
      <div style={{padding:'12px 22px 22px', flexShrink:0, display:'flex', gap:10, borderTop:`1px solid ${P.border}`, background:P.bg, position:'relative', zIndex:2}}>
        <div onClick={onClose} style={{flex:1, padding:'14px', borderRadius:9999, border:`1px solid ${P.border}`, color:P.muted, fontSize:14, fontWeight:800, textAlign:'center', cursor:'pointer'}}>再想想</div>
        <div onClick={()=>onConfirm(rewardId)} style={{flex:1.5, padding:'14px', borderRadius:9999, background:P.primary, color:P.bg, fontFamily:'var(--font-display)', fontWeight:800, fontSize:14, textAlign:'center', cursor:'pointer', boxShadow:'0 8px 24px rgba(255,217,102,0.28)'}}>✓ 問爸媽</div>
      </div>
    </div>
  );
}

// ============ CHILD · Order progress ============
function ChildOrder({ kidId, orderId, onClose, onDelivered }){
  MFKStore.useWorld();
  const o = MFKStore.select.order(orderId);
  if (!o) return null;
  const r = MFKStore.select.reward(o.rewardId);
  const steps = [
    { k:'requested', zh:'你提出', ts:o.requestedAt },
    { k:'confirmed', zh:'爸媽答應', ts:o.confirmedAt },
    { k:'delivered', zh:'你拿到了', ts:o.deliveredAt },
  ];
  const order = ['requested','confirmed','delivered'];
  const cur = order.indexOf(o.state);
  return (
    <div style={{position:'absolute', inset:0, background:P.bg, zIndex:12, display:'flex', flexDirection:'column'}}>
      <PStarfield count={26}/>
      <div style={{padding:'10px 0 6px', display:'flex', justifyContent:'center', alignItems:'center', position:'relative', zIndex:2}}>
        <div style={{width:44, height:5, borderRadius:9999, background:'rgba(247,242,234,0.25)'}}/>
        <div onClick={onClose} style={{position:'absolute', right:18, top:8, width:32, height:32, borderRadius:9999, background:'rgba(247,242,234,0.08)', border:`1px solid ${P.border}`, display:'flex', alignItems:'center', justifyContent:'center', color:P.muted, fontSize:14, cursor:'pointer'}}>✕</div>
      </div>
      <div style={{padding:'0 22px 4px', fontSize:10, color:P.muted, textAlign:'center', letterSpacing:1.5, fontWeight:700, position:'relative', zIndex:2}}>下滑關閉 · 或點 ✕</div>
      <div style={{flex:1, overflow:'auto', padding:'8px 22px 24px', position:'relative', zIndex:1, textAlign:'center'}}>
        <div style={{fontSize:11, fontWeight:800, letterSpacing:1.5, color:P.muted}}>獎勵路程</div>
        <div style={{width:92, height:92, borderRadius:22, background:`linear-gradient(135deg,${r.color},${r.color}aa)`, margin:'16px auto 0', display:'flex', alignItems:'center', justifyContent:'center', fontSize:48}}>{r.emoji}</div>
        <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:22, marginTop:14}}>{r.zh}</div>
        <div style={{fontSize:13, color:P.muted, marginTop:6}}>
          {o.state==='requested' && '⏳ 等爸媽答應'}
          {o.state==='confirmed' && '✓ 馬上就到你手上'}
          {o.state==='delivered' && '🎊 拿到了！'}
          {o.state==='declined' && '💬 ' + (o.parentNote || '晚點再說')}
        </div>
        {o.state !== 'declined' && (
          <div style={{marginTop:28, textAlign:'left', padding:'0 12px'}}>
            {steps.map((s,i)=>{
              const done = i <= cur;
              const current = i === cur;
              return (
                <div key={s.k} style={{display:'flex', gap:14, alignItems:'flex-start', paddingBottom:i<steps.length-1?18:0, position:'relative'}}>
                  {i < steps.length-1 && <div style={{position:'absolute', left:13, top:28, bottom:-4, width:2, background: done?P.primary:P.border}}/>}
                  <div style={{width:28, height:28, borderRadius:9999, background: done?P.primary:P.surface, border:`2px solid ${done?P.primary:P.border}`, display:'flex', alignItems:'center', justifyContent:'center', color:done?P.bg:P.muted, fontSize:13, fontWeight:800, flexShrink:0, zIndex:1, boxShadow: current?`0 0 0 6px ${P.primaryGlow}`:'none'}}>
                    {done ? '✓' : i+1}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:14, color: done?P.text:P.muted}}>{s.zh}</div>
                    <div style={{fontSize:11, color:P.muted, marginTop:2}}>{s.ts ? MFKStore.fmtWhen(s.ts) : '—'}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {o.state==='declined' && (
          <div style={{marginTop:24, padding:14, borderRadius:14, background:`${P.accent}18`, border:`1px solid ${P.accent}33`, textAlign:'left'}}>
            <div style={{fontSize:11, fontWeight:800, color:P.accent, letterSpacing:1}}>爸媽說</div>
            <div style={{fontSize:14, marginTop:6, lineHeight:1.5}}>{o.parentNote}</div>
          </div>
        )}
      </div>
      <div style={{padding:'12px 22px 22px', flexShrink:0, display:'flex', gap:10, borderTop:`1px solid ${P.border}`, background:P.bg, position:'relative', zIndex:2}}>
        {o.state === 'confirmed' && (
          <div onClick={()=>{onDelivered(orderId);}} style={{flex:1, padding:'14px', borderRadius:9999, background:P.primary, color:P.bg, fontFamily:'var(--font-display)', fontWeight:800, fontSize:14, textAlign:'center', cursor:'pointer', boxShadow:'0 8px 24px rgba(255,217,102,0.28)'}}>✓ 我拿到了！</div>
        )}
        {(o.state === 'requested' || o.state === 'delivered' || o.state === 'declined') && (
          <div onClick={onClose} style={{flex:1, padding:'14px', borderRadius:9999, background:P.primary, color:P.bg, fontFamily:'var(--font-display)', fontWeight:800, fontSize:14, textAlign:'center', cursor:'pointer'}}>好</div>
        )}
      </div>
    </div>
  );
}

// ============ CHILD · Notifications ============
function ChildNotifs({ kidId, onOpen }){
  MFKStore.useWorld();
  const kid = MFKStore.select.kid(kidId);
  const notifs = MFKStore.select.notifsForRole('child', kidId);
  const unread = notifs.filter(n => !n.read);
  return (
    <div style={{flex:1, overflow:'auto', position:'relative', paddingBottom:100}}>
      <PStarfield count={16}/>
      <div style={{padding:'18px 22px 0', position:'relative', zIndex:1}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
          <div>
            <div style={{fontSize:11, fontWeight:800, letterSpacing:1.5, color:P.muted}}>通知</div>
            <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:26, marginTop:2}}>{unread.length > 0 ? `${unread.length} 個新的` : '都看過了'}</div>
          </div>
          {unread.length > 0 && (
            <div onClick={()=>MFKStore.actions.markAllRead('child', kidId)} style={{padding:'6px 12px', borderRadius:9999, border:`1px solid ${P.border}`, color:P.muted, fontSize:11, fontWeight:700, cursor:'pointer'}}>全部標已讀</div>
          )}
        </div>
      </div>
      <div style={{padding:'18px 22px 0', position:'relative', zIndex:1}}>
        {notifs.length === 0 ? (
          <PEmpty emoji="✉️" title="沒有通知" body="爸媽看過你的任務後，這裡會出現訊息。"/>
        ) : notifs.map(n => (
          <div key={n.id} onClick={()=>{ MFKStore.actions.markNotifRead(n.id); onOpen && onOpen(n); }} style={{padding:14, background:P.surface, border:`1px solid ${n.read?P.border:P.primary+'44'}`, borderRadius:14, marginBottom:8, display:'flex', alignItems:'flex-start', gap:12, cursor:'pointer', position:'relative'}}>
            {!n.read && <div style={{position:'absolute', right:14, top:14, width:8, height:8, borderRadius:9999, background:P.primary}}/>}
            <div style={{width:36, height:36, borderRadius:10, background: n.kind==='approved'?`${P.green}22`:n.kind==='rejected'?`${P.accentHot}22`:n.kind==='redeem-confirmed'?`${P.primary}22`:`${P.accent}22`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:18}}>
              {n.kind==='approved' && '✓'}
              {n.kind==='rejected' && '↺'}
              {n.kind==='redeem-confirmed' && '🎁'}
              {n.kind==='redeem-declined' && '💬'}
            </div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:14}}>{n.title}</div>
              <div style={{fontSize:12, color:P.muted, marginTop:2}}>{n.body}</div>
              <div style={{fontSize:10, color:P.muted, marginTop:4, letterSpacing:0.5}}>{MFKStore.fmtWhen(n.when)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ CHILD · Me ============
function ChildMe({ kidId }){
  MFKStore.useWorld();
  const kid = MFKStore.select.kid(kidId);
  const tasks = MFKStore.select.tasksForKid(kidId);
  const done = tasks.filter(t => t.state==='approved').length;
  const total = tasks.length;
  const pct = total ? Math.round((done/total)*100) : 0;
  const badges = [
    { id:'b1', emoji:'🔥', zh:'連續 7 天', got: kid.streak >= 7 },
    { id:'b2', emoji:'📚', zh:'讀書家', got:true },
    { id:'b3', emoji:'🎨', zh:'創作家', got:false },
    { id:'b4', emoji:'⭐', zh:'100 顆星', got: kid.stars >= 100 },
    { id:'b5', emoji:'🌙', zh:'夜貓子', got:false },
    { id:'b6', emoji:'🏆', zh:'月冠軍', got:true },
  ];
  return (
    <div style={{flex:1, overflow:'auto', position:'relative', paddingBottom:100}}>
      <PStarfield count={30}/>
      <div style={{padding:'18px 22px 0', position:'relative', zIndex:1}}>
        <div style={{fontSize:11, fontWeight:800, letterSpacing:1.5, color:P.muted}}>我的</div>
      </div>
      <div style={{padding:'12px 22px 0', position:'relative', zIndex:1, textAlign:'center'}}>
        <div style={{width:80, height:80, borderRadius:9999, background:`linear-gradient(135deg,${kid.color},${kid.color}aa)`, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'center', fontSize:36, color:P.bg, fontFamily:'var(--font-display)', fontWeight:800, boxShadow:`0 8px 32px ${kid.color}44`}}>{kid.zh[0]}</div>
        <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:22, marginTop:12}}>{kid.zh}</div>
        <div style={{fontSize:12, color:P.muted, marginTop:2}}>{kid.age} 歲</div>
      </div>
      <div style={{padding:'20px 22px 0', position:'relative', zIndex:1, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8}}>
        <div style={{padding:12, background:P.surface, borderRadius:12, border:`1px solid ${P.border}`, textAlign:'center'}}>
          <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:22, color:P.primary}}>{kid.stars}</div>
          <div style={{fontSize:10, color:P.muted, fontWeight:700, letterSpacing:1, marginTop:2}}>星光</div>
        </div>
        <div style={{padding:12, background:P.surface, borderRadius:12, border:`1px solid ${P.border}`, textAlign:'center'}}>
          <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:22, color:P.accentHot}}>🔥 {kid.streak}</div>
          <div style={{fontSize:10, color:P.muted, fontWeight:700, letterSpacing:1, marginTop:2}}>連續天</div>
        </div>
        <div style={{padding:12, background:P.surface, borderRadius:12, border:`1px solid ${P.border}`, textAlign:'center'}}>
          <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:22, color:P.green}}>{pct}%</div>
          <div style={{fontSize:10, color:P.muted, fontWeight:700, letterSpacing:1, marginTop:2}}>完成率</div>
        </div>
      </div>
      <div style={{padding:'20px 22px 0', position:'relative', zIndex:1}}>
        <div style={{fontSize:11, fontWeight:800, letterSpacing:1.5, color:P.muted, marginBottom:10}}>徽章</div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8}}>
          {badges.map(b => (
            <div key={b.id} style={{padding:14, borderRadius:14, background:P.surface, border:`1px solid ${b.got?P.primary+'44':P.border}`, textAlign:'center', opacity:b.got?1:0.4}}>
              <div style={{fontSize:28, filter: b.got?'none':'grayscale(1)'}}>{b.emoji}</div>
              <div style={{fontSize:11, fontWeight:700, marginTop:6, color: b.got?P.text:P.muted}}>{b.zh}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ChildRewards, ChildRedeemConfirm, ChildOrder, ChildNotifs, ChildMe });
