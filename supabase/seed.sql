-- =====================================================================
--  Seed: Sluggish (first café)
--  Run once after schema.sql. If Sluggish already exists, nothing changes.
--  The menu is a placeholder until the real one arrives.
-- =====================================================================

do $seed$
declare
  v_cafe uuid;
  v_coffee uuid;
  v_iced uuid;
  v_sweets uuid;
  v_pets uuid;
begin
  if exists (select 1 from public.cafes where slug = 'sluggish') then
    raise notice 'Sluggish already exists, skipping seed.';
    return;
  end if;

  insert into public.cafes (
    slug, name_en, name_ar, tagline_en, tagline_ar, about_en, about_ar,
    logo_url, logo_alt_url, color_primary, color_background, color_accent, font_family,
    address_en, address_ar, phone, whatsapp, instagram_url, talabat_url, maps_url,
    hours, site, loyalty_enabled, loyalty_stamps_required, loyalty_reward_en, loyalty_reward_ar
  ) values (
    'sluggish',
    'Sluggish',
    'Sluggish',
    'Pet-friendly specialty café in Ras Salmiya.',
    'مقهى قهوة مختصة يرحّب بالحيوانات الأليفة في رأس السالمية.',
    'Specialty coffee, good books and resident cats. Bring your pet and take it slow.',
    'قهوة مختصة، كتب حلوة، وقطط تعيش معنا. جيبوا حيواناتكم الأليفة وخذوها على مهل.',
    '/assets/cafes/sluggish/logo-white.png',
    '/assets/cafes/sluggish/logo-navy.png',
    '#1A1E3D', '#F6F2EA', '#FFFFFF', 'Londrina Solid',
    'Blue Bay Building, Street 104, Ras Salmiya',
    'مبنى بلو باي، شارع 104، رأس السالمية',
    '+965 6651 0916',
    null,
    'https://www.instagram.com/sluggish.kw/',
    null,
    'https://www.google.com/maps/search/?api=1&query=Sluggish%20Salmiya%20Kuwait&query_place_id=ChIJSfjaJ5Kdzz8RD_EbVSCs0tg',
    '{
      "0": {"open": "06:00", "close": "22:00"},
      "1": {"open": "06:00", "close": "22:00"},
      "2": {"open": "06:00", "close": "22:00"},
      "3": {"open": "06:00", "close": "22:00"},
      "4": {"open": "06:00", "close": "22:00"},
      "5": {"open": "08:00", "close": "22:00"},
      "6": {"open": "06:00", "close": "22:00"}
    }'::jsonb,
    $site${
      "hero": {
        "title_en": ["Slow coffee.", "Sleepy cats."],
        "title_ar": ["قهوة على مهل.", "قطط نعسانة."],
        "chips_en": ["Specialty coffee", "Pets welcome", "Books", "Resident cats"],
        "chips_ar": ["قهوة مختصة", "الحيوانات الأليفة مرحّب بها", "كتب", "قطط تعيش معنا"]
      },
      "marquee_en": ["Take it slow", "Slow coffee", "Sleepy cats", "Good books", "Pets welcome"],
      "marquee_ar": ["خذها على مهل", "قهوة على مهل", "قطط نعسانة", "كتب حلوة", "حيواناتكم مرحّب بها"],
      "menu": {
        "eyebrow_en": "Menu", "eyebrow_ar": "المنيو",
        "title_en": "Our favourites", "title_ar": "المفضّلة عندنا"
      },
      "sections": [
        {
          "type": "lists", "style": "dark", "anchor": "cats",
          "nav_en": "Cats & Pets", "nav_ar": "القطط والحيوانات",
          "eyebrow_en": "Cats & Pets", "eyebrow_ar": "القطط والحيوانات الأليفة",
          "title_en": "Bring your best friend", "title_ar": "جيب رفيقك معك",
          "boxes": [
            {
              "title_en": "Our cats", "title_ar": "قططنا",
              "items_en": ["Let sleeping cats lie", "Gentle pets only", "No snacks for the cats"],
              "items_ar": ["خلّوا القطط النايمة ترتاح", "المداعبة بلطف فقط", "ممنوع إطعام القطط"]
            },
            {
              "title_en": "Your pets", "title_ar": "حيواناتكم",
              "items_en": ["Dogs on a lead", "Cats in a carrier", "Give our cats space"],
              "items_ar": ["الكلاب بالمقود", "القطط داخل الحقيبة", "اتركوا مساحة لقططنا"]
            }
          ]
        },
        {
          "type": "callout", "image": "logo_alt",
          "title_en": "Help local rescues", "title_ar": "ساعدوا جمعيات الإنقاذ",
          "text_en": "Drop pet food or supplies in our donation basket.",
          "text_ar": "اتركوا أكل أو مستلزمات للحيوانات في سلة التبرعات عندنا.",
          "chips_en": ["Food", "Blankets", "Supplies"],
          "chips_ar": ["أكل", "بطانيات", "مستلزمات"]
        }
      ],
      "visit": {
        "eyebrow_en": "Visit", "eyebrow_ar": "زورونا",
        "title_en": "Come slow down", "title_ar": "تعال وخذها على مهل"
      },
      "footer": {
        "slogan_en": "Take it slow", "slogan_ar": "خذها على مهل",
        "line_en": "Pet-friendly specialty coffee · Ras Salmiya, Kuwait",
        "line_ar": "قهوة مختصة ترحّب بالحيوانات الأليفة · رأس السالمية، الكويت"
      },
      "decor": {"crawler": "slug", "drips": true}
    }$site$::jsonb,
    true, 9, 'Free drink', 'مشروب مجاني'
  ) returning id into v_cafe;

  insert into public.categories (cafe_id, name_en, name_ar, icon, sort_order)
  values (v_cafe, 'Coffee', 'قهوة', 'cup', 1) returning id into v_coffee;
  insert into public.categories (cafe_id, name_en, name_ar, icon, sort_order)
  values (v_cafe, 'Iced drinks', 'مشروبات باردة', 'iced', 2) returning id into v_iced;
  insert into public.categories (cafe_id, name_en, name_ar, icon, sort_order)
  values (v_cafe, 'Desserts', 'حلويات', 'dessert', 3) returning id into v_sweets;
  insert into public.categories (cafe_id, name_en, name_ar, icon, sort_order)
  values (v_cafe, 'Pet treats', 'سناكات للحيوانات', 'paw', 4) returning id into v_pets;

  insert into public.items (cafe_id, category_id, name_en, name_ar, description_en, description_ar, price, is_featured, is_sold_out, sort_order) values
    (v_cafe, v_coffee, 'Espresso',        'إسبريسو',        'Double shot, bright and bold',   'شوت مزدوج، طعم قوي ومنعش',     1.000, false, false, 1),
    (v_cafe, v_coffee, 'Americano',       'أمريكانو',        'Espresso and hot water',         'إسبريسو مع ماي حار',            1.250, false, false, 2),
    (v_cafe, v_coffee, 'Flat White',      'فلات وايت',       'Velvety milk, double shot',      'حليب ناعم مع شوت مزدوج',        1.500, false, false, 3),
    (v_cafe, v_coffee, 'Spanish Latte',   'سبانش لاتيه',     'Sweet, creamy, a local favourite','حلو وكريمي، المفضّل عند الكل', 1.750, false, false, 4),
    (v_cafe, v_coffee, 'Filter Coffee',   'قهوة مقطّرة',     'Brewed by hand',                 'محضّرة يدويًا',                 1.750, true,  false, 5),
    (v_cafe, v_iced,   'Cold Brew',       'كولد برو',        'Smooth and strong',              'ناعمة وقوية',                   1.750, true,  false, 1),
    (v_cafe, v_iced,   'Iced Latte',      'آيس لاتيه',       'Espresso over cold milk',        'إسبريسو على حليب بارد',         1.750, false, false, 2),
    (v_cafe, v_iced,   'Iced Spanish Latte','آيس سبانش لاتيه','The favourite, on ice',         'المفضّل، بس بارد',              2.000, false, false, 3),
    (v_cafe, v_iced,   'Ube Matcha',      'أوبي ماتشا',      'Ube meets matcha',               'الأوبي يلتقي بالماتشا',          2.250, true,  false, 4),
    (v_cafe, v_sweets, 'Brownies',        'براونيز',         'Rich and gooey',                 'غنية وطرية',                    1.250, true,  false, 1),
    (v_cafe, v_sweets, 'Oh Fudge Balls',  'كرات الفدج',      'Fudgy protein bites',            'لقمات فدج بالبروتين',            1.500, true,  false, 2),
    (v_cafe, v_sweets, 'Cookie',          'كوكيز',           'Baked fresh every morning',      'ينخبز طازج كل صباح',            0.750, false, false, 3),
    (v_cafe, v_sweets, 'Basque Cheesecake','تشيزكيك باسك',   'Burnt top, creamy middle',       'وجه محروق وقلب كريمي',          2.000, false, true,  4),
    (v_cafe, v_pets,   'Pup Cup',         'كوب الجراء',      'A little whipped cream for your dog', 'شوية كريمة مخفوقة لكلبك',  0.500, false, false, 1),
    (v_cafe, v_pets,   'Dog Biscuits',    'بسكويت للكلاب',   'Crunchy, dog-safe ingredients',  'مقرمش ومكوّناته آمنة للكلاب',   0.750, false, false, 2),
    (v_cafe, v_pets,   'Cat Treats',      'سناك للقطط',      'For your cat, not ours',         'لقطّتك، مو لقططنا',             0.750, false, false, 3);

  raise notice 'Seeded Sluggish (%).', v_cafe;
end;
$seed$;
