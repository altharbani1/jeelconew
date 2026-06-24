
import { GoogleGenAI } from "@google/genai";

/**
 * خدمة توليد المواصفات الفنية باستخدام الذكاء الاصطناعي
 * يتم سحب مفتاح API حصرياً من متغير البيئة process.env.API_KEY
 */
export const generateTechnicalDescription = async (shortPrompt: string): Promise<string> => {
  try {
    const apiKey = process.env.API_KEY;

    if (!apiKey) {
      return "⚠️ خطأ: مفتاح الـ API غير معرف. يرجى التأكد من إضافته في إعدادات Vercel باسم API_KEY.";
    }

    // إنشاء مثيل جديد للذكاء الاصطناعي عند كل طلب لضمان تحديث المفتاح
    const ai = new GoogleGenAI({ apiKey });
    
    // استخدام موديل Gemini 3 Flash للأداء الفائق والسرعة في المهام النصية
    const model = 'gemini-3-flash-preview';
    
    const prompt = `
      السياق: أنت مهندس فني خبير في شركة "جيلكو للمصاعد" (Jilco Elevators).
      المهمة: اكتب وصفاً فنياً مفصلاً واحترافياً باللغة العربية للبند التالي في عرض السعر: "${shortPrompt}".
      
      المتطلبات:
      - استخدم لغة هندسية دقيقة.
      - اجعل الوصف على شكل نقاط (Bulleted List).
      - ركز على معايير الجودة والسلامة (مثل المواصفات الأوروبية EN81).
      - لا تضف أي مقدمات مثل "بناءً على طلبك" أو "إليك الوصف"، ابدأ بالنقاط مباشرة.
      
      مثال للنتيجة المتوقعة:
      - ماكينة سحب إيطالية الصنع جيرليس عالية الكفاءة.
      - نظام توفير الطاقة المتطور مع هدوء تام أثناء التشغيل.
      - مطابقة لأعلى معايير السلامة والأمان العالمية.
    `;

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });

    // الوصول المباشر لخاصية text حسب التحديث الأخير لـ SDK
    return response.text ?? "تعذر توليد الوصف، حاول صياغة الطلب بشكل آخر.";

  } catch (error: any) {
    console.error("Gemini AI Error:", error);
    
    if (error.message?.includes("API_KEY_INVALID")) {
      return "❌ خطأ: مفتاح الـ API المستخدم غير صالح.";
    }
    
    return "⚠️ حدث خطأ أثناء الاتصال بمحرك الذكاء الاصطناعي. يرجى المحاولة لاحقاً.";
  }
};
