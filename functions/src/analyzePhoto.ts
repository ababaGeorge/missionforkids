import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import OpenAI from 'openai';

const openaiApiKey = defineSecret('OPENAI_API_KEY');

interface AnalyzeRequest {
  photoUrl: string;
  taskDescription?: string;
  // B1：若帶 submissionId，CF 會把 AI 判斷寫回該 submission（admin SDK，
  // 不需放寬 taskSubmissions 的 client 寫入規則）。僅限提交者本人。
  submissionId?: string;
}

/**
 * 把 AI 判斷寫回 taskSubmissions（限提交者本人）。失敗不阻斷主流程。
 */
async function writeBackAiResult(
  submissionId: string | undefined,
  callerUid: string,
  aiResult: string,
  confidence: number | null
): Promise<void> {
  if (!submissionId) return;
  try {
    const ref = admin.firestore().collection('taskSubmissions').doc(submissionId);
    const snap = await ref.get();
    if (!snap.exists || snap.data()?.submittedBy !== callerUid) return; // 只能標自己的提交
    await ref.update({ aiResult, aiConfidence: confidence });
  } catch (e) {
    logger.warn('writeBackAiResult failed (non-fatal)', { submissionId, err: String(e) });
  }
}

/**
 * AI Playground — 呼叫 OpenAI Vision API 分析照片
 * 回傳 AI 的判斷結果（pass / fail / uncertain）和回覆文字
 * 10 秒 timeout — 超時回傳 fallback 訊息
 */
export const analyzePhoto = onCall(
  {
    region: 'us-central1',
    secrets: [openaiApiKey],
    timeoutSeconds: 30,
  },
  async (request) => {
    // 驗證登入
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    const { photoUrl, taskDescription, submissionId } = request.data as AnalyzeRequest;
    const callerUid = request.auth.uid;

    if (!photoUrl) {
      throw new HttpsError('invalid-argument', 'photoUrl is required');
    }

    // Emulator 模式：OpenAI 無法存取 localhost 的 storage URL，回傳確定性 mock，
    // 讓 AI 審核流程在本機/雙模擬器 demo 可以跑完。production 不受影響。
    if (process.env.FUNCTIONS_EMULATOR === 'true') {
      const mock = {
        result: 'pass',
        messageZh: taskDescription
          ? `太棒了！看起來你完成了「${taskDescription}」，繼續保持！`
          : '我看到你的照片了，做得很好！',
        messageEn: 'Great job! Looks done to me!',
      };
      await writeBackAiResult(submissionId, callerUid, mock.result, 0.9);
      logger.info('AI analysis (emulator mock)', { userId: callerUid, submissionId });
      return mock;
    }

    const openai = new OpenAI({ apiKey: openaiApiKey.value() });

    const prompt = taskDescription
      ? `You are a friendly AI assistant for a children's task app. A child has submitted a photo as proof of completing this task: "${taskDescription}". Look at the photo and determine if the task appears to be completed. Respond in JSON format: {"result": "pass" | "fail" | "uncertain", "message_zh": "<friendly message in Traditional Chinese>", "message_en": "<friendly message in English>"}. Be encouraging and kind — this is for kids aged 6+.`
      : `You are a friendly AI assistant for a children's task app. A child has submitted a photo. Describe what you see in a fun, encouraging way. Respond in JSON format: {"result": "uncertain", "message_zh": "<fun description in Traditional Chinese>", "message_en": "<fun description in English>"}. Be encouraging and kind — this is for kids aged 6+.`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const completion = await openai.chat.completions.create(
        {
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: photoUrl } },
              ],
            },
          ],
          max_tokens: 300,
          response_format: { type: 'json_object' },
        },
        { signal: controller.signal }
      );

      clearTimeout(timeout);

      const raw = completion.choices[0]?.message?.content || '{}';
      let parsed: { result?: string; message_zh?: string; message_en?: string };
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = { result: 'uncertain', message_zh: raw, message_en: raw };
      }

      const result = {
        result: parsed.result || 'uncertain',
        messageZh: parsed.message_zh || '我看到了你的照片！',
        messageEn: parsed.message_en || 'I see your photo!',
      };

      // 記錄到 aiPlaygroundLogs
      await admin.firestore().collection('aiPlaygroundLogs').add({
        userId: request.auth.uid,
        photoUrl,
        taskDescription: taskDescription || null,
        aiResult: result.result,
        messageZh: result.messageZh,
        messageEn: result.messageEn,
        model: 'gpt-4o-mini',
        createdAt: FieldValue.serverTimestamp(),
      });

      await writeBackAiResult(submissionId, callerUid, result.result, null);

      logger.info('AI analysis complete', {
        userId: request.auth.uid,
        result: result.result,
      });

      return result;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        logger.warn('AI analysis timeout', { userId: request.auth.uid });
        return {
          result: 'timeout',
          messageZh: 'AI 想太久了，晚點再試',
          messageEn: 'AI took too long, try again later',
        };
      }

      logger.error('AI analysis failed', { error: error.message });
      throw new HttpsError('internal', 'AI analysis failed');
    }
  }
);
