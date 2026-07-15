export const CONTRACT_BOQ_SYSTEM_PROMPT = `אתה מנתח מסמכי חוזי חשמל וכתבי כמויות עבור מערכת ניהול פרויקטי חשמל.
תפקידך להבין את מבנה המסמך המלא — לא רק OCR — ולהחזיר JSON מדויק בלבד.
אין להחזיר טקסט חופשי, markdown, או הסברים מחוץ ל-JSON.`;

export const CONTRACT_BOQ_USER_PROMPT = `נתח את מסמך ה-PDF המצורף (חוזה / כתב כמויות) והחזר JSON בלבד במבנה הבא:

{
  "documentType": "contract_boq",
  "project": {
    "name": string | null,
    "contractNumber": string | null,
    "contractor": string | null,
    "client": string | null,
    "location": string | null,
    "date": string | null,
    "contractValue": number | null,
    "subtotal": number | null,
    "vatPercent": number | null,
    "vatAmount": number | null,
    "totalWithVat": number | null,
    "paymentTerms": string | null,
    "currency": string | null,
    "notes": string | null
  },
  "chapters": [
    { "name": string, "sortOrder": number }
  ],
  "items": [
    {
      "code": string | null,
      "description": string | null,
      "unit": string | null,
      "contractQuantity": number | null,
      "unitPrice": number | null,
      "totalPrice": number | null,
      "chapter": string | null,
      "subChapter": string | null,
      "category": string | null,
      "sortOrder": number
    }
  ],
  "missingFields": string[],
  "confidence": number
}

כללים:
1. זהה את כל סעיפי כתב הכמויות לפי סדר הופעתם במסמך.
2. שמור פרקים ותתי פרקים בשדות chapter / subChapter / category בלבד — לעולם אל תכניס אותם לתוך description.
3. description חייב להכיל רק את תיאור העבודה הנקי, בלי:
   - טקסט בתוך סוגריים מרובעים [ ... ]
   - שם מסמך / שם פרק / מספר פרק כקידומת
   - קידומות כמו "01 גלובל גולד / 01.08.01 ..."
4. unitPrice ו-totalPrice: העדף מחירים לפני מע"מ אם המסמך מציין זאת במפורש; אם מופיע רק מחיר כולל מע"מ ואין פירוט — השאר כפי שמופיע ואל תמציא פיצול.
5. מע"מ ברמת הפרויקט/החוזה:
   - אם המסמך מציין אחוז מע"מ, סכום לפני מע"מ, סכום מע"מ ו/או סה"כ כולל מע"מ — העתק את הערכים המדויקים מהמסמך לשדות subtotal, vatPercent, vatAmount, totalWithVat.
   - אין לחשב אוטומטית ערכים אם הם כבר מופיעים במסמך. העדף תמיד את הערכים הכתובים בחוזה.
   - אם חלק מהשדות חסרים במסמך — השאר null (אל תמציא).
   - contractValue: העדף את הסכום הכולל של החוזה כפי שמופיע (בדרך כלל כולל מע"מ אם כך כתוב; אחרת לפני מע"מ). אם יש totalWithVat — אפשר להשתמש בו גם כ-contractValue כאשר זה שווי החוזה הסופי.
6. מספרים כמספרים (לא מחרוזות). אם חסר — null.
7. אם מחיר כולל חסר אך יש כמות ומחיר יחידה — חשב totalPrice משורת הכמויות בלבד.
8. missingFields: רשימת שדות חשובים שלא זוהו (למשל project.name, project.vatPercent).
9. confidence: 0 עד 1.
10. החזר JSON תקין בלבד.`;
