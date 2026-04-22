/* eslint-disable */
// Parent-side continued: redeem confirm, rewards tab, notifs, settings, reward edit.

function ParentRedeemConfirm({ orderId, onClose, onConfirm, onDecline }){
  MFKStore.useWorld();
  const [note, setNote] = React.useState('');
  const o = MFKStore.select.order(orderId);
  if (!o) return null;
  const r = MFKStore.select.reward(o.rewardId);
  const k = MFKStore.select.kid(o.kidId);
  return (
    <div style={{position:'absolute', inset:0, background:`radial-gradient(circle at 50% 30%, ${P.surfaceHi} 0%, ${P.bg} 70%)`, zIndex:12, display:'flex', flexDirection:'column'}}>
      <PStarfield count={24}/>
      <div style={{padding:'10px 0 6px', display:'flex', justifyContent:'center', alignItems:'center', position:'relative', zIndex:2}}>
        <div style={{width:44, height:5, borderRadius:9999, background:'rgba(247,242,234,0.25)'}}/>
        <div onClick={onClose} style={{position:'absolute', right:18, top:8, width:32, height:32, borderRadius:9999, background:'rgba(247,242,234,0.08)', border:`1px solid ${P.border}`, display:'flex', alignItems:'center', justifyContent:'center', color:P.muted, fontSize:14, cursor:'pointer'}}>✕</div>
      </div>
      <div style={{flex:1, overflow:'auto', padding:'8px 22px', position:'relative', zIndex:1, textAlign:'center'}}>
        <div style={{fontSize:11, fontWeight:800, letterSpacing:1.5, color:P.accent}}>⏳ 兌換要求</div>
        <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:26, marginTop:8}}>{k.zh} 想要換…</div>
        <div style={{margin:'16px 0 0', padding:22, background:P.surfaceCream, color:'#1C1A14', borderRadius:22}}>
          <div style={{width:96, height:96, borderRadius:22, background:`linear-gradient(135deg,${r.color},${r.color}aa)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:52, margin:'0 auto'}}>{r.emoji}</div>
          <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:24, marginTop:14}}>{r.zh}</div>
          <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:28, marginTop:6}}>− ★ {o.cost}</div>
          <div style={{marginTop:14, padding:'12px 14px', background:'rgba(28,26,20,0.06)', borderRadius:14, display:'flex', justifyContent:'space-between', fontSize:13}}>
            <div><div style={{fontSize:10, fontWeight:800, color:'#8A8275'}}>現有</div><div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:18, marginTop:2}}>★ {k.stars}</div></div>
            <div style={{alignSelf:'center', fontSize:22, color:'#8A8275'}}>→</div>
            <div><div style={{fontSize:10, fontWeight:800, color:'#8A8275'}}>之後</div><div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:18, marginTop:2}}>★ {k.stars - o.cost}</div></div>
          </div>
        </div>
        <div style={{margin:'16px 0 0', padding:14, background:P.surface, borderRadius:14, border:`1px solid ${P.border}`, textAlign:'left'}}>
          <div style={{display:'flex', justifyContent:'space-between'}}>
            <div style={{fontSize:10, fontWeight:800, letterSpacing:1, color:P.muted}}>跟孩子說一聲</div>
            <div style={{fontSize:10, fontWeight:800, color:P.accent}}>晚點再說 · 必填</div>
          </div>
          <input value={note} onChange={e=>setNote(e.target.value)} placeholder="週末再說 / 好，答應你" style={{marginTop:8, width:'100%', padding:'10px 12px', background:P.bg, borderRadius:10, border:`1px dashed ${P.border}`, fontSize:13, color:P.text, outline:'none'}}/>
          <div style={{display:'flex', gap:6, flexWrap:'wrap', marginTop:10}}>
            {['週末再說','今天太晚了','先做完功課','下次再答應'].map((c,i)=>(
              <div key={i} onClick={()=>setNote(c)} style={{padding:'6px 10px', borderRadius:9999, background:`${P.accent}18`, color:P.accent, fontSize:11, fontWeight:700, border:`1px solid ${P.border}`, cursor:'pointer'}}>{c}</div>
            ))}
          </div>
        </div>
      </div>
      <div style={{padding:'12px 22px 22px', flexShrink:0, display:'flex', gap:10, background:P.bg, borderTop:`1px solid ${P.border}`}}>
        <div onClick={()=>onDecline(orderId, note || '晚點再說')} style={{flex:1, padding:'14px', borderRadius:14, border:`1px solid ${P.border}`, color:P.text, fontFamily:'var(--font-display)', fontWeight:800, fontSize:14, textAlign:'center', cursor:'pointer'}}>晚點再說</div>
        <div onClick={()=>onConfirm(orderId, note)} style={{flex:2, padding:'14px', borderRadius:14, background:P.primary, color:P.bg, fontFamily:'var(--font-display)', fontWeight:800, fontSize:14, textAlign:'center', cursor:'pointer'}}>✓ 好，答應她</div>
      </div>
    </div>
  );
}

function ParentRewardsTab({ onEdit }){
  MFKStore.useWorld();
  const rewards = MFKStore.world.rewards;
  const orders = MFKStore.world.orders;
  return (
    <div style={{flex:1, overflow:'auto', position:'relative', paddingBottom:100}}>
      <PStarfield count={12}/>
      <div style={{padding:'18px 22px 0', position:'relative', zIndex:1}}>
        <div style={{fontSize:11, fontWeight:800, letterSpacing:1.5, color:P.muted}}>禮物</div>
        <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:26, marginTop:2}}>{rewards.length} 個可以換</div>
      </div>
      <div style={{padding:'14px 22px 0', position:'relative', zIndex:1, display:'grid', gridTemplateColumns:'1fr 1fr', gap:10}}>
        {rewards.map(r => (
          <div key={r.id} onClick={onEdit} style={{padding:14, background:P.surface, borderRadius:14, border:`1px solid ${P.border}`, cursor:'pointer'}}>
            <div style={{width:48, height:48, borderRadius:12, background:`linear-gradient(135deg,${r.color},${r.color}aa)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:26}}>{r.emoji}</div>
            <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:14, marginTop:10}}>{r.zh}</div>
            <div style={{display:'flex', alignItems:'center', gap:4, marginTop:6}}>
              <PRoughStar size={12}/>
              <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:13, color:P.primary}}>{r.cost}</div>
            </div>
          </div>
        ))}
      </div>
      {orders.length > 0 && (
        <div style={{padding:'16px 22px 0', position:'relative', zIndex:1}}>
          <div style={{fontSize:11, fontWeight:800, letterSpacing:1.5, color:P.muted, marginBottom:10}}>兌換紀錄</div>
          {orders.map(o => {
            const r = MFKStore.select.reward(o.rewardId);
            const k = MFKStore.select.kid(o.kidId);
            const stateLabel = { requested:'⏳ 等你確認', confirmed:'✓ 已確認', delivered:'🎊 已交付', declined:'💬 晚點再說' }[o.state];
            return (
              <div key={o.id} style={{padding:12, background:P.surface, borderRadius:12, border:`1px solid ${P.border}`, marginBottom:6, display:'flex', alignItems:'center', gap:12}}>
                <div style={{fontSize:22}}>{r.emoji}</div>
                <div style={{flex:1}}>
                  <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:14}}>{r.zh}</div>
                  <div style={{fontSize:11, color:P.muted, marginTop:2}}>{k.zh} · {stateLabel}</div>
                </div>
                <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:13, color:P.muted}}>−★ {o.cost}</div>
              </div>
            );
          })}
        </div>
      )}
      <div onClick={onEdit} style={{position:'absolute', right:18, bottom:92, width:56, height:56, borderRadius:9999, background:P.primary, color:P.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, fontWeight:800, boxShadow:'0 12px 24px rgba(0,0,0,0.35)', zIndex:4, cursor:'pointer'}}>+</div>
    </div>
  );
}

function ParentNotifs(){
  MFKStore.useWorld();
  const notifs = MFKStore.select.notifsForRole('parent');
  const unread = notifs.filter(n => !n.read).length;
  return (
    <div style={{flex:1, overflow:'auto', position:'relative', paddingBottom:100}}>
      <PStarfield count={14}/>
      <div style={{padding:'18px 22px 0', position:'relative', zIndex:1}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
          <div>
            <div style={{fontSize:11, fontWeight:800, letterSpacing:1.5, color:P.muted}}>通知</div>
            <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:26, marginTop:2}}>{unread>0 ? `${unread} 個新的`:'都看過了'}</div>
          </div>
          {unread > 0 && <div onClick={()=>MFKStore.actions.markAllRead('parent')} style={{padding:'6px 12px', borderRadius:9999, border:`1px solid ${P.border}`, color:P.muted, fontSize:11, fontWeight:700, cursor:'pointer'}}>全部標已讀</div>}
        </div>
      </div>
      <div style={{padding:'18px 22px 0', position:'relative', zIndex:1}}>
        {notifs.length === 0 ? <PEmpty emoji="✉️" title="沒有通知" body="小孩做完任務或申請兌換會在這裡。"/> :
          notifs.map(n => (
            <div key={n.id} onClick={()=>MFKStore.actions.markNotifRead(n.id)} style={{padding:14, background:P.surface, borderRadius:14, border:`1px solid ${n.read?P.border:P.primary+'44'}`, marginBottom:8, display:'flex', gap:12, cursor:'pointer', position:'relative'}}>
              {!n.read && <div style={{position:'absolute', right:14, top:14, width:8, height:8, borderRadius:9999, background:P.primary}}/>}
              <div style={{width:36, height:36, borderRadius:10, background: n.kind==='submission'?`${P.accent}22`:`${P.primary}22`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0}}>{n.kind==='submission'?'📸':'🎁'}</div>
              <div style={{flex:1}}>
                <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:14}}>{n.title}</div>
                <div style={{fontSize:12, color:P.muted, marginTop:2}}>{n.body}</div>
                <div style={{fontSize:10, color:P.muted, marginTop:4}}>{MFKStore.fmtWhen(n.when)}</div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function ParentSettings(){
  MFKStore.useWorld();
  const kids = Object.values(MFKStore.world.kids);
  return (
    <div style={{flex:1, overflow:'auto', position:'relative', paddingBottom:100}}>
      <PStarfield count={10}/>
      <div style={{padding:'18px 22px 0', position:'relative', zIndex:1}}>
        <div style={{fontSize:11, fontWeight:800, letterSpacing:1.5, color:P.muted}}>設定</div>
        <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:26, marginTop:2}}>家庭與權限</div>
      </div>
      <div style={{padding:'14px 22px 0', position:'relative', zIndex:1}}>
        <div style={{fontSize:11, fontWeight:800, letterSpacing:1.5, color:P.muted, marginBottom:10}}>小孩</div>
        {kids.map(k => (
          <div key={k.id} style={{padding:14, background:P.surface, borderRadius:14, border:`1px solid ${P.border}`, marginBottom:8, display:'flex', alignItems:'center', gap:12}}>
            <div style={{width:44, height:44, borderRadius:9999, background:k.color, color:P.bg, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontWeight:800, fontSize:18}}>{k.zh[0]}</div>
            <div style={{flex:1}}>
              <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:15}}>{k.zh}</div>
              <div style={{fontSize:11, color:P.muted, marginTop:2}}>{k.age} 歲 · ★ {k.stars}</div>
            </div>
            <div style={{fontSize:18, color:P.muted}}>›</div>
          </div>
        ))}
        <div style={{fontSize:11, fontWeight:800, letterSpacing:1.5, color:P.muted, marginTop:20, marginBottom:10}}>一般</div>
        {['語言','通知','審核方式','螢幕時間','登出'].map(label => (
          <div key={label} style={{padding:'14px 16px', background:P.surface, borderRadius:14, border:`1px solid ${P.border}`, marginBottom:6, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <div style={{fontSize:14, fontWeight:700}}>{label}</div>
            <div style={{fontSize:13, color:P.muted}}>{label==='語言'?'中文':label==='通知'?'開啟':label==='審核方式'?'手動':label==='螢幕時間'?'未設定':'›'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ParentRewardEdit({ onClose }){
  return (
    <div style={{position:'absolute', inset:0, background:P.bg, zIndex:12, display:'flex', flexDirection:'column'}}>
      <PStarfield count={14}/>
      <div style={{padding:'10px 0 6px', display:'flex', justifyContent:'center', alignItems:'center', position:'relative', zIndex:2}}>
        <div style={{width:44, height:5, borderRadius:9999, background:'rgba(247,242,234,0.25)'}}/>
      </div>
      <div style={{padding:'4px 22px 10px', display:'flex', justifyContent:'space-between', alignItems:'center', position:'relative', zIndex:2}}>
        <div onClick={onClose} style={{fontSize:14, color:P.muted, cursor:'pointer'}}>取消</div>
        <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:15}}>新增禮物</div>
        <div onClick={onClose} style={{padding:'6px 12px', borderRadius:9999, background:P.primary, color:P.bg, fontSize:12, fontWeight:800, cursor:'pointer'}}>儲存</div>
      </div>
      <div style={{flex:1, overflow:'auto', padding:'4px 22px 24px', position:'relative', zIndex:1}}>
        <div style={{padding:18, background:P.surface, borderRadius:20, border:`1px solid ${P.border}`, display:'flex', gap:14, alignItems:'center'}}>
          <div style={{width:72, height:72, borderRadius:18, background:'linear-gradient(135deg,#FFCFA3,#F5A623)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:36}}>🍦</div>
          <div style={{flex:1}}>
            <div style={{fontSize:10, fontWeight:800, color:P.muted, letterSpacing:1}}>名字</div>
            <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:20, marginTop:4, borderBottom:`2px solid ${P.primary}`, paddingBottom:4}}>吃冰淇淋</div>
          </div>
        </div>
        <div style={{marginTop:14, padding:14, background:P.surface, borderRadius:16, border:`1px solid ${P.border}`}}>
          <div style={{fontSize:10, fontWeight:800, color:P.muted, letterSpacing:1, marginBottom:10}}>選個圖案</div>
          <div style={{display:'flex', gap:8, flexWrap:'wrap'}}>
            {['🍦','🎮','🎬','📚','🍕','🧸','🌙','🎨','⚽','🎧'].map((e,i)=>(
              <div key={i} style={{width:40, height:40, borderRadius:10, background: i===0?`${P.primary}33`:P.bg, border: i===0?`2px solid ${P.primary}`:`1px solid ${P.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20}}>{e}</div>
            ))}
          </div>
        </div>
        <div style={{marginTop:14, padding:'14px 16px', background:P.surface, borderRadius:16, border:`1px solid ${P.border}`, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div style={{fontSize:10, fontWeight:800, color:P.muted, letterSpacing:1}}>★ 星光價格</div>
          <div style={{display:'flex', alignItems:'center', gap:10}}>
            <div style={{width:32, height:32, borderRadius:9999, background:P.bg, color:P.muted, border:`1px solid ${P.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18}}>−</div>
            <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:22, color:P.primary, minWidth:44, textAlign:'center'}}>★ 50</div>
            <div style={{width:32, height:32, borderRadius:9999, background:P.primary, color:P.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:800}}>+</div>
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ParentRedeemConfirm, ParentRewardsTab, ParentNotifs, ParentSettings, ParentRewardEdit });
