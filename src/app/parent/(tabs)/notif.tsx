import { useState, useEffect, useRef } from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import type { TaskInstance, RewardOrder } from '../../../types/models';
import { useFamily } from '../../../hooks/useFamily';
import { resolveMemberDisplay } from '../../../lib/memberName';
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

const toMillis = (ts: any): number => {
  if (!ts) return 0;
  if (typeof ts?.toDate === 'function') return ts.toDate().getTime();
  const t = new Date(ts).getTime();
  return Number.isNaN(t) ? 0 : t;
};

export default function ParentNotif() {
  const router = useRouter();
  const uid = auth().currentUser?.uid;
  const { family } = useFamily(uid);
  const familyId = family?.id ?? null;

  const [notifs, setNotifs] = useState<NotifItem[]>([]);
  // 已讀水位（millis）。null = 尚未載入或從未標示已讀 → 全部視為未讀。
  const [lastReadMs, setLastReadMs] = useState<number | null>(null);
  // 單則點擊的本地已讀（僅本次 session UX，不持久化）。
  const [localReadIds, setLocalReadIds] = useState<Set<string>>(new Set());
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

  // 掛載時讀 users/{uid}.notifLastReadAt 當初值。
  useEffect(() => {
    if (!uid) return;
    firestore()
      .collection('users')
      .doc(uid)
      .get()
      .then((doc) => {
        const ts = doc.data()?.notifLastReadAt;
        setLastReadMs(ts ? toMillis(ts) : null);
      })
      .catch((e) => console.warn('[ParentNotif] read lastRead failed', (e as any)?.code));
  }, [uid]);

  // Subscribe to submitted task instances
  useEffect(() => {
    if (!familyId) return;
    const unsub = firestore()
      .collection('taskInstances')
      .where('familyId', '==', familyId)
      .where('status', '==', 'submitted')
      .onSnapshot(async (snap) => {
        if (!snap) return;
        const gen = ++taskGen.current;
        const items: NotifItem[] = [];
        for (const doc of snap.docs) {
          try {
            const inst = { id: doc.id, ...doc.data() } as TaskInstance;
            const [taskDoc, member] = await Promise.all([
              firestore().collection('tasks').doc(inst.taskId).get(),
              resolveMemberDisplay(familyId, inst.userId, '孩子'),
            ]);
            items.push({
              id: `task_${doc.id}`,
              kind: 'task_submitted',
              title: taskDoc.data()?.title ?? '任務',
              childName: member.name,
              points: taskDoc.data()?.points ?? null,
              // 「已提交待審」通知的時間該用提交時間，不是任務截止日（periodEnd）。
              sortDate: inst.submittedAt ?? inst.periodEnd,
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
      .onSnapshot(async (snap) => {
        if (!snap) return;
        const gen = ++orderGen.current;
        const items: NotifItem[] = [];
        for (const doc of snap.docs) {
          try {
            const order = { id: doc.id, ...doc.data() } as RewardOrder;
            const [itemDoc, member] = await Promise.all([
              firestore().collection('rewardItems').doc(order.itemId).get(),
              resolveMemberDisplay(familyId, order.userId, '孩子'),
            ]);
            items.push({
              id: `order_${doc.id}`,
              kind: 'reward_ordered',
              title: itemDoc.data()?.title ?? '獎勵',
              childName: member.name,
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

  // 未讀 = 通知時間(sortDate) > 已讀水位；水位為 null 時全部未讀。
  // 本地單則已讀（localReadIds）額外覆蓋，僅本次 session。
  const isUnread = (n: NotifItem) =>
    !localReadIds.has(n.id) && (lastReadMs == null || toMillis(n.sortDate) > lastReadMs);

  const unreadCount = notifs.filter(isUnread).length;

  const markAllRead = () => {
    if (!uid) return;
    // 樂觀水位取「當前可見通知的最大時間戳」，與 isUnread 比較的 sortDate 同為 server 時鐘，
    // 避免裝置時鐘偏移導致漏標新通知或剛按的已讀仍顯示未讀。列表為空時退回 Date.now()（無通知可比）。
    const maxMs = notifs.reduce((max, n) => Math.max(max, toMillis(n.sortDate)), 0);
    setLastReadMs(maxMs > 0 ? maxMs : Date.now());
    // 實際寫入仍用 serverTimestamp()，下次載入讀回 server 水位一致。
    firestore()
      .collection('users')
      .doc(uid)
      .set({ notifLastReadAt: firestore.FieldValue.serverTimestamp() }, { merge: true })
      .catch((e) => console.warn('[ParentNotif] markAllRead failed', (e as any)?.code));
  };

  // lastReadAt 模型無法精確表達單則，單則點擊維持本地 UX（不持久化）。
  const markOneRead = (id: string) => setLocalReadIds((prev) => new Set([...prev, id]));

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
              const isRead = !isUnread(n);
              const cfg = KIND_CONFIG[n.kind];
              return (
                <Pressable
                  key={n.id}
                  onPress={() => {
                    markOneRead(n.id);
                    // 任務審核與兌換訂單都在審核頁處理（review.tsx 同頁列出兩區），
                    // 該頁沒有 tab/section 參數可帶，直接導到頁面即可。
                    router.push('/parent/(tabs)/review');
                  }}
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
