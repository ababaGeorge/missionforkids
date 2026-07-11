import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';
import { rolloverRecurringTasks } from './lib/recurrence';

/**
 * 週期任務自動結算 / 建立下一期。
 * 每日執行（Asia/Taipei）：把過期的週期任務結算，並建立下一期 instance。
 * 核心邏輯在 lib/recurrence.ts（可用 emulator 單元測試；scheduler 本身 emulator 不觸發）。
 */
export const rolloverRecurringTasksScheduled = onSchedule(
  { schedule: 'every day 00:10', timeZone: 'Asia/Taipei' },
  async () => {
    const { created, missed } = await rolloverRecurringTasks(
      admin.firestore(),
      new Date()
    );
    logger.info('Recurring tasks rollover complete', { created, missed });
  }
);
