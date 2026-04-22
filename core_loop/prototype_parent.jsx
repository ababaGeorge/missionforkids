/* eslint-disable */
// Parent-side screens, connected to MFKStore.

// ============ PARENT · Tasks Manage (with live Manage/History sub-tabs) ============
function ParentTasksManage({ onToggleTaskPaused, onNewTask, initialTab }){
  MFKStore.useWorld();
  const [tab, setTab] = React.useState(initialTab || 'manage');
  const kids = MFKStore.world.kids;
  const tasks = MFKStore.world.tasks;
  const approvedRecent = MFKStore.world.tasks.filter(t => t.state === 'approved' || t.state === 'rejected').sort((a,b)=> (b.reviewedAt||0) - (a.reviewedAt||0));

  return (
    <div style={{flex:1, overflow:'auto', position:'relative', paddingBottom:120}}>
      <PStarfield count={14}/>
      <div style={{padding:'20px 22px 4px', position:'relative', zIndex:1}}>
        <div style={{fontSize:11, fontWeight:800, letterSpacing:1.5, color:P.muted}}>任務</div>
        <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:26, marginTop:2}}>
          {tab==='manage' ? `${tasks.filter(t=>!t.paused).length} 個在跑` : '任務歷程'}
        </div>
        <div style={{display:'flex', gap:4, marginTop:14, background:P.surface, padding:4, borderRadius:12, border:`1px solid ${P.border}`}}>
          {[{k:'manage',zh:'管理'},{k:'history',zh:'歷程'}].map(s => {
            const on = tab===s.k;
            return <div key={s.k} onClick={()=>setTab(s.k)} style={{flex:1, padding:'9px 8px', textAlign:'center', borderRadius:9, background: on?P.primary:'transparent', color: on?P.bg:P.muted, fontSize:12, fontWeight:800, cursor:'pointer'}}>{s.zh}</div>;
          })}
        </div>
      </div>

      {tab==='manage' ? (
        <div style={{padding:'14px 22px 0', position:'relative', zIndex:1}}>
          {tasks.map(t => {
            const kid = kids[t.kidId];
            const label = t.state==='submitted' ? `⏳ 等你審核` : t.state==='approved' ? '✓ 今天做了' : t.state==='rejected' ? '↺ 要重做' : '今天';
            const tone = t.state==='submitted' ? P.accent : t.state==='approved' ? P.green : t.state==='rejected' ? P.accentHot : P.muted;
            return (
              <div key={t.id} style={{padding:14, background:P.surface, borderRadius:14, border:`1px solid ${P.border}`, marginBottom:8, opacity:t.paused?0.55:1}}>
                <div style={{display:'flex', alignItems:'flex-start', gap:12}}>
                  <div style={{width:40, height:40, borderRadius:10, background:`${P.primary}18`, border:`1px solid ${P.border}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:22}}>{t.emoji}</div>
                  <div style={{flex:1, minWidth:0}}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
                      <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:15}}>{t.zh}</div>
                      <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:13, color:P.primary}}>★ {t.points}</div>
                    </div>
                    <div style={{fontSize:11, color:P.muted, marginTop:2}}>
                      <span style={{display:'inline-block', width:8, height:8, borderRadius:9999, background:kid.color, marginRight:6, verticalAlign:'middle'}}/>
                      {kid.zh} · <span style={{color:tone, fontWeight:700}}>{t.paused?'已暫停':label}</span>
                    </div>
                  </div>
                </div>
                <div style={{display:'flex', gap:8, marginTop:10}}>
                  <div onClick={()=>onToggleTaskPaused(t.id)} style={{padding:'6px 12px', borderRadius:9999, border:`1px solid ${P.border}`, color:P.muted, fontSize:11, fontWeight:700, cursor:'pointer'}}>{t.paused?'繼續':'暫停'}</div>
                  <div style={{flex:1}}/>
                  <div style={{padding:'6px 12px', borderRadius:9999, border:`1px solid ${P.border}`, color:P.muted, fontSize:11, fontWeight:700, cursor:'pointer'}}>編輯</div>
                </div>
              </div>
            );
          })}
          {tasks.length === 0 && <PEmpty emoji="✦" title="還沒有任務" body="點右下角 + 新增一個"/>}
        </div>
      ) : (
        <div style={{padding:'14px 22px 0', position:'relative', zIndex:1}}>
          {approvedRecent.length === 0 ? (
            <PEmpty emoji="📜" title="還沒有紀錄" body="小孩做完任務、你審核之後會出現在這。"/>
          ) : approvedRecent.map(t => {
            const kid = kids[t.kidId];
            return (
              <div key={t.id} style={{padding:12, background:P.surface, borderRadius:12, border:`1px solid ${P.border}`, marginBottom:6, display:'flex', alignItems:'center', gap:12}}>
                <div style={{width:34, height:34, borderRadius:9999, background: t.state==='approved'?`${P.green}22`:`${P.accentHot}22`, color: t.state==='approved'?P.green:P.accentHot, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:800, flexShrink:0}}>
                  {t.state==='approved' ? '✓' : '✗'}
                </div>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:14}}>{t.zh}</div>
                  <div style={{fontSize:11, color:P.muted, marginTop:2}}>{kid.zh} · {MFKStore.fmtWhen(t.reviewedAt)}</div>
                </div>
                <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:14, color: t.state==='approved'?P.primary:P.muted}}>★ {t.points}</div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'manage' && (
        <div onClick={onNewTask} style={{position:'absolute', right:18, bottom:92, width:56, height:56, borderRadius:9999, background:P.primary, color:P.bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, fontWeight:800, boxShadow:'0 12px 24px rgba(0,0,0,0.35)', zIndex:4, cursor:'pointer'}}>+</div>
      )}
    </div>
  );
}

// ============ PARENT · Review queue ============
function ParentReviewList({ onOpenReview }){
  MFKStore.useWorld();
  const submitted = MFKStore.select.submittedTasks();
  const orders = MFKStore.select.pendingOrdersForParent();
  return (
    <div style={{flex:1, overflow:'auto', position:'relative', paddingBottom:100}}>
      <PStarfield count={12}/>
      <div style={{padding:'18px 22px 0', position:'relative', zIndex:1}}>
        <div style={{fontSize:11, fontWeight:800, letterSpacing:1.5, color:P.muted}}>審核</div>
        <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:26, marginTop:2}}>
          {submitted.length + orders.length === 0 ? '都審完了 🎉' : `${submitted.length + orders.length} 個等你看`}
        </div>
      </div>

      {orders.length > 0 && (
        <div style={{padding:'16px 22px 0', position:'relative', zIndex:1}}>
          <div style={{fontSize:11, fontWeight:800, letterSpacing:1.5, color:P.muted, marginBottom:10}}>禮物申請</div>
          {orders.map(o => {
            const r = MFKStore.select.reward(o.rewardId);
            const k = MFKStore.select.kid(o.kidId);
            return (
              <div key={o.id} onClick={()=>onOpenReview({ kind:'redeem', orderId:o.id })} style={{padding:14, background:P.surfaceCream, color:'#1C1A14', borderRadius:14, marginBottom:8, display:'flex', alignItems:'center', gap:12, cursor:'pointer'}}>
                <div style={{width:48, height:48, borderRadius:12, background:`linear-gradient(135deg,${r.color},${r.color}aa)`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, flexShrink:0}}>{r.emoji}</div>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:11, fontWeight:800, color:'#8A8275', letterSpacing:1}}>{k.zh} 想換</div>
                  <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:15, marginTop:2}}>{r.zh}</div>
                  <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:13, marginTop:4}}>−★ {o.cost}</div>
                </div>
                <div style={{fontSize:18, color:'#8A8275'}}>›</div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{padding:'16px 22px 0', position:'relative', zIndex:1}}>
        {submitted.length > 0 && <div style={{fontSize:11, fontWeight:800, letterSpacing:1.5, color:P.muted, marginBottom:10}}>任務</div>}
        {submitted.map(t => {
          const k = MFKStore.select.kid(t.kidId);
          return (
            <div key={t.id} onClick={()=>onOpenReview({ kind:'task', taskId:t.id })} style={{padding:14, background:P.surface, border:`1px solid ${P.border}`, borderRadius:14, marginBottom:8, display:'flex', gap:12, cursor:'pointer'}}>
              <div style={{width:64, height:64, borderRadius:12, background:'linear-gradient(135deg,#C0AC80,#8A7A54)', flexShrink:0, position:'relative'}}>
                <div style={{position:'absolute', right:6, bottom:6, fontSize:22}}>{t.emoji}</div>
              </div>
              <div style={{flex:1, minWidth:0}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline'}}>
                  <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:15}}>{t.zh}</div>
                  <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:13, color:P.primary}}>★ {t.points}</div>
                </div>
                <div style={{fontSize:11, color:P.muted, marginTop:2}}>
                  <span style={{display:'inline-block', width:8, height:8, borderRadius:9999, background:k.color, marginRight:6, verticalAlign:'middle'}}/>
                  {k.zh} · {MFKStore.fmtWhen(t.submittedAt)}
                </div>
                {t.photoNote && <div style={{fontSize:12, color:P.muted, marginTop:6, fontStyle:'italic'}}>「{t.photoNote}」</div>}
              </div>
            </div>
          );
        })}
        {submitted.length + orders.length === 0 && (
          <PEmpty emoji="🌙" title="休息一下" body="小孩做完任務之後，會跑到這裡等你看。"/>
        )}
      </div>
    </div>
  );
}

// ============ PARENT · Review sheet (single task) ============
function ParentReviewSheet({ taskId, onClose, onApprove, onReject }){
  MFKStore.useWorld();
  const [note, setNote] = React.useState('');
  const t = MFKStore.select.task(taskId);
  if (!t) return null;
  const kid = MFKStore.select.kid(t.kidId);
  return (
    <div style={{position:'absolute', inset:0, background:P.bg, zIndex:12, display:'flex', flexDirection:'column'}}>
      <PStarfield count={20}/>
      <div style={{padding:'10px 0 6px', display:'flex', justifyContent:'center', alignItems:'center', position:'relative', zIndex:2}}>
        <div style={{width:44, height:5, borderRadius:9999, background:'rgba(247,242,234,0.25)'}}/>
        <div onClick={onClose} style={{position:'absolute', right:18, top:8, width:32, height:32, borderRadius:9999, background:'rgba(247,242,234,0.08)', border:`1px solid ${P.border}`, display:'flex', alignItems:'center', justifyContent:'center', color:P.muted, fontSize:14, cursor:'pointer'}}>✕</div>
      </div>
      <div style={{flex:1, overflow:'auto', padding:'12px 22px', position:'relative', zIndex:1}}>
        <div style={{fontSize:11, fontWeight:800, letterSpacing:1.5, color:P.muted}}>審核</div>
        <div style={{display:'flex', alignItems:'center', gap:12, marginTop:6}}>
          <div style={{width:32, height:32, borderRadius:9999, background:kid.color, color:P.bg, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontWeight:800, fontSize:14}}>{kid.zh[0]}</div>
          <div>
            <div style={{fontSize:12, color:P.muted}}>{kid.zh} 提交</div>
            <div style={{fontFamily:'var(--font-display)', fontWeight:800, fontSize:22, marginTop:2}}>{t.zh}</div>
          </div>
          <div style={{flex:1}}/>
          <div style={{display:'flex', alignItems:'center', gap:4}}>
            <PRoughStar size={18}/>
            <div style={{fontFamily:'DM Sans,sans-serif', fontWeight:700, fontSize:18, color:P.primary}}>{t.points}</div>
          </div>
        </div>

        {/* Photo */}
        <div style={{marginTop:16, aspectRatio:'4/3', borderRadius:16, background:'linear-gradient(135deg,#C0AC80,#8A7A54)', display:'flex', alignItems:'flex-end', padding:14, position:'relative', overflow:'hidden'}}>
          <div style={{fontSize:46, position:'absolute', right:14, top:14, opacity:0.6}}>{t.emoji}</div>
          <div style={{padding:'6px 12px', borderRadius:9999, background:'rgba(11,14,26,0.6)', color:P.text, fontSize:11, fontWeight:700}}>{MFKStore.fmtWhen(t.submittedAt)}</div>
        </div>

        {t.photoNote && (
          <div style={{marginTop:12, padding:'10px 14px', background:P.surface, borderRadius:12, border:`1px solid ${P.border}`, fontSize:13, color:P.text, lineHeight:1.5}}>
            <span style={{color:P.muted, fontSize:11, fontWeight:700}}>{kid.zh} 說：</span>「{t.photoNote}」
          </div>
        )}

        <div style={{marginTop:14, padding:14, background:P.surface, borderRadius:14, border:`1px solid ${P.border}`}}>
          <div style={{fontSize:11, fontWeight:800, letterSpacing:1, color:P.muted}}>回一句話（選填）</div>
          <input value={note} onChange={e=>setNote(e.target.value)} placeholder="很棒！/ 桌面還可以再整齊一點" style={{marginTop:8, width:'100%', padding:'10px 12px', background:P.bg, borderRadius:10, border:`1px dashed ${P.border}`, fontSize:13, color:P.text, lineHeight:1.5, outline:'none'}}/>
          <div style={{display:'flex', gap:6, flexWrap:'wrap', marginTop:10}}>
            {['做得很好！','下次再仔細一點','👍','👏','要重做喔'].map((c,i)=>(
              <div key={i} onClick={()=>setNote(c)} style={{padding:'6px 10px', borderRadius:9999, background:`${P.primary}18`, color:P.primary, fontSize:11, fontWeight:700, border:`1px solid ${P.border}`, cursor:'pointer'}}>{c}</div>
            ))}
          </div>
        </div>
      </div>
      <div style={{padding:'12px 22px 22px', flexShrink:0, display:'flex', gap:10, borderTop:`1px solid ${P.border}`, background:P.bg, position:'relative', zIndex:2}}>
        <div onClick={()=>onReject(taskId, note)} style={{flex:1, padding:'14px', borderRadius:9999, background:'transparent', border:`1px solid ${P.accentHot}`, color:P.accentHot, fontFamily:'var(--font-display)', fontWeight:800, fontSize:14, textAlign:'center', cursor:'pointer'}}>↺ 再試一次</div>
        <div onClick={()=>onApprove(taskId, note)} style={{flex:1.5, padding:'14px', borderRadius:9999, background:P.primary, color:P.bg, fontFamily:'var(--font-display)', fontWeight:800, fontSize:14, textAlign:'center', cursor:'pointer', boxShadow:'0 8px 24px rgba(255,217,102,0.28)', display:'flex', alignItems:'center', justifyContent:'center', gap:8}}>
          <PRoughStar size={16} color={P.bg}/>通過 +★ {t.points}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ParentTasksManage, ParentReviewList, ParentReviewSheet });
