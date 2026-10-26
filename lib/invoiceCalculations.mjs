const roundMoney = value => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round((numeric + Number.EPSILON) * 100) / 100 : 0;
};

export const formatInvoiceMoney = value => roundMoney(value).toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const calculateInvoiceAmounts = (items, discountAmount, isTaxInclusive) => {
  const subtotal = roundMoney((items || []).reduce((sum, item) => sum + roundMoney(item?.total), 0));
  const discount = roundMoney(Math.min(subtotal, Math.max(0, Number(discountAmount) || 0)));
  const taxableAmount = roundMoney(Math.max(0, subtotal - discount));
  const baseAmount = isTaxInclusive === false
    ? taxableAmount
    : roundMoney(taxableAmount / 1.15);
  const taxAmount = isTaxInclusive === false
    ? roundMoney(baseAmount * 0.15)
    : roundMoney(taxableAmount - baseAmount);
  const grandTotal = isTaxInclusive === false
    ? roundMoney(baseAmount + taxAmount)
    : taxableAmount;

  return { subtotal, discount, taxableAmount, baseAmount, taxAmount, grandTotal };
};

const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const hundreds = ['', 'مئة', 'مئتان', 'ثلاثمئة', 'أربعمئة', 'خمسمئة', 'ستمئة', 'سبعمئة', 'ثمانمئة', 'تسعمئة'];

function underThousand(number, feminine = false) {
  const parts = [];
  const unitWords = feminine ? ['', 'واحدة', 'اثنتان', 'ثلاث', 'أربع', 'خمس', 'ست', 'سبع', 'ثمان', 'تسع'] : ones;
  const teenWords = feminine
    ? ['عشر', 'إحدى عشرة', 'اثنتا عشرة', 'ثلاث عشرة', 'أربع عشرة', 'خمس عشرة', 'ست عشرة', 'سبع عشرة', 'ثماني عشرة', 'تسع عشرة']
    : teens;
  const hundred = Math.floor(number / 100);
  const remainder = number % 100;
  if (hundred) parts.push(hundreds[hundred]);
  if (remainder >= 10 && remainder < 20) parts.push(teenWords[remainder - 10]);
  else if (remainder >= 20) {
    const unit = remainder % 10;
    if (unit) parts.push(unitWords[unit]);
    parts.push(tens[Math.floor(remainder / 10)]);
  } else if (remainder > 0) parts.push(unitWords[remainder]);
  return parts.join(' و ');
}

const scales = [
  { singular: 'ألف', dual: 'ألفان', few: 'آلاف', many: 'ألفاً' },
  { singular: 'مليون', dual: 'مليونان', few: 'ملايين', many: 'مليوناً' },
  { singular: 'مليار', dual: 'ملياران', few: 'مليارات', many: 'ملياراً' },
];

function integerWords(number, feminine = false) {
  if (number === 0) return 'صفر';
  const groups = [];
  let remaining = number;
  while (remaining > 0) {
    groups.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }
  if (groups.length > scales.length + 1) return String(number);

  const words = [];
  for (let index = groups.length - 1; index >= 0; index -= 1) {
    const group = groups[index];
    if (!group) continue;
    if (index === 0) words.push(underThousand(group, feminine));
    else {
      const scale = scales[index - 1];
      const scaleWord = group === 1 ? scale.singular
        : group === 2 ? scale.dual
          : group <= 10 ? `${underThousand(group)} ${scale.few}`
            : `${underThousand(group)} ${scale.many}`;
      words.push(scaleWord);
    }
  }
  return words.join(' و ');
}

function currencyUnitWords(number, singular, dual, few, many) {
  if (number === 0) return singular;
  const lastTwo = number % 100;
  if (number === 1) return singular;
  if (number === 2) return dual;
  if (lastTwo >= 3 && lastTwo <= 10) return few;
  return many;
}

export const amountInArabicWords = amount => {
  const safeAmount = Math.max(0, roundMoney(amount));
  const totalHalalas = Math.round(safeAmount * 100);
  const riyals = Math.floor(totalHalalas / 100);
  const halalas = totalHalalas % 100;
  const riyalUnit = riyals % 1000 === 0 ? 'ريال' : currencyUnitWords(riyals, 'ريال واحد', 'ريالان', 'ريالات', 'ريالاً');
  let result = riyals === 0 ? 'صفر ريال'
    : riyals === 1 ? 'ريال واحد'
      : riyals === 2 ? 'ريالان'
        : `${integerWords(riyals)} ${riyalUnit}`;
  if (halalas > 0) {
    const halalaUnit = currencyUnitWords(halalas, 'هللة واحدة', 'هللتان', 'هللات', 'هللة');
    result += ` و ${halalas === 1 || halalas === 2 ? halalaUnit : `${integerWords(halalas, true)} ${halalaUnit}`}`;
  }
  return `${result} فقط لا غير`;
};
