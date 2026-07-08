import { Timestamp } from '@react-native-firebase/firestore';

// ============================================
// 一、帳號與家庭結構
// ============================================

export interface User {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  authProvider: 'apple' | 'google' | 'password' | 'anonymous';
  authProviderId: string;
  roleType: 'parent' | 'child';
  email: string | null;
  birthday: Timestamp | null;
  createdAt: Timestamp;
  // 小孩專用：點數釘 childId（值預設 = 當下 uid）。家長為 undefined。
  childId?: string;
}

export interface Family {
  id: string;
  displayName: string;
  defaultGraceDays: number;
  createdBy: string;
  createdAt: Timestamp;
}

export type MembershipStatus = 'active' | 'pending' | 'removed';

export interface FamilyMembership {
  id: string;
  familyId: string;
  userId: string;
  role: 'parent' | 'child';
  status: MembershipStatus;
  invitedBy: string;
  joinedAt: Timestamp | null;
  // family-scoped 覆寫：與真實 user.displayName / avatar 無關，僅此家庭內顯示用
  nickname?: string | null;
  avatarEmoji?: string | null;
  childId?: string | null;
}

export type FamilyInviteStatus = 'pending' | 'accepted' | 'expired';

export interface FamilyInviteChildProfile {
  displayName: string;
  nickname: string | null;
  avatarEmoji: string | null;
}

export interface FamilyInvite {
  id: string;
  email: string;
  familyId: string;
  role: 'child';
  invitedBy: string;
  status: FamilyInviteStatus;
  childProfile: FamilyInviteChildProfile;
  acceptedBy: string | null;
  createdAt: Timestamp;
  expiresAt: Timestamp;
}

// ============================================
// 二、點數系統
// ============================================

export interface PointWallet {
  id: string;
  userId: string;
  childId?: string;
  familyId: string;
  balance: number;
  updatedAt: Timestamp;
}

export type PointTransactionSourceType =
  | 'task_completion'
  | 'parent_grant'
  | 'reward_order'
  | 'reward_refund';

export interface PointTransaction {
  id: string;
  walletId: string;
  childId?: string;
  delta: number;
  sourceType: PointTransactionSourceType;
  sourceId: string | null;
  createdBy: string | null;
  note: string | null;
  createdAt: Timestamp;
}

// ============================================
// 三、任務系統
// ============================================

export type TaskFrequency = 'once' | 'daily' | 'weekly' | 'monthly';
export type TaskReviewMode = 'semi_auto' | 'manual';
export type TaskAssigneeType = 'individual' | 'family';
export type TaskStatus = 'active' | 'archived';

export interface Task {
  id: string;
  familyId: string;
  title: string;
  points: number;
  frequency: TaskFrequency;
  startDate: Timestamp;
  dueDate: Timestamp;
  graceDays: number;
  reviewMode: TaskReviewMode;
  assigneeType: TaskAssigneeType;
  assigneeUserId: string | null;
  status: TaskStatus;
  createdBy: string;
  createdAt: Timestamp;
  parentHint?: string | null;
}

export type TaskInstanceStatus =
  | 'pending'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'missed';

export interface TaskInstance {
  id: string;
  taskId: string;
  userId: string;
  childId?: string;
  familyId: string;
  periodStart: Timestamp;
  periodEnd: Timestamp;
  gracePeriodEnd: Timestamp;
  status: TaskInstanceStatus;
  submissionCount: number;
  reviewedBy: string | null;
  reviewedAt: Timestamp | null;
  pointsAwarded: number | null;
  parentNote?: string | null;
}

export type AiResult = 'pass' | 'fail' | 'uncertain';

export interface TaskSubmission {
  id: string;
  taskInstanceId: string;
  familyId: string;
  submittedBy: string;
  photoUrls: string[];
  childNote: string | null;
  aiResult: AiResult | null;
  aiConfidence: number | null;
  submittedAt: Timestamp;
}

// ============================================
// 四、商城系統
// ============================================

export type RewardItemType = 'physical' | 'virtual';
export type RewardItemStatus = 'active' | 'archived';

export interface RewardItem {
  id: string;
  familyId: string;
  title: string;
  description: string | null;
  pointCost: number;
  itemType: RewardItemType;
  emoji: string | null;
  imageUrl: string | null;
  status: RewardItemStatus;
  createdBy: string;
  createdAt: Timestamp;
}

export type RewardOrderStatus =
  | 'pending'
  | 'approved'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'rejected';

export interface RewardOrder {
  id: string;
  familyId: string;
  itemId: string;
  userId: string;
  childId?: string;
  pointCostSnapshot: number;
  // BUG-06：下單當時的扣款前/後錢包餘額快照（CF 扣款 transaction 內寫入）。
  // optional 是向下相容關鍵——舊訂單沒有這兩個欄位，client 讀取要 fallback 回推邏輯。
  balanceBeforeSnapshot?: number;
  balanceAfterSnapshot?: number;
  status: RewardOrderStatus;
  cancelledAt: Timestamp | null;
  approvedAt: Timestamp | null;
  deliveredAt: Timestamp | null;
  completedAt: Timestamp | null;
  autoCompleteAt: Timestamp | null;
  createdAt: Timestamp;
}
