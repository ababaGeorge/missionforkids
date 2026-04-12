import { Timestamp } from '@react-native-firebase/firestore';

// ============================================
// 一、帳號與家庭結構
// ============================================

export interface User {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  authProvider: 'apple' | 'google' | 'anonymous';
  authProviderId: string;
  roleType: 'parent' | 'child';
  birthday: Timestamp | null;
  createdAt: Timestamp;
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
}

// ============================================
// 二、點數系統
// ============================================

export interface PointWallet {
  id: string;
  userId: string;
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
  reviewMode: TaskReviewMode;
  assigneeType: TaskAssigneeType;
  assigneeUserId: string | null;
  status: TaskStatus;
  createdBy: string;
  createdAt: Timestamp;
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
  familyId: string;
  periodStart: Timestamp;
  periodEnd: Timestamp;
  gracePeriodEnd: Timestamp;
  status: TaskInstanceStatus;
  submissionCount: number;
  reviewedBy: string | null;
  reviewedAt: Timestamp | null;
  pointsAwarded: number | null;
}

export type AiResult = 'pass' | 'fail' | 'uncertain';

export interface TaskSubmission {
  id: string;
  taskInstanceId: string;
  familyId: string;
  submittedBy: string;
  photoUrls: string[];
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
  pointCostSnapshot: number;
  status: RewardOrderStatus;
  cancelledAt: Timestamp | null;
  approvedAt: Timestamp | null;
  deliveredAt: Timestamp | null;
  completedAt: Timestamp | null;
  autoCompleteAt: Timestamp | null;
  createdAt: Timestamp;
}
