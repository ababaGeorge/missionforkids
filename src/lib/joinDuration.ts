// 小孩「我的」頁「加入時長」顯示的單一來源。
// 舊算法用 (now - createdAt) / 30 天四捨五入再 Math.max(1, ...)，
// 剛加入第 0 天就顯示「加入 1 個月」——改成按天數分段：
//   0 天 →「今天加入」；< 30 天 →「加入 X 天」；其餘 →「加入 X 個月」。
export function joinDurationLabel(
  createdAt: Date,
  now: Date = new Date()
): string | null {
  const days = Math.floor((now.getTime() - createdAt.getTime()) / 86400000);
  // 無效日期（NaN）或未來時間（時鐘偏差）都當「今天加入」以外的異常處理：
  // NaN 回 null 讓畫面不顯示；負數視為今天。
  if (Number.isNaN(days)) return null;
  if (days <= 0) return '今天加入';
  if (days < 30) return `加入 ${days} 天`;
  return `加入 ${Math.floor(days / 30)} 個月`;
}
