type AnalyticsEvent =
  | 'project_view'
  | 'project_click'
  | 'portfolio_click'
  | 'resume_download'
  | 'contact_open'
  | 'email_copy'
  | 'wechat_open'
  | 'not_found_feedback_click';

declare global {
  interface Window {
    umami?: { track: (event: AnalyticsEvent, data?: { slug: string }) => Promise<unknown> };
  }
}

export function track(event: AnalyticsEvent, slug?: string) {
  try {
    void window.umami?.track(event, slug ? { slug } : undefined).catch(() => {});
  } catch {
    // Analytics must never interrupt an interaction.
  }
}
