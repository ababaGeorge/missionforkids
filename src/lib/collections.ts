import firestore from '@react-native-firebase/firestore';

export const usersCol = () => firestore().collection('users');
export const familiesCol = () => firestore().collection('families');
export const membershipsCol = () => firestore().collection('familyMemberships');
export const walletsCol = () => firestore().collection('pointWallets');
export const transactionsCol = () => firestore().collection('pointTransactions');
export const tasksCol = () => firestore().collection('tasks');
export const taskInstancesCol = () => firestore().collection('taskInstances');
export const taskSubmissionsCol = () => firestore().collection('taskSubmissions');
export const rewardItemsCol = () => firestore().collection('rewardItems');
export const rewardOrdersCol = () => firestore().collection('rewardOrders');
