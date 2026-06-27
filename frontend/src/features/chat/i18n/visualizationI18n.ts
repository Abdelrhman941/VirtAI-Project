export type Locale = 'en' | 'ar';

export const VISUALIZATION_I18N = {
  en: {
    visualize: "Visualize",
    generating: "Generating...",
    quota_exceeded: "Visualization quota exceeded. Please try again later.",
    timeout: "Visualization service timed out. Please try again.",
    not_configured: "Visualization service is not configured.",
    unknown_format: "Visualization service returned an unknown format.",
    api_error: "Visualization API returned an error.",
    request_failed: "Visualization request failed to reach the server.",
    missing_image_url: "Visualization generation succeeded but returned no image.",
    generation_failed: "Visualization generation failed.",
    unknown_error: "An unknown error occurred during visualization.",
  },
  ar: {
    visualize: "تصوير مرئي",
    generating: "جاري الإنشاء...",
    quota_exceeded: "تم تجاوز حصة التخيل. يرجى المحاولة مرة أخرى لاحقًا.",
    timeout: "انتهت مهلة خدمة التخيل. يرجى المحاولة مرة أخرى.",
    not_configured: "لم يتم تكوين خدمة التخيل.",
    unknown_format: "أعادت خدمة التخيل تنسيقًا غير معروف.",
    api_error: "أعادت واجهة برمجة تطبيقات التخيل خطأ.",
    request_failed: "فشل طلب التخيل في الوصول إلى الخادم.",
    missing_image_url: "نجح إنشاء التخيل ولكنه لم يُرجع أي صورة.",
    generation_failed: "فشل إنشاء التخيل.",
    unknown_error: "حدث خطأ غير معروف أثناء التخيل.",
  }
};

export function getVisualizationTranslations(locale: Locale = 'en') {
  return VISUALIZATION_I18N[locale] || VISUALIZATION_I18N.en;
}
