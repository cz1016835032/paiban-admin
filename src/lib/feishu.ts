/**
 * Feishu (Lark) Messaging Utility Wrapper
 */
export async function sendFeishuMessage(userIds: string[], message: string, card?: any) {
  // MOCK: Replace with actual Feishu API calls (TenantAccessToken, webhook, etc.)
  console.log(`[Feishu] Sending to ${userIds.join(', ')}:`, message);
}

export const createScheduleCard = (month: string, status: string) => ({
  header: {
    title: {
      content: `${month} 排班系统通知`,
      tag: 'plain_text',
    },
  },
  elements: [
    {
      tag: 'div',
      text: {
        content: `当前阶段: **${status}**\n请点击下方按钮进入系统处理。`,
        tag: 'lark_md',
      },
    },
    {
      actions: [
        {
          tag: 'button',
          text: {
            content: '进入系统',
            tag: 'plain_text',
          },
          url: 'https://your-domain.com/dashboard',
          type: 'primary',
        },
      ],
      tag: 'action',
    },
  ],
});
