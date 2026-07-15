export const CONTRACT_BOQ_SYSTEM_PROMPT = `אתה מנתח מסמכי חוזי חשמל וכתבי כמויות עבור מערכת WEGO ELECTRIC.
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
2. שמור פרקים ותתי פרקים אם קיימים.
3. מספרים כמספרים (לא מחרוזות). אם חסר — null.
4. אם מחיר כולל חסר אך יש כמות ומחיר יחידה — חשב totalPrice.
5. missingFields: רשימת שדות חשובים שלא זוהו (למשל project.name, project.contractNumber).
6. confidence: 0 עד 1.
7. החזר JSON תקין בלבד.`;
