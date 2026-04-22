/* eslint-disable */
// Central store for the clickable prototype.
// One global "world" that both iPhones see.
// Changes sync across the two frames via BroadcastChannel + persist to localStorage.

(function(){
  const STORAGE_KEY = 'mfk_prototype_world_v1';
  const CHANNEL = 'mfk_prototype_v1';

  // ---------- Initial world ----------
  function initialWorld(){
    const now = Date.now();
    return {
      // Family ledger (stars per kid)
      kids: {
        mei: { id:'mei', zh:'小美', name:'Mei', age:7, color:'#F5A623', stars: 142, streak: 6 },
        kai: { id:'kai', zh:'小凱', name:'Kai', age:10, color:'#2E86C1', stars: 86, streak: 2 },
      },
      currentKidId: 'mei', // the kid whose phone we're showing

      // Tasks assigned. Each task lives in a lifecycle.
      // state: 'todo' | 'submitted' | 'approved' | 'rejected'
      tasks: [
        { id:'t1', zh:'整理書桌',   emoji:'🧹', points:10, kidId:'mei', state:'todo',      freq:'daily',  due:'today', createdAt: now-86400000*3, submittedAt:null, reviewedAt:null, photoNote:null, parentNote:null, paused:false },
        { id:'t2', zh:'刷牙',       emoji:'🪥', points:5,  kidId:'mei', state:'approved',  freq:'daily',  due:'today', createdAt: now-86400000*10, submittedAt:now-3600000*6, reviewedAt:now-3600000*5, photoNote:null, parentNote:null, paused:false },
        { id:'t3', zh:'練鋼琴',     emoji:'🎹', points:10, kidId:'mei', state:'submitted', freq:'mwf',    due:'today', createdAt: now-86400000*30, submittedAt:now-3600000*2, reviewedAt:null, photoNote:'彈了小星星+法國民謠', parentNote:null, paused:false },
        { id:'t4', zh:'閱讀 20 分鐘', emoji:'📖', points:8,  kidId:'mei', state:'todo',      freq:'daily',  due:'today', createdAt: now-86400000*5, submittedAt:null, reviewedAt:null, photoNote:null, parentNote:null, paused:false },
        { id:'t5', zh:'餵魚',       emoji:'🐠', points:3,  kidId:'mei', state:'approved',  freq:'daily',  due:'today', createdAt: now-86400000*20, submittedAt:now-3600000*8, reviewedAt:now-3600000*7, photoNote:null, parentNote:null, paused:false },
        { id:'t6', zh:'寫作業',     emoji:'📝', points:15, kidId:'kai', state:'submitted', freq:'daily',  due:'today', createdAt: now-86400000*2, submittedAt:now-3600000, reviewedAt:null, photoNote:'數學+國語', parentNote:null, paused:false },
        { id:'t7', zh:'倒垃圾',     emoji:'🗑️', points:20, kidId:'kai', state:'todo',      freq:'weekly', due:'today', createdAt: now-86400000*7, submittedAt:null, reviewedAt:null, photoNote:null, parentNote:null, paused:false },
        { id:'t8', zh:'整理玩具',   emoji:'🧸', points:8,  kidId:'kai', state:'todo',      freq:'weekly', due:'today', createdAt: now-86400000*14, submittedAt:null, reviewedAt:null, photoNote:null, parentNote:null, paused:true },
      ],

      // Rewards catalogue
      rewards: [
        { id:'r1', zh:'吃冰淇淋',     emoji:'🍦', cost:50,  color:'#FFCFA3' },
        { id:'r2', zh:'遊戲 30 分鐘', emoji:'🎮', cost:30,  color:'#C8E0D8' },
        { id:'r3', zh:'選電影',       emoji:'🎬', cost:100, color:'#D8E4F0' },
        { id:'r4', zh:'新的書',       emoji:'📚', cost:200, color:'#F0D8C0' },
        { id:'r5', zh:'晚睡 30 分鐘', emoji:'🌙', cost:80,  color:'#E8D0E4' },
        { id:'r6', zh:'樂高',         emoji:'🧱', cost:500, color:'#D0D8E8' },
      ],

      // Redeem orders: kid requests -> parent confirms -> delivered
      // state: 'requested' | 'confirmed' | 'delivered' | 'declined'
      orders: [],

      // Notifications queue. One feed per role.
      // { id, forRole, toKidId?, kind, title, body, when, read, refId }
      notifications: [
        { id:'n1', forRole:'parent', kind:'submission', title:'小凱 提交了寫作業', body:'等你審核', when: now-3600000, read:false, refId:'t6' },
        { id:'n2', forRole:'parent', kind:'submission', title:'小美 提交了練鋼琴', body:'等你審核', when: now-3600000*2, read:false, refId:'t3' },
      ],

      // Per-frame UI state (which screen each role is viewing)
      ui: {
        child:  { screen: 'tasks-home', modal: null, celebratingTaskId: null, orderWatchId: null },
        parent: { screen: 'tasks-manage', modal: null, reviewingTaskId: null, orderConfirmId: null },
      },

      meta: {
        version: 1,
        createdAt: now,
      },
    };
  }

  // ---------- Persistence ----------
  let world = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) world = JSON.parse(raw);
  } catch(e){}
  if (!world || world?.meta?.version !== 1) world = initialWorld();

  // ---------- Pub-sub ----------
  const subs = new Set();
  function notify(){ subs.forEach(fn => { try{ fn(world); }catch(e){ console.error(e); } }); }
  function save(){
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(world)); } catch(e){}
  }

  // ---------- Cross-frame sync ----------
  let channel = null;
  try { channel = new BroadcastChannel(CHANNEL); } catch(e){}
  if (channel){
    channel.onmessage = (ev) => {
      if (ev.data?.type === 'world-update' && ev.data.world){
        world = ev.data.world;
        notify();
      }
    };
  }
  function broadcast(){
    save();
    if (channel) channel.postMessage({ type:'world-update', world });
  }

  // ---------- Mutations ----------
  function update(mut){
    mut(world);
    notify();
    broadcast();
  }

  // ---------- Helpers ----------
  function uid(prefix){ return prefix + '_' + Math.random().toString(36).slice(2,8); }
  function fmtWhen(ts){
    const diff = Date.now() - ts;
    if (diff < 60000) return '剛剛';
    if (diff < 3600000) return Math.floor(diff/60000) + ' 分鐘前';
    if (diff < 86400000) return Math.floor(diff/3600000) + ' 小時前';
    return Math.floor(diff/86400000) + ' 天前';
  }

  // ---------- Actions ----------
  const actions = {
    // ---- UI navigation ----
    goto(role, screen, payload){
      update(w => {
        w.ui[role].screen = screen;
        w.ui[role].modal = null;
        if (payload?.taskId !== undefined) w.ui[role].celebratingTaskId = payload.taskId;
        if (payload?.reviewingTaskId !== undefined) w.ui[role].reviewingTaskId = payload.reviewingTaskId;
        if (payload?.orderWatchId !== undefined) w.ui[role].orderWatchId = payload.orderWatchId;
        if (payload?.orderConfirmId !== undefined) w.ui[role].orderConfirmId = payload.orderConfirmId;
      });
    },
    openModal(role, modal, payload){
      update(w => {
        w.ui[role].modal = modal;
        if (payload?.taskId !== undefined) w.ui[role].celebratingTaskId = payload.taskId;
        if (payload?.reviewingTaskId !== undefined) w.ui[role].reviewingTaskId = payload.reviewingTaskId;
        if (payload?.orderWatchId !== undefined) w.ui[role].orderWatchId = payload.orderWatchId;
        if (payload?.orderConfirmId !== undefined) w.ui[role].orderConfirmId = payload.orderConfirmId;
      });
    },
    closeModal(role){
      update(w => { w.ui[role].modal = null; });
    },
    switchKid(kidId){
      update(w => { w.currentKidId = kidId; });
    },

    // ---- Child: submit a task ----
    submitTask(taskId, photoNote){
      update(w => {
        const t = w.tasks.find(x => x.id === taskId);
        if (!t) return;
        t.state = 'submitted';
        t.submittedAt = Date.now();
        if (photoNote) t.photoNote = photoNote;
        const kid = w.kids[t.kidId];
        // Pop a notification for the parent
        w.notifications.unshift({
          id: uid('n'),
          forRole: 'parent',
          kind: 'submission',
          title: `${kid.zh} 提交了${t.zh}`,
          body: '等你審核',
          when: Date.now(),
          read: false,
          refId: t.id,
        });
      });
    },

    // ---- Parent: review ----
    approveTask(taskId, note){
      update(w => {
        const t = w.tasks.find(x => x.id === taskId);
        if (!t) return;
        t.state = 'approved';
        t.reviewedAt = Date.now();
        if (note) t.parentNote = note;
        const kid = w.kids[t.kidId];
        kid.stars += t.points;
        // Tell the kid
        w.notifications.unshift({
          id: uid('n'),
          forRole: 'child',
          toKidId: t.kidId,
          kind: 'approved',
          title: `${t.zh} 通過啦！`,
          body: `+★ ${t.points}`,
          when: Date.now(),
          read: false,
          refId: t.id,
        });
      });
    },
    rejectTask(taskId, note){
      update(w => {
        const t = w.tasks.find(x => x.id === taskId);
        if (!t) return;
        t.state = 'rejected';
        t.reviewedAt = Date.now();
        if (note) t.parentNote = note;
        w.notifications.unshift({
          id: uid('n'),
          forRole:'child',
          toKidId: t.kidId,
          kind:'rejected',
          title:`${t.zh} 要再試一次`,
          body: note || '爸媽說可以再做一次',
          when: Date.now(),
          read:false,
          refId: t.id,
        });
      });
    },
    // Retry a rejected task -> back to todo
    retryTask(taskId){
      update(w => {
        const t = w.tasks.find(x => x.id === taskId);
        if (!t) return;
        t.state = 'todo';
        t.submittedAt = null;
        t.reviewedAt = null;
        t.parentNote = null;
      });
    },

    // ---- Redeem flow ----
    requestRedeem(rewardId, kidId){
      update(w => {
        const r = w.rewards.find(x => x.id === rewardId);
        const k = w.kids[kidId];
        if (!r || !k) return;
        if (k.stars < r.cost) return;
        const orderId = uid('o');
        w.orders.unshift({
          id: orderId,
          rewardId, kidId,
          cost: r.cost,
          state: 'requested',
          requestedAt: Date.now(),
          confirmedAt: null,
          deliveredAt: null,
          declinedAt: null,
          parentNote: null,
        });
        w.notifications.unshift({
          id: uid('n'),
          forRole:'parent',
          kind:'redeem',
          title:`${k.zh} 想兌換 ${r.zh}`,
          body:`− ★ ${r.cost}`,
          when: Date.now(),
          read:false,
          refId: orderId,
        });
      });
    },
    confirmRedeem(orderId, note){
      update(w => {
        const o = w.orders.find(x => x.id === orderId);
        if (!o) return;
        o.state = 'confirmed';
        o.confirmedAt = Date.now();
        if (note) o.parentNote = note;
        const k = w.kids[o.kidId];
        const r = w.rewards.find(x => x.id === o.rewardId);
        k.stars -= o.cost;
        w.notifications.unshift({
          id: uid('n'),
          forRole:'child',
          toKidId: o.kidId,
          kind:'redeem-confirmed',
          title:`${r.zh} 說好囉！`,
          body:'準備收到',
          when: Date.now(),
          read:false,
          refId: orderId,
        });
      });
    },
    declineRedeem(orderId, note){
      update(w => {
        const o = w.orders.find(x => x.id === orderId);
        if (!o) return;
        o.state = 'declined';
        o.declinedAt = Date.now();
        o.parentNote = note || '晚點再說';
        const r = w.rewards.find(x => x.id === o.rewardId);
        w.notifications.unshift({
          id: uid('n'),
          forRole:'child',
          toKidId: o.kidId,
          kind:'redeem-declined',
          title:`${r.zh} 晚點再說`,
          body: note || '',
          when: Date.now(),
          read:false,
          refId: orderId,
        });
      });
    },
    deliverRedeem(orderId){
      update(w => {
        const o = w.orders.find(x => x.id === orderId);
        if (!o || o.state !== 'confirmed') return;
        o.state = 'delivered';
        o.deliveredAt = Date.now();
      });
    },

    // ---- Parent: task management ----
    toggleTaskPaused(taskId){
      update(w => {
        const t = w.tasks.find(x => x.id === taskId);
        if (!t) return;
        t.paused = !t.paused;
      });
    },
    addTask(partial){
      update(w => {
        w.tasks.unshift({
          id: uid('t'),
          zh: partial.zh || '新任務',
          emoji: partial.emoji || '✨',
          points: partial.points || 10,
          kidId: partial.kidId || 'mei',
          state: 'todo',
          freq: partial.freq || 'daily',
          due: 'today',
          createdAt: Date.now(),
          submittedAt: null, reviewedAt: null, photoNote:null, parentNote:null, paused:false,
        });
      });
    },

    // ---- Notifications ----
    markNotifRead(id){
      update(w => {
        const n = w.notifications.find(x => x.id === id);
        if (n) n.read = true;
      });
    },
    markAllRead(role, kidId){
      update(w => {
        w.notifications.forEach(n => {
          if (n.forRole !== role) return;
          if (role === 'child' && kidId && n.toKidId && n.toKidId !== kidId) return;
          n.read = true;
        });
      });
    },

    // ---- Demo controls ----
    reset(){
      world = initialWorld();
      notify();
      broadcast();
    },
    // Fast-forward delivery for demo (orders that have been confirmed)
    fastForwardDelivery(){
      update(w => {
        w.orders.forEach(o => {
          if (o.state === 'confirmed') {
            o.state = 'delivered';
            o.deliveredAt = Date.now();
          }
        });
      });
    },
  };

  // ---------- Selectors ----------
  const select = {
    currentKid: () => world.kids[world.currentKidId],
    kid: (id) => world.kids[id],
    tasksForKid: (kidId) => world.tasks.filter(t => t.kidId === kidId),
    submittedTasks: () => world.tasks.filter(t => t.state === 'submitted'),
    pendingCountForParent: () => world.tasks.filter(t => t.state === 'submitted').length
      + world.orders.filter(o => o.state === 'requested').length,
    unreadForRole: (role, kidId) => world.notifications.filter(n => {
      if (n.forRole !== role) return false;
      if (role === 'child' && kidId && n.toKidId && n.toKidId !== kidId) return false;
      return !n.read;
    }),
    notifsForRole: (role, kidId) => world.notifications.filter(n => {
      if (n.forRole !== role) return false;
      if (role === 'child' && kidId && n.toKidId && n.toKidId !== kidId) return false;
      return true;
    }),
    pendingOrdersForParent: () => world.orders.filter(o => o.state === 'requested'),
    ordersForKid: (kidId) => world.orders.filter(o => o.kidId === kidId),
    activeOrderForKid: (kidId) => world.orders.find(o => o.kidId === kidId && (o.state === 'requested' || o.state === 'confirmed')),
    reward: (id) => world.rewards.find(r => r.id === id),
    task: (id) => world.tasks.find(t => t.id === id),
    order: (id) => world.orders.find(o => o.id === id),
  };

  // ---------- React hook ----------
  function useWorld(){
    const [, force] = React.useReducer(x => x+1, 0);
    React.useEffect(() => {
      subs.add(force);
      return () => subs.delete(force);
    }, []);
    return world;
  }

  window.MFKStore = {
    get world(){ return world; },
    subscribe(fn){ subs.add(fn); return () => subs.delete(fn); },
    actions, select, useWorld, fmtWhen,
  };
})();
