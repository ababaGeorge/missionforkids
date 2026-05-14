import { useState, useEffect, useRef } from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import type { TaskInstance, RewardOrder } from '../../../types/models';
import { useFamily } from '../../../hooks/useFamily';
import { P, spacing, radius } from '../../../design/tokens';
import { Starfield } from '../../../design/Starfield';
import { Display, H3, Label, Muted, Data } from '../../../design/Text';
import { Empty } from '../../../design/Empty';

type NotifKind = 'task_submitted' | 'reward_ordered';

type NotifItem = {
  id: string;
  kind: NotifKind;
  title: string;
  childName: string;
  points?: number | null;
  sortDate: any;
};

const KIND_CONFIG: Record<NotifKind, { symbol: string; color: string }> = {
  task_submitted: { symbol: '📸', color: P.accent },
  reward_ordered: { symbol: '🎁', color: P.primary },
};

const fmtTime = (ts: any): string => {
  if (!ts) return '';
  const d: Date = typeof ts?.toDate === 'function' ? ts.toDate() : new Date(ts);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return '剛剛';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`;
  return d.toLocaleDateString();
};

export default function ParentNotif() {
  const uid = auth().currentUser?.uid;
  const { family } = useFamily(uid);
  const familyId = family?.id ?? null;

  const [notifs, setNotifs] = useState<NotifItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const taskGen = useRef(0);
  const orderGen = useRef(0);
  const taskNotifs = useRef<NotifItem[]>([]);
  const orderNotifs = useRef<NotifItem[]>([]);

  const merge = () => {
    const all = [...taskNotifs.current, ...orderNotifs.current];
    all.sort((a, b) => {
      const da: any = a.sortDate?.toDate?.() ?? new Date(a.sortDate ?? 0);
      const db: any = b.sortDate?.toDate?.() ?? new Date(b.sortDate ?? 0);
      return db.getTime() - da.getTime();
    });
    setNotifs(all);
  };

  // Subscribe to submitted task instances
  useEffect(() => {
    if (!familyId) return;
    const unsub = firestore()
      .collection('taskInstances')
      .where('familyId', '==', familyId)
      .where('status', '==', 'submitted')
      .limit(20)
      .onSnapshot(async (snap) => {
        if (!snap) return;
        const gen = ++taskGen.current;
        const items: NotifItem[] = [];
        for (const doc of snap.docs) {
          try {
            const inst = { id: doc.id, ...doc.data() } as TaskInstance;
            const [taskDoc, userDoc] = await Promise.all([
              firestore().collection('tasks').doc(inst.taskId).get(),
              firestore().collection('users').doc(inst.userId).get(),
            ]);
            items.push({
              id: `task_${doc.id}`,
              kind: 'task_submitted',
              title: taskDoc.data()?.title ?? '任務',
              childName: userDoc.data()?.displayName ?? '孩子',
              points: taskDoc.data()?.points ?? null,
              sortDate: inst.periodEnd,
            });
          } catch (e) {
            console.warn('[ParentNotif] task skip', doc.id, (e as any)?.code);
          }
        }
        if (gen !== taskGen.current) return;
        taskNotifs.current = items;
        merge();
      }, (err) => console.error('[ParentNotif] task error:', (err as any)?.code));
    return unsub;
  }, [familyId]);

  // Subscribe to pending reward orders
  useEffect(() => {
    if (!familyId) return;
    const unsub = firestore()
      .collection('rewardOrders')
      .where('familyId', '==', familyId)
      .where('status', '==', 'pending')
      .limit(20)
      .onSnapshot(async (snap) => {
        if (!snap) return;
        const gen = ++orderGen.current;
        const items: NotifItem[] = [];
        for (const doc of snap.docs) {
          try {
            const order = { id: doc.id, ...doc.data() } as RewardOrder;
            const [itemDoc, userDoc] = await Promise.all([
              firestore().collection('rewardItems').doc(order.itemId).get(),
              firestore().collection('users').doc(order.userId).get(),
            ]);
            items.push({
              id: `order_${doc.id}`,
              kind: 'reward_ordered',
              title: itemDoc.data()?.title ?? '獎勵',
              childName: userDoc.data()?.displayName ?? '孩子',
              points: order.pointCostSnapshot,
              sortDate: order.createdAt,
            });
          } catch (e) {
            console.warn('[ParentNotif] order skip', doc.id, (e as any)?.code);
          }
        }
        if (gen !== orderGen.current) return;
        orderNotifs.current = items;
        merge();
      }, (err) => console.error('[ParentNotif] order error:', (err as any)?.code));
    return unsub;
  }, [familyId]);

  const unreadCount = notifs.filter((n) => !readIds.has(n.id)).length;

  const markAllRead = () => setReadIds(new Set(notifs.map((n) => n.id)));
  const markOneRead = (id: string) => setReadIds((prev) => new Set([...prev, id]));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <Starfield count={14} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Label color={P.muted} style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1.5 }}>
              通知
            </Label>
            <Display style={{ marginTop: 2 }}>
              {unreadCount > 0 ? `${unreadCount} 個新的` : '都看過了'}
            </Display>
          </View>
          {unreadCount > 0 && (
            <Pressable onPress={markAllRead} style={styles.markReadBtn}>
              <Muted style={{ fontSize: 12 }}>全部標示已讀</Muted>
            </Pressable>
          )}
        </View>

        <View style={styles.body}>
          {notifs.length === 0 ? (
            <Empty emoji="✉️" title="沒有通知" body="小孩做完任務或申請兌換會在這裡。" />
          ) : (
            notifs.map((n) => {
              const isRead = readIds.has(n.id);
              const cfg = KIND_CONFIG[n.kind];
              return (
                <Pressable
                  key={n.id}
                  onPress={() => markOneRead(n.id)}
                  style={[styles.notifCard, isRead && styles.notifCardRead]}
                >
                  {!isRead && <View style={styles.unreadDot} />}
                  <View style={[styles.iconCircle, { backgroundColor: `${cfg.color}38` }]}>
                    <Data style={{ fontSize: 18, lineHeight: 22 }}>
                      {cfg.symbol}
                    </Data>
                  </View>
                  <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
                    <H3 style={{ fontSize: 14, fontWeight: '700', lineHeight: 18 }}>
                      {n.kind === 'task_submitted'
                        ? `${n.childName} 完成了「${n.title}」`
                        : `${n.childName} 想兌換「${n.title}」`}
                    </H3>
                    <View style={styles.metaRow}>
                      <Muted style={{ fontSize: 11 }}>{fmtTime(n.sortDate)}</Muted>
                      {n.points != null && (
                        <Data style={{ fontSize: 12, color: P.primary, marginLeft: 8, fontWeight: '700' }}>
                          ★ {n.points}
                        </Data>
                      )}
                    </View>
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: P.bg },
  scroll: { paddingBottom: spacing['3xl'] + spacing.lg },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  markReadBtn: { paddingVertical: 6, paddingHorizontal: 10 },
  body: { paddingHorizontal: spacing.lg },
  notifCard: {
    backgroundColor: P.surface,
    borderWidth: 1,
    borderColor: P.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  notifCardRead: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  unreadDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: P.primary,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
});
