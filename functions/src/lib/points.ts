/**
 * 點數金額驗證：必須是有限整數。
 * 擋掉 NaN / Infinity / 小數 / 非數字，避免寫出 NaN 餘額或負獎勵成本。
 * 純函式，不拋錯 — 呼叫端決定 callable 拋 HttpsError 或 trigger log+skip。
 */
export function isValidPointsValue(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && Number.isInteger(n);
}
