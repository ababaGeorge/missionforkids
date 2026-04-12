import * as admin from 'firebase-admin';

admin.initializeApp();

export { onTaskInstanceApproved } from './onTaskInstanceApproved';
export { onRewardOrderCreated } from './onRewardOrderCreated';
export { onRewardOrderCancelledOrRejected } from './onRewardOrderCancelledOrRejected';
export { autoCompleteDeliveredOrders } from './autoCompleteDeliveredOrders';
export { analyzePhoto } from './analyzePhoto';
