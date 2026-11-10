import type {
  ApiErrorCode,
  Dialect,
  Length,
  RefineAction,
  Tone,
  WriteType,
} from "./shared/types";

export type Lang = "ar" | "en";

interface TypeCopy {
  label: string;
  hint: string;
  placeholder: string;
  examples: string[];
}

export interface Strings {
  brand: string;
  tagline: string;
  nav: { write: string; saved: string; business: string };
  switchLang: string;
  switchLangLabel: string;
  themeToDark: string;
  themeToLight: string;

  write: {
    title: string;
    deck: string;
    stepType: string;
    stepDialect: string;
    stepTone: string;
    stepLength: string;
    stepBrief: string;
    briefHelp: string;
    examples: string;
    submit: string;
    submitting: string;
    emptyBrief: string;
    writingFor: (name: string) => string;
    editProfile: string;
    noProfile: string;
    setupProfile: string;
  };

  results: {
    title: string;
    back: string;
    resume: string;
    again: string;
    variant: (n: number) => string;
    chars: (n: number) => string;
    copy: string;
    copied: string;
    save: string;
    saved: string;
    refineLabel: string;
    undo: string;
    editHint: string;
    editNote: string;
    yourBrief: string;
    writing: (dialect: Dialect) => string;
    refining: string;
    emptyTitle: string;
    emptyBody: string;
    emptySampleLabel: string;
    emptySample: string;
  };

  errors: {
    title: string;
    retry: string;
    refineFailed: string;
    byCode: Record<ApiErrorCode, string>;
  };

  history: {
    title: string;
    deck: (n: number) => string;
    search: string;
    today: string;
    yesterday: string;
    copy: string;
    copied: string;
    remove: string;
    confirmRemove: string;
    emptyTitle: string;
    emptyBody: string;
    emptyCta: string;
    noMatch: (q: string) => string;
    clearSearch: string;
    editedSaved: string;
  };

  business: {
    title: string;
    deck: string;
    sectionAbout: string;
    sectionVoice: string;
    name: string;
    namePh: string;
    sells: string;
    sellsPh: string;
    area: string;
    areaPh: string;
    always: string;
    alwaysHelp: string;
    alwaysPh: string;
    never: string;
    neverHelp: string;
    neverPh: string;
    add: string;
    removeTag: (t: string) => string;
    savedLocally: string;
    clear: string;
    confirmClear: string;
    done: string;
  };

  types: Record<WriteType, TypeCopy>;
  dialects: Record<Dialect, string>;
  tones: Record<Tone, string>;
  lengths: Record<Length, string>;
  refine: (action: RefineAction, dialect: Dialect) => string;
  dateLocale: string;
  digits: (n: number | string) => string;
}

const toArabicDigits = (n: number | string) =>
  String(n).replace(/[0-9]/g, (d) => "٠١٢٣٤٥٦٧٨٩"[Number(d)]);

const arDialectIn: Record<Dialect, string> = {
  kuwaiti: "باللهجة الكويتية",
  saudi: "باللهجة السعودية",
  emirati: "باللهجة الإماراتية",
  qatari: "باللهجة القطرية",
  bahraini: "باللهجة البحرينية",
  formal: "بالفصحى",
};

const enDialectIn: Record<Dialect, string> = {
  kuwaiti: "in Kuwaiti",
  saudi: "in Saudi",
  emirati: "in Emirati",
  qatari: "in Qatari",
  bahraini: "in Bahraini",
  formal: "in formal Arabic",
};

const ar: Strings = {
  brand: "لهجة",
  tagline: "كلام تسويقي بلهجتك",
  nav: { write: "اكتب", saved: "المحفوظات", business: "مشروعي" },
  switchLang: "EN",
  switchLangLabel: "Switch to English",
  themeToDark: "الوضع الليلي",
  themeToLight: "الوضع النهاري",

  write: {
    title: "شنو نكتب لك اليوم؟",
    deck: "اختار النوع واللهجة، قول لنا عن شنو، وخذ ٣ نسخ جاهزة للنشر.",
    stepType: "شنو تبي تكتب؟",
    stepDialect: "اللهجة",
    stepTone: "الأسلوب",
    stepLength: "الطول",
    stepBrief: "عن شنو؟",
    briefHelp: "سطر واحد يكفي. السعر والمدة والمكان تفرق وايد.",
    examples: "أمثلة",
    submit: "اكتب",
    submitting: "قاعدين نكتب…",
    emptyBrief: "اكتب لنا شي عن الموضوع، حتى لو كلمتين.",
    writingFor: (name) => `نكتب باسم ${name}`,
    editProfile: "تعديل",
    noProfile: "عرّفنا على مشروعك عشان الكلام يطلع باسمك.",
    setupProfile: "عرّفنا",
  },

  results: {
    title: "اختار اللي يعجبك",
    back: "عدّل الطلب",
    resume: "ارجع لآخر نسخ",
    again: "اكتب ٣ غيرها",
    variant: (n) => `نسخة ${toArabicDigits(n)}`,
    chars: (n) => `${toArabicDigits(n)} حرف`,
    copy: "نسخ",
    copied: "تم النسخ",
    save: "حفظ",
    saved: "محفوظ",
    refineLabel: "عدّل هالنسخة",
    undo: "رجّع اللي قبل",
    editHint: "تقدر تعدل على النص قبل لا تنسخه",
    editNote: "اضغط على أي نص وعدّل عليه قبل لا تنسخه.",
    yourBrief: "طلبك",
    writing: (d) => `قاعدين نكتب ٣ نسخ ${arDialectIn[d]}…`,
    refining: "قاعدين نعدّل…",
    emptyTitle: "النسخ تطلع هني",
    emptyBody:
      "اختار اللي تبيه واضغط «اكتب». بنعطيك ٣ نسخ مختلفة، تعدل عليها وتنسخها على طول.",
    emptySampleLabel: "مثال",
    emptySample:
      "لاتيه الفستق وصل 💚\nكريمي، مو حالي وايد، وطعم الفستق واضح من أول رشفة.\nبـ 1.5 د.ك وهالأسبوع بس، لا يفوتكم.",
  },

  errors: {
    title: "ما ضبطت هالمرة",
    retry: "جرّب مرة ثانية",
    refineFailed: "ما قدرنا نعدّلها. جرّب مرة ثانية.",
    byCode: {
      empty_brief: "اكتب لنا شي عن الموضوع، حتى لو كلمتين.",
      bad_request: "في شي ناقص في الطلب. حدّث الصفحة وجرّب مرة ثانية.",
      config: "الخدمة مو مضبوطة للحين (مفتاح الـ API ناقص أو غلط). كلّم اللي ركّب الموقع.",
      rate_limited: "في ضغط الحين. انطر دقيقة وجرّب مرة ثانية.",
      refused: "ما نقدر نكتب عن هالموضوع. جرّب تصيغه بطريقة ثانية.",
      timeout: "طوّلنا وايد. جرّب مرة ثانية، وإذا تكرر اختار طول أقصر.",
      upstream: "صار خطأ من صوبنا. جرّب مرة ثانية بعد شوي.",
      bad_output: "طلع الكلام مو مضبوط. جرّب مرة ثانية.",
      network: "شكل النت طافي عندك. تأكد من الاتصال وجرّب مرة ثانية.",
    },
  },

  history: {
    title: "المحفوظات",
    deck: (n) =>
      n === 0
        ? "كل نسخة تحفظها تطلع هني."
        : n === 1
          ? "نسخة وحدة محفوظة على جهازك."
          : n === 2
            ? "نسختين محفوظة على جهازك."
            : `${toArabicDigits(n)} ${n <= 10 ? "نسخ" : "نسخة"} محفوظة على جهازك.`,
    search: "دوّر في المحفوظات",
    today: "اليوم",
    yesterday: "أمس",
    copy: "نسخ",
    copied: "تم النسخ",
    remove: "حذف",
    confirmRemove: "متأكد؟",
    emptyTitle: "ما في شي محفوظ للحين",
    emptyBody:
      "لما تعجبك نسخة اضغط «حفظ» وبتلقاها هني، مرتبة حسب اليوم. كل شي ينحفظ على جهازك بس.",
    emptyCta: "اكتب أول نص",
    noMatch: (q) => `ما لقينا شي فيه «${q}».`,
    clearSearch: "امسح البحث",
    editedSaved: "انحفظ التعديل",
  },

  business: {
    title: "مشروعي",
    deck: "هالمعلومات تدخل في كل نص نكتبه لك. تنحفظ على جهازك بس، وما تطلع منه إلا وقت الكتابة.",
    sectionAbout: "عن المشروع",
    sectionVoice: "طريقة الكلام",
    name: "اسم المشروع",
    namePh: "مثلاً: قهوة نخلة",
    sells: "شنو تبيعون؟",
    sellsPh: "قهوة مختصة وكيك بيتي",
    area: "المنطقة",
    areaPh: "السالمية",
    always: "كلمات وعبارات نستخدمها دايماً",
    alwaysHelp: "شعاركم، طريقة ترحيبكم، أو اسم منتج مشهور عندكم.",
    alwaysPh: "حياكم الله",
    never: "كلمات لا تستخدمها أبداً",
    neverHelp: "كلمات ما تناسب مشروعكم أو تكرهونها.",
    neverPh: "رخيص",
    add: "إضافة",
    removeTag: (t) => `شيل «${t}»`,
    savedLocally: "محفوظ على جهازك",
    clear: "امسح معلومات المشروع",
    confirmClear: "متأكد؟ اضغط مرة ثانية",
    done: "خلصت، ودّني أكتب",
  },

  types: {
    caption: {
      label: "كابشن انستقرام",
      hint: "للبوست والريلز",
      placeholder: "مثلاً: لاتيه فستق جديد، 1.5 د.ك، هالأسبوع بس",
      examples: [
        "لاتيه فستق جديد، 1.5 د.ك، هالأسبوع بس",
        "افتتاح فرعنا الثاني في الخيران يوم الخميس",
        "كيكة الزعفران رجعت للمنيو بعد ما طلبتوها وايد",
      ],
    },
    product: {
      label: "وصف منتج",
      hint: "للمنيو والمتجر وطلبات",
      placeholder: "مثلاً: كوكيز شوكولاتة بلجيكية، حبة كبيرة، 750 فلس",
      examples: [
        "كوكيز شوكولاتة بلجيكية، حبة كبيرة، 750 فلس",
        "عباية كريب سودا بتطريز يدوي على الكم، من S إلى XL",
      ],
    },
    broadcast: {
      label: "برودكاست واتساب",
      hint: "عرض أو خبر لعملائك",
      placeholder: "مثلاً: خصم 20% على كل المنيو يوم الجمعة من 4 العصر",
      examples: [
        "خصم 20% على كل المنيو يوم الجمعة من 4 العصر",
        "وصلت تشكيلة العيد، أول 50 طلب توصيل مجاني",
      ],
    },
    reply: {
      label: "رد على زبون",
      hint: "استفسار أو طلب أو شكوى",
      placeholder: "الصق رسالة الزبون، وقول لنا شنو تبي ترد عليه",
      examples: [
        "زبونة تسأل إذا نوصل الجهراء. نعم، التوصيل 1 د.ك ويوصل خلال ساعة",
        "زبون يقول الطلب وصل ناقص قطعة. نعتذر ونرسلها اليوم ببلاش",
      ],
    },
    review: {
      label: "رد على تقييم قوقل",
      hint: "شكر، أو اعتذار محترم",
      placeholder: "الصق التقييم، وإذا تبي قول لنا شنو تبي توصل",
      examples: [
        "تقييم نجمتين: الطلب تأخر 45 دقيقة والقهوة وصلت باردة",
        "تقييم 5 نجوم من سارة: أحلى سان سباستيان أكلته بالكويت",
      ],
    },
    story: {
      label: "نص ستوري",
      hint: "كلمتين فوق الصورة",
      placeholder: "مثلاً: باقي 3 ساعات على نهاية العرض",
      examples: [
        "باقي 3 ساعات على نهاية العرض",
        "فتحنا الجلسة الخارجية والجو يجنن",
      ],
    },
  },
  dialects: {
    kuwaiti: "كويتي",
    saudi: "سعودي",
    emirati: "إماراتي",
    qatari: "قطري",
    bahraini: "بحريني",
    formal: "فصحى",
  },
  tones: {
    warm: "ودود",
    playful: "مرح",
    premium: "فخم",
    direct: "مباشر",
    funny: "يضحّك",
  },
  lengths: { short: "قصير", medium: "متوسط", long: "طويل" },
  refine: (action, dialect) => {
    switch (action) {
      case "more_dialect":
        return dialect === "formal" ? "أقرب للناس" : `${ar.dialects[dialect]} أكثر`;
      case "shorter":
        return "أقصر";
      case "add_emoji":
        return "زيد إيموجي";
      case "remove_emoji":
        return "بدون إيموجي";
      case "more_formal":
        return "رسمي أكثر";
      case "add_cta":
        return "زيد دعوة للطلب";
    }
  },
  dateLocale: "ar-KW",
  digits: toArabicDigits,
};

const en: Strings = {
  brand: "Lahja",
  tagline: "Gulf marketing copy that sounds like you",
  nav: { write: "Write", saved: "Saved", business: "My business" },
  switchLang: "عربي",
  switchLangLabel: "التبديل للعربي",
  themeToDark: "Dark mode",
  themeToLight: "Light mode",

  write: {
    title: "What are we writing today?",
    deck: "Pick a format and a dialect, tell us what it’s about, and get three drafts ready to post.",
    stepType: "What do you need?",
    stepDialect: "Dialect",
    stepTone: "Tone",
    stepLength: "Length",
    stepBrief: "What’s it about?",
    briefHelp: "One line is enough. Prices, dates and places make a big difference.",
    examples: "Examples",
    submit: "Write",
    submitting: "Writing…",
    emptyBrief: "Tell us what it’s about first. A few words is fine.",
    writingFor: (name) => `Writing as ${name}`,
    editProfile: "Edit",
    noProfile: "Tell us about your business so the copy sounds like yours.",
    setupProfile: "Set up",
  },

  results: {
    title: "Pick your favourite",
    back: "Edit request",
    resume: "Back to your latest drafts",
    again: "Write three more",
    variant: (n) => `Draft ${n}`,
    chars: (n) => `${n} characters`,
    copy: "Copy",
    copied: "Copied",
    save: "Save",
    saved: "Saved",
    refineLabel: "Adjust this draft",
    undo: "Undo",
    editHint: "You can edit the text before copying",
    editNote: "Tap any draft to edit it before you copy.",
    yourBrief: "Your brief",
    writing: (d) => `Writing three drafts ${enDialectIn[d]}…`,
    refining: "Rewriting…",
    emptyTitle: "Your drafts land here",
    emptyBody:
      "Make your picks and tap Write. You’ll get three different drafts to edit and copy straight away.",
    emptySampleLabel: "Example",
    emptySample:
      "لاتيه الفستق وصل 💚\nكريمي، مو حالي وايد، وطعم الفستق واضح من أول رشفة.\nبـ 1.5 د.ك وهالأسبوع بس، لا يفوتكم.",
  },

  errors: {
    title: "That didn’t work",
    retry: "Try again",
    refineFailed: "Couldn’t rewrite this one. Try again.",
    byCode: {
      empty_brief: "Tell us what it’s about first. A few words is fine.",
      bad_request: "Something in the request was off. Refresh and try again.",
      config: "The service isn’t set up yet (the API key is missing or wrong). Contact whoever runs this site.",
      rate_limited: "It’s busy right now. Give it a minute and try again.",
      refused: "We can’t write about that. Try phrasing the brief differently.",
      timeout: "That took too long. Try again, or pick a shorter length.",
      upstream: "Something went wrong on our side. Try again in a moment.",
      bad_output: "The result came back garbled. Try again.",
      network: "You seem to be offline. Check your connection and try again.",
    },
  },

  history: {
    title: "Saved",
    deck: (n) =>
      n === 0
        ? "Every draft you save shows up here."
        : `${n} saved ${n === 1 ? "draft" : "drafts"}, stored on this device.`,
    search: "Search saved drafts",
    today: "Today",
    yesterday: "Yesterday",
    copy: "Copy",
    copied: "Copied",
    remove: "Delete",
    confirmRemove: "Sure?",
    emptyTitle: "Nothing saved yet",
    emptyBody:
      "When you like a draft, tap Save and it lands here, grouped by day. Everything stays on this device.",
    emptyCta: "Write your first one",
    noMatch: (q) => `Nothing matches “${q}”.`,
    clearSearch: "Clear search",
    editedSaved: "Edit saved",
  },

  business: {
    title: "My business",
    deck: "This goes into everything we write for you. It’s stored on this device and only leaves it when you write.",
    sectionAbout: "About the business",
    sectionVoice: "Voice",
    name: "Business name",
    namePh: "e.g. Nakhla Coffee",
    sells: "What do you sell?",
    sellsPh: "Specialty coffee and homemade cakes",
    area: "Area",
    areaPh: "Salmiya",
    always: "Words and phrases to always use",
    alwaysHelp: "Your slogan, how you greet people, a signature product.",
    alwaysPh: "حياكم الله",
    never: "Words to never use",
    neverHelp: "Anything that doesn’t fit your brand.",
    neverPh: "cheap",
    add: "Add",
    removeTag: (t) => `Remove “${t}”`,
    savedLocally: "Saved on this device",
    clear: "Clear business details",
    confirmClear: "Sure? Tap again",
    done: "Done, take me to Write",
  },

  types: {
    caption: {
      label: "Instagram caption",
      hint: "Posts and reels",
      placeholder: "e.g. new pistachio latte, 1.5 KD, this week only",
      examples: [
        "New pistachio latte, 1.5 KD, this week only",
        "Opening our second branch in Khairan on Thursday",
      ],
    },
    product: {
      label: "Product description",
      hint: "Menu, store, delivery apps",
      placeholder: "e.g. Belgian chocolate cookie, large, 750 fils",
      examples: [
        "Belgian chocolate cookie, large, 750 fils",
        "Black crepe abaya with hand embroidery on the sleeves, S to XL",
      ],
    },
    broadcast: {
      label: "WhatsApp broadcast",
      hint: "Offers and news for your list",
      placeholder: "e.g. 20% off the whole menu on Friday from 4pm",
      examples: [
        "20% off the whole menu on Friday from 4pm",
        "Eid collection is in, free delivery for the first 50 orders",
      ],
    },
    reply: {
      label: "Reply to a customer",
      hint: "Questions, orders, complaints",
      placeholder: "Paste the customer’s message and tell us what you want to say",
      examples: [
        "Customer asks if we deliver to Jahra. Yes, 1 KD, arrives within an hour",
        "Customer says an item was missing. Apologise, we’ll send it today for free",
      ],
    },
    review: {
      label: "Reply to a Google review",
      hint: "Thank, or apologise well",
      placeholder: "Paste the review and, if you like, what you want to say",
      examples: [
        "2 stars: order was 45 minutes late and the coffee arrived cold",
        "5 stars from Sara: best San Sebastian she’s had in Kuwait",
      ],
    },
    story: {
      label: "Story text",
      hint: "A few words on a photo",
      placeholder: "e.g. 3 hours left on the offer",
      examples: ["3 hours left on the offer", "Outdoor seating is open, the weather is perfect"],
    },
  },
  dialects: {
    kuwaiti: "Kuwaiti",
    saudi: "Saudi",
    emirati: "Emirati",
    qatari: "Qatari",
    bahraini: "Bahraini",
    formal: "Formal",
  },
  tones: {
    warm: "Warm",
    playful: "Playful",
    premium: "Premium",
    direct: "Direct",
    funny: "Funny",
  },
  lengths: { short: "Short", medium: "Medium", long: "Long" },
  refine: (action, dialect) => {
    switch (action) {
      case "more_dialect":
        return dialect === "formal" ? "More conversational" : `More ${en.dialects[dialect]}`;
      case "shorter":
        return "Shorter";
      case "add_emoji":
        return "Add emoji";
      case "remove_emoji":
        return "Remove emoji";
      case "more_formal":
        return "More formal";
      case "add_cta":
        return "Add call to action";
    }
  },
  dateLocale: "en-GB",
  digits: (n) => String(n),
};

export const STRINGS: Record<Lang, Strings> = { ar, en };

export const AREAS = [
  "السالمية",
  "حولي",
  "الشويخ",
  "الجابرية",
  "الشعب",
  "الدسمة",
  "كيفان",
  "الشامية",
  "العديلية",
  "السرة",
  "مشرف",
  "بيان",
  "الرميثية",
  "صباح السالم",
  "الفروانية",
  "خيطان",
  "الجهراء",
  "الأحمدي",
  "الفحيحيل",
  "المنقف",
  "الخيران",
  "صبحان",
  "القيروان",
  "مدينة الكويت",
  "الرياض",
  "جدة",
  "الخبر",
  "دبي",
  "أبوظبي",
  "الدوحة",
  "المنامة",
];
