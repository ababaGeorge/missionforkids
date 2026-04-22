/* eslint-disable */
// Shared sample data + i18n strings for all directions.

window.MFK_DATA = {
  family: {
    kids: [
      { id: 'mei', name: 'Mei', zh: '小美', age: 7, color: '#F5A623', stars: 142 },
      { id: 'kai', name: 'Kai', zh: '小凱', age: 10, color: '#2E86C1', stars: 86 },
    ],
    parents: [
      { id: 'mom', name: 'Mom', zh: '媽', color: '#1A8A7A' },
      { id: 'dad', name: 'Dad', zh: '爸', color: '#8A8275' },
    ],
  },
  tasksFull: [
    { id: 't1', en: 'Clean your desk', zh: '整理書桌', points: 10, status: 'todo', due: 'Today', reviewMode: 'semi_auto' },
    { id: 't2', en: 'Brush teeth', zh: '刷牙', points: 5, status: 'done', due: 'Today' },
    { id: 't3', en: 'Practice piano', zh: '練鋼琴', points: 10, status: 'pending', due: 'Today' },
    { id: 't4', en: 'Read 20 minutes', zh: '閱讀 20 分鐘', points: 8, status: 'todo', due: 'Today' },
    { id: 't5', en: 'Feed the fish', zh: '餵魚', points: 3, status: 'done', due: 'Today' },
    { id: 't6', en: 'Homework', zh: '寫作業', points: 15, status: 'todo', due: 'Today' },
  ],
  tasksLight: [
    { id: 't1', en: 'Feed the fish', zh: '餵魚', points: 3, status: 'done', due: 'Today' },
  ],
  rewards: [
    { id: 'r1', en: 'Ice cream trip', zh: '吃冰淇淋', cost: 50, color: '#FFCFA3', emoji: '🍦', affordable: true },
    { id: 'r2', en: '30 min game time', zh: '遊戲 30 分鐘', cost: 30, color: '#C8E0D8', emoji: '🎮', affordable: true },
    { id: 'r3', en: 'Pick a movie', zh: '選電影', cost: 100, color: '#D8E4F0', emoji: '🎬', affordable: true },
    { id: 'r4', en: 'New book', zh: '新的書', cost: 200, color: '#F0D8C0', emoji: '📚', affordable: false },
    { id: 'r5', en: 'Stay up 30 min', zh: '晚睡 30 分鐘', cost: 80, color: '#E8D0E4', emoji: '🌙', affordable: true },
    { id: 'r6', en: 'LEGO set', zh: '樂高', cost: 500, color: '#D0D8E8', emoji: '🧱', affordable: false },
  ],
  reviewQueue: [
    { id: 's1', taskEn: 'Homework', taskZh: '寫作業', kid: 'Kai', when: '6:10 PM', ai: 'uncertain', photo: 'linear-gradient(135deg,#D8C8A8,#A89268)', points: 15 },
    { id: 's2', taskEn: 'Tidy toys', taskZh: '整理玩具', kid: 'Kai', when: '2:40 PM', ai: 'fail', photo: 'linear-gradient(135deg,#C8A8B8,#886878)', points: 8 },
    { id: 's3', taskEn: 'Clean desk', taskZh: '整理書桌', kid: 'Mei', when: '4:32 PM', ai: 'pass', photo: 'linear-gradient(135deg,#C0AC80,#8A7A54)', points: 10 },
    { id: 's4', taskEn: 'Practice piano', taskZh: '練鋼琴', kid: 'Mei', when: '3:15 PM', ai: 'pass', photo: 'linear-gradient(135deg,#A8B8C8,#687888)', points: 10 },
    { id: 's5', taskEn: 'Brush teeth', taskZh: '刷牙', kid: 'Mei', when: '7:42 AM', ai: 'pass', photo: 'linear-gradient(135deg,#B8C8A8,#788868)', points: 5 },
  ],
  i18n: {
    zh: {
      today: '今天', tasks: '任務', rewards: '獎勵', me: '我的', review: '審核', settings: '設定',
      nextMission: '下一個任務', takePhoto: '拍照', stars: '星星',
      aiLooking: 'AI 正在看你的照片', aiPass: 'AI 覺得不錯', aiUncertain: 'AI 不太確定', aiFail: 'AI 看不清楚',
      pending: '待審核', pendingStars: '待拿星星', approved: '已通過',
      niceJob: '做得好！', earnedStars: '你拿到星星了',
      needMore: '還差 {n} 顆', redeem: '兌換', redeeming: '兌換中',
      rewardReady: '獎勵準備好了！', tellParent: '去告訴爸爸媽媽',
      allCaught: '全部審核完畢', needsAttention: '需要你看一下', aiApproved: 'AI 已通過',
      approveAll: '全部通過', assign: '派任務', save: '儲存',
      dueToday: '今天', reviewMode: '審核方式', assignee: '指派給',
      done: '完成', tryAgain: '再試一次',
    },
    en: {
      today: 'Today', tasks: 'Tasks', rewards: 'Rewards', me: 'Me', review: 'Review', settings: 'Settings',
      nextMission: 'Next mission', takePhoto: 'Take photo', stars: 'Stars',
      aiLooking: 'AI is looking at your photo', aiPass: 'AI thinks it looks good', aiUncertain: 'AI is not sure', aiFail: 'AI cannot tell',
      pending: 'Pending', pendingStars: 'Pending stars', approved: 'Approved',
      niceJob: 'Nice job!', earnedStars: 'You earned stars',
      needMore: 'Need {n} more', redeem: 'Redeem', redeeming: 'Redeeming',
      rewardReady: 'Reward is ready!', tellParent: 'Tell Mom or Dad',
      allCaught: 'All caught up', needsAttention: 'Needs your attention', aiApproved: 'AI approved',
      approveAll: 'Approve all', assign: 'Assign task', save: 'Save',
      dueToday: 'Today', reviewMode: 'Review mode', assignee: 'Assignee',
      done: 'Done', tryAgain: 'Try again',
    },
  },
};
