-- =====================================================================
--  Café platform: database schema for Supabase
--
--  Paste this whole file into Supabase > SQL Editor > New query > Run.
--  It's safe to run again after updates (it only adds or replaces).
--
--  Multi-tenant: every row belongs to a café (cafe_id), and Row Level
--  Security makes sure a café's staff can only see and change their own
--  rows. The public menu and website read data through a few functions
--  that only return what customers are allowed to see.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
--  Tables
-- ---------------------------------------------------------------------

create table if not exists public.cafes (
  id                      uuid primary key default gen_random_uuid(),
  slug                    text not null unique,
  is_active               boolean not null default true,

  name_en                 text not null,
  name_ar                 text not null default '',
  tagline_en              text not null default '',
  tagline_ar              text not null default '',
  about_en                text not null default '',
  about_ar                text not null default '',

  logo_url                text,             -- logo used on the brand color (e.g. white logo on navy)
  logo_alt_url            text,             -- logo used on light backgrounds
  color_primary           text not null default '#1A1E3D',
  color_background        text not null default '#F6F2EA',
  color_accent            text not null default '#FFFFFF',
  font_family             text not null default 'Londrina Solid',

  address_en              text not null default '',
  address_ar              text not null default '',
  phone                   text,             -- shown on the site, e.g. +965 6651 0916
  whatsapp                text,             -- digits with country code, e.g. 96566510916
  instagram_url           text,
  talabat_url             text,
  maps_url                text,

  -- Opening hours keyed by weekday (0 = Sunday ... 6 = Saturday).
  -- {"0": {"open": "06:00", "close": "22:00"}, ...}; a missing day means closed.
  -- A close time earlier than the open time means it closes after midnight.
  hours                   jsonb not null default '{}'::jsonb,

  -- Website sections (hero lines, chips, marquee, extra sections, footer).
  -- Shape is documented in README.md. Every text has _en and _ar versions.
  site                    jsonb not null default '{}'::jsonb,

  loyalty_enabled         boolean not null default true,
  loyalty_stamps_required integer not null default 9,
  loyalty_reward_en       text not null default 'Free drink',
  loyalty_reward_ar       text not null default 'مشروب مجاني',

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint cafes_slug_format check (slug ~ '^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$'),
  constraint cafes_slug_reserved check (slug not in (
    'admin', 'super', 'c', 'api', 'assets', 'css', 'js', 'vendor', 'fonts', 'img', 'images',
    'static', 'login', 'logout', 'signup', 'www', 'app', 'help', 'about', 'terms', 'privacy', 'sw', 'offline')),
  constraint cafes_colors check (
    color_primary ~ '^#[0-9A-Fa-f]{6}$' and color_background ~ '^#[0-9A-Fa-f]{6}$' and color_accent ~ '^#[0-9A-Fa-f]{6}$'),
  constraint cafes_font check (font_family ~ '^[A-Za-z0-9 ]{1,40}$'),
  constraint cafes_loyalty_rule check (loyalty_stamps_required between 2 and 30),
  constraint cafes_whatsapp check (whatsapp is null or whatsapp ~ '^[0-9]{8,15}$')
);

-- Who can manage a café. owner = full control, staff = loyalty stamps and sold-out toggles.
create table if not exists public.cafe_members (
  cafe_id    uuid not null references public.cafes (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null default 'owner' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now(),
  primary key (cafe_id, user_id)
);
create index if not exists cafe_members_user_idx on public.cafe_members (user_id);

-- Pending access: when someone signs up or logs in with this email, they get access.
create table if not exists public.cafe_invites (
  id         uuid primary key default gen_random_uuid(),
  cafe_id    uuid not null references public.cafes (id) on delete cascade,
  email      text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role       text not null default 'owner' check (role in ('owner', 'staff')),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (cafe_id, email)
);

-- Platform admins (you). Add yourself once from the SQL editor, see README.md.
create table if not exists public.super_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  cafe_id    uuid not null references public.cafes (id) on delete cascade,
  name_en    text not null,
  name_ar    text not null default '',
  icon       text not null default 'cup' check (icon in ('cup', 'iced', 'tea', 'dessert', 'food', 'paw', 'bottle', 'star')),
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, cafe_id)
);
create index if not exists categories_cafe_idx on public.categories (cafe_id, sort_order);

create table if not exists public.items (
  id             uuid primary key default gen_random_uuid(),
  cafe_id        uuid not null references public.cafes (id) on delete cascade,
  category_id    uuid not null,
  name_en        text not null,
  name_ar        text not null default '',
  description_en text not null default '',
  description_ar text not null default '',
  price          numeric(10, 3) not null default 0 check (price >= 0 and price < 1000),
  photo_url      text,
  is_sold_out    boolean not null default false,
  is_visible     boolean not null default true,
  is_featured    boolean not null default false,   -- shown in "Our favourites" on the website
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- An item's category must belong to the same café.
  foreign key (category_id, cafe_id) references public.categories (id, cafe_id) on delete cascade
);
create index if not exists items_cafe_idx on public.items (cafe_id, category_id, sort_order);

create table if not exists public.loyalty_customers (
  id               uuid primary key default gen_random_uuid(),
  cafe_id          uuid not null references public.cafes (id) on delete cascade,
  phone            text not null check (phone ~ '^[0-9]{8}$'),   -- Kuwait number without +965
  stamps           integer not null default 0 check (stamps >= 0),
  lifetime_stamps  integer not null default 0,
  rewards_redeemed integer not null default 0,
  joined_via       text not null default 'menu' check (joined_via in ('menu', 'staff')),
  created_at       timestamptz not null default now(),
  last_visit_at    timestamptz,
  unique (cafe_id, phone)
);
create index if not exists loyalty_customers_visit_idx on public.loyalty_customers (cafe_id, last_visit_at desc);

create table if not exists public.loyalty_events (
  id            bigint generated always as identity primary key,
  cafe_id       uuid not null references public.cafes (id) on delete cascade,
  customer_id   uuid not null references public.loyalty_customers (id) on delete cascade,
  kind          text not null check (kind in ('stamp', 'redeem', 'adjust')),
  stamps        integer not null,          -- +n for stamps, -n for a redeem or correction
  reward        text,                      -- what was given, for redeems
  staff_user_id uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists loyalty_events_cafe_idx on public.loyalty_events (cafe_id, created_at desc);
create index if not exists loyalty_events_customer_idx on public.loyalty_events (customer_id, created_at desc);

-- Simple daily counters (no third-party analytics).
create table if not exists public.page_views (
  cafe_id uuid not null references public.cafes (id) on delete cascade,
  day     date not null,
  page    text not null check (page in ('menu', 'site')),
  views   integer not null default 0,
  primary key (cafe_id, day, page)
);

-- ---------------------------------------------------------------------
--  Helper functions used by the security rules
-- ---------------------------------------------------------------------

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.super_admins where user_id = auth.uid());
$$;

create or replace function public.cafe_role(p_cafe uuid)
returns text language sql stable security definer set search_path = '' as $$
  select role from public.cafe_members where cafe_id = p_cafe and user_id = auth.uid();
$$;

create or replace function public.is_cafe_member(p_cafe uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_super_admin()
      or exists (select 1 from public.cafe_members where cafe_id = p_cafe and user_id = auth.uid());
$$;

create or replace function public.is_cafe_owner(p_cafe uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_super_admin()
      or exists (select 1 from public.cafe_members where cafe_id = p_cafe and user_id = auth.uid() and role = 'owner');
$$;

-- Storage paths look like "<cafe id>/<file>". Owners may write files under their café's folder only.
create or replace function public.can_write_cafe_file(p_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  v_folder text := split_part(p_name, '/', 1);
begin
  if v_folder !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  return public.is_cafe_owner(v_folder::uuid);
end;
$$;

-- "+965 6651-0916", "0096566510916", "66510916" -> "66510916". Returns null if it isn't a Kuwait number.
create or replace function public.normalize_kw_phone(p_phone text)
returns text language plpgsql immutable set search_path = '' as $$
declare
  v text := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
begin
  if length(v) = 13 and left(v, 5) = '00965' then v := substr(v, 6); end if;
  if length(v) = 11 and left(v, 3) = '965' then v := substr(v, 4); end if;
  if v ~ '^[24569][0-9]{7}$' then return v; end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------
--  Triggers
-- ---------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Café owners can edit their profile, but only the platform admin can change
-- the web address (slug) or switch a café on or off.
create or replace function public.guard_cafe_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and not public.is_super_admin() then
    if new.slug is distinct from old.slug then
      raise exception 'Only the platform admin can change the web address.' using errcode = '42501';
    end if;
    if new.is_active is distinct from old.is_active then
      raise exception 'Only the platform admin can turn a café on or off.' using errcode = '42501';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists cafes_guard on public.cafes;
create trigger cafes_guard before update on public.cafes
  for each row execute function public.guard_cafe_update();

drop trigger if exists categories_touch on public.categories;
create trigger categories_touch before update on public.categories
  for each row execute function public.touch_updated_at();

drop trigger if exists items_touch on public.items;
create trigger items_touch before update on public.items
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
--  Row Level Security
-- ---------------------------------------------------------------------

alter table public.cafes             enable row level security;
alter table public.cafe_members      enable row level security;
alter table public.cafe_invites      enable row level security;
alter table public.super_admins      enable row level security;
alter table public.categories        enable row level security;
alter table public.items             enable row level security;
alter table public.loyalty_customers enable row level security;
alter table public.loyalty_events    enable row level security;
alter table public.page_views        enable row level security;

-- Nobody but the database itself reaches these tables anonymously.
-- Customers read menus through public_cafe() and loyalty_check() below.

-- cafes
drop policy if exists cafes_select on public.cafes;
create policy cafes_select on public.cafes for select to authenticated
  using (public.is_cafe_member(id));
drop policy if exists cafes_insert on public.cafes;
create policy cafes_insert on public.cafes for insert to authenticated
  with check (public.is_super_admin());
drop policy if exists cafes_update on public.cafes;
create policy cafes_update on public.cafes for update to authenticated
  using (public.is_cafe_owner(id)) with check (public.is_cafe_owner(id));
drop policy if exists cafes_delete on public.cafes;
create policy cafes_delete on public.cafes for delete to authenticated
  using (public.is_super_admin());

-- cafe_members
drop policy if exists members_select on public.cafe_members;
create policy members_select on public.cafe_members for select to authenticated
  using (user_id = auth.uid() or public.is_cafe_owner(cafe_id));
drop policy if exists members_insert on public.cafe_members;
create policy members_insert on public.cafe_members for insert to authenticated
  with check (public.is_super_admin());
drop policy if exists members_update on public.cafe_members;
create policy members_update on public.cafe_members for update to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());
drop policy if exists members_delete on public.cafe_members;
create policy members_delete on public.cafe_members for delete to authenticated
  using (public.is_super_admin() or (role = 'staff' and public.is_cafe_owner(cafe_id)));

-- cafe_invites: owners can invite staff; the platform admin can invite anyone
drop policy if exists invites_select on public.cafe_invites;
create policy invites_select on public.cafe_invites for select to authenticated
  using (public.is_cafe_owner(cafe_id));
drop policy if exists invites_insert on public.cafe_invites;
create policy invites_insert on public.cafe_invites for insert to authenticated
  with check (public.is_super_admin() or (role = 'staff' and public.is_cafe_owner(cafe_id)));
drop policy if exists invites_delete on public.cafe_invites;
create policy invites_delete on public.cafe_invites for delete to authenticated
  using (public.is_cafe_owner(cafe_id));

-- super_admins: you can see that you are one; changes only from the SQL editor
drop policy if exists super_select on public.super_admins;
create policy super_select on public.super_admins for select to authenticated
  using (user_id = auth.uid());

-- categories
drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories for select to authenticated
  using (public.is_cafe_member(cafe_id));
drop policy if exists categories_insert on public.categories;
create policy categories_insert on public.categories for insert to authenticated
  with check (public.is_cafe_owner(cafe_id));
drop policy if exists categories_update on public.categories;
create policy categories_update on public.categories for update to authenticated
  using (public.is_cafe_owner(cafe_id)) with check (public.is_cafe_owner(cafe_id));
drop policy if exists categories_delete on public.categories;
create policy categories_delete on public.categories for delete to authenticated
  using (public.is_cafe_owner(cafe_id));

-- items
drop policy if exists items_select on public.items;
create policy items_select on public.items for select to authenticated
  using (public.is_cafe_member(cafe_id));
drop policy if exists items_insert on public.items;
create policy items_insert on public.items for insert to authenticated
  with check (public.is_cafe_owner(cafe_id));
drop policy if exists items_update on public.items;
create policy items_update on public.items for update to authenticated
  using (public.is_cafe_owner(cafe_id)) with check (public.is_cafe_owner(cafe_id));
drop policy if exists items_delete on public.items;
create policy items_delete on public.items for delete to authenticated
  using (public.is_cafe_owner(cafe_id));

-- loyalty: staff read; changes go through the loyalty_* functions; owners may delete a customer
drop policy if exists customers_select on public.loyalty_customers;
create policy customers_select on public.loyalty_customers for select to authenticated
  using (public.is_cafe_member(cafe_id));
drop policy if exists customers_delete on public.loyalty_customers;
create policy customers_delete on public.loyalty_customers for delete to authenticated
  using (public.is_cafe_owner(cafe_id));
drop policy if exists events_select on public.loyalty_events;
create policy events_select on public.loyalty_events for select to authenticated
  using (public.is_cafe_member(cafe_id));

-- page views: read by the café; written only by track_view()
drop policy if exists views_select on public.page_views;
create policy views_select on public.page_views for select to authenticated
  using (public.is_cafe_member(cafe_id));

-- ---------------------------------------------------------------------
--  Public functions (customers, no login)
-- ---------------------------------------------------------------------

-- Everything the café website and QR menu need, in one request.
create or replace function public.public_cafe(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  c public.cafes;
  v_menu jsonb;
  v_updated timestamptz;
begin
  select * into c from public.cafes where slug = lower(p_slug);
  if not found then
    return null;
  end if;
  if not c.is_active then
    return jsonb_build_object('cafe', jsonb_build_object(
      'slug', c.slug, 'name_en', c.name_en, 'name_ar', c.name_ar, 'active', false,
      'logo_url', c.logo_url, 'logo_alt_url', c.logo_alt_url,
      'colors', jsonb_build_object('primary', c.color_primary, 'background', c.color_background, 'accent', c.color_accent),
      'font_family', c.font_family));
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', cat.id, 'name_en', cat.name_en, 'name_ar', cat.name_ar, 'icon', cat.icon,
           'items', coalesce((
             select jsonb_agg(jsonb_build_object(
                      'id', i.id, 'name_en', i.name_en, 'name_ar', i.name_ar,
                      'description_en', i.description_en, 'description_ar', i.description_ar,
                      'price', i.price, 'photo_url', i.photo_url,
                      'sold_out', i.is_sold_out, 'featured', i.is_featured)
                    order by i.sort_order, i.created_at)
             from public.items i
             where i.category_id = cat.id and i.is_visible), '[]'::jsonb))
         order by cat.sort_order, cat.created_at), '[]'::jsonb)
    into v_menu
    from public.categories cat
   where cat.cafe_id = c.id and cat.is_visible;

  select greatest(c.updated_at,
                  (select max(updated_at) from public.categories where cafe_id = c.id),
                  (select max(updated_at) from public.items where cafe_id = c.id))
    into v_updated;

  return jsonb_build_object(
    'cafe', jsonb_build_object(
      'id', c.id, 'slug', c.slug, 'active', true,
      'name_en', c.name_en, 'name_ar', c.name_ar,
      'tagline_en', c.tagline_en, 'tagline_ar', c.tagline_ar,
      'about_en', c.about_en, 'about_ar', c.about_ar,
      'logo_url', c.logo_url, 'logo_alt_url', c.logo_alt_url,
      'colors', jsonb_build_object('primary', c.color_primary, 'background', c.color_background, 'accent', c.color_accent),
      'font_family', c.font_family,
      'address_en', c.address_en, 'address_ar', c.address_ar,
      'phone', c.phone, 'whatsapp', c.whatsapp,
      'instagram_url', c.instagram_url, 'talabat_url', c.talabat_url, 'maps_url', c.maps_url,
      'hours', c.hours, 'site', c.site,
      'loyalty', jsonb_build_object(
        'enabled', c.loyalty_enabled, 'required', c.loyalty_stamps_required,
        'reward_en', c.loyalty_reward_en, 'reward_ar', c.loyalty_reward_ar)),
    'categories', v_menu,
    'updated_at', v_updated);
end;
$$;

-- Counts a page view for today (Kuwait time).
create or replace function public.track_view(p_slug text, p_page text default 'menu')
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  v_cafe uuid;
begin
  if p_page not in ('menu', 'site') then return; end if;
  select id into v_cafe from public.cafes where slug = lower(p_slug) and is_active;
  if v_cafe is null then return; end if;
  insert into public.page_views (cafe_id, day, page, views)
  values (v_cafe, (now() at time zone 'Asia/Kuwait')::date, p_page, 1)
  on conflict (cafe_id, day, page) do update set views = public.page_views.views + 1;
end;
$$;

-- A customer checks their stamps by phone number. With p_join = true it also signs them up.
-- Returns only the stamp count and the café's rule, never other customers' data.
create or replace function public.loyalty_check(p_slug text, p_phone text, p_join boolean default false)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  c public.cafes;
  v_phone text := public.normalize_kw_phone(p_phone);
  v_cust public.loyalty_customers;
begin
  select * into c from public.cafes where slug = lower(p_slug) and is_active and loyalty_enabled;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'unavailable');
  end if;
  if v_phone is null then
    return jsonb_build_object('ok', false, 'error', 'invalid_phone');
  end if;

  select * into v_cust from public.loyalty_customers where cafe_id = c.id and phone = v_phone;
  if not found and p_join then
    insert into public.loyalty_customers (cafe_id, phone, joined_via)
    values (c.id, v_phone, 'menu')
    on conflict (cafe_id, phone) do nothing;
    select * into v_cust from public.loyalty_customers where cafe_id = c.id and phone = v_phone;
  end if;

  return jsonb_build_object(
    'ok', true,
    'member', v_cust.id is not null,
    'stamps', coalesce(v_cust.stamps, 0),
    'required', c.loyalty_stamps_required,
    'ready', coalesce(v_cust.stamps, 0) >= c.loyalty_stamps_required,
    'rewards_redeemed', coalesce(v_cust.rewards_redeemed, 0),
    'reward_en', c.loyalty_reward_en,
    'reward_ar', c.loyalty_reward_ar);
end;
$$;

-- ---------------------------------------------------------------------
--  Café staff functions (login required)
-- ---------------------------------------------------------------------

-- Add stamps for a customer (creates the customer if new). A full card stops
-- taking stamps: the extra ones are returned as "leftover" so staff can add them after redeeming.
create or replace function public.loyalty_add_stamp(p_cafe uuid, p_phone text, p_count integer default 1)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  c public.cafes;
  v_phone text := public.normalize_kw_phone(p_phone);
  v_cust public.loyalty_customers;
  v_add integer;
begin
  if not public.is_cafe_member(p_cafe) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  if v_phone is null then
    raise exception 'That is not a valid Kuwait phone number (8 digits).' using errcode = '22023';
  end if;
  if p_count is null or p_count < 1 or p_count > 10 then
    raise exception 'Add between 1 and 10 stamps at a time.' using errcode = '22023';
  end if;
  select * into c from public.cafes where id = p_cafe;
  if not c.loyalty_enabled then
    raise exception 'The loyalty card is switched off for this café.' using errcode = '22023';
  end if;

  insert into public.loyalty_customers (cafe_id, phone, joined_via)
  values (p_cafe, v_phone, 'staff')
  on conflict (cafe_id, phone) do nothing;

  select * into v_cust from public.loyalty_customers
   where cafe_id = p_cafe and phone = v_phone for update;

  v_add := greatest(0, least(p_count, c.loyalty_stamps_required - v_cust.stamps));

  update public.loyalty_customers
     set stamps = stamps + v_add,
         lifetime_stamps = lifetime_stamps + v_add,
         last_visit_at = now()
   where id = v_cust.id
  returning * into v_cust;

  if v_add > 0 then
    insert into public.loyalty_events (cafe_id, customer_id, kind, stamps, staff_user_id)
    values (p_cafe, v_cust.id, 'stamp', v_add, auth.uid());
  end if;

  return jsonb_build_object(
    'customer_id', v_cust.id, 'phone', v_cust.phone,
    'stamps', v_cust.stamps, 'required', c.loyalty_stamps_required,
    'added', v_add, 'leftover', p_count - v_add,
    'ready', v_cust.stamps >= c.loyalty_stamps_required);
end;
$$;

-- Give the reward: resets the card to zero and logs it.
create or replace function public.loyalty_redeem(p_cafe uuid, p_customer uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  c public.cafes;
  v_cust public.loyalty_customers;
  v_was integer;
begin
  if not public.is_cafe_member(p_cafe) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  select * into c from public.cafes where id = p_cafe;
  select * into v_cust from public.loyalty_customers where id = p_customer and cafe_id = p_cafe for update;
  if not found then
    raise exception 'Customer not found.' using errcode = 'P0002';
  end if;
  if v_cust.stamps < c.loyalty_stamps_required then
    raise exception 'Not enough stamps yet (% of %).', v_cust.stamps, c.loyalty_stamps_required using errcode = '22023';
  end if;

  v_was := v_cust.stamps;
  update public.loyalty_customers
     set stamps = 0, rewards_redeemed = rewards_redeemed + 1, last_visit_at = now()
   where id = v_cust.id
  returning * into v_cust;

  insert into public.loyalty_events (cafe_id, customer_id, kind, stamps, reward, staff_user_id)
  values (p_cafe, v_cust.id, 'redeem', -v_was, c.loyalty_reward_en, auth.uid());

  return jsonb_build_object('customer_id', v_cust.id, 'stamps', 0, 'required', c.loyalty_stamps_required,
                            'rewards_redeemed', v_cust.rewards_redeemed, 'reward_en', c.loyalty_reward_en, 'reward_ar', c.loyalty_reward_ar);
end;
$$;

-- Fix a mistake: take one stamp off.
create or replace function public.loyalty_remove_stamp(p_cafe uuid, p_customer uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_cust public.loyalty_customers;
begin
  if not public.is_cafe_member(p_cafe) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  update public.loyalty_customers
     set stamps = stamps - 1, lifetime_stamps = greatest(0, lifetime_stamps - 1)
   where id = p_customer and cafe_id = p_cafe and stamps > 0
  returning * into v_cust;
  if not found then
    raise exception 'No stamps to remove.' using errcode = '22023';
  end if;
  insert into public.loyalty_events (cafe_id, customer_id, kind, stamps, staff_user_id)
  values (p_cafe, v_cust.id, 'adjust', -1, auth.uid());
  return jsonb_build_object('customer_id', v_cust.id, 'stamps', v_cust.stamps);
end;
$$;

-- Staff can mark items sold out without being able to change anything else.
create or replace function public.set_item_sold_out(p_item uuid, p_sold_out boolean)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  v_cafe uuid;
begin
  select cafe_id into v_cafe from public.items where id = p_item;
  if v_cafe is null or not public.is_cafe_member(v_cafe) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  update public.items set is_sold_out = p_sold_out where id = p_item;
end;
$$;

-- Save a new order in one request (good on slow connections).
create or replace function public.reorder_categories(p_cafe uuid, p_ids uuid[])
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.is_cafe_owner(p_cafe) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  update public.categories c
     set sort_order = o.pos
    from unnest(p_ids) with ordinality as o(id, pos)
   where c.id = o.id and c.cafe_id = p_cafe;
end;
$$;

create or replace function public.reorder_items(p_category uuid, p_ids uuid[])
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  v_cafe uuid;
begin
  select cafe_id into v_cafe from public.categories where id = p_category;
  if v_cafe is null or not public.is_cafe_owner(v_cafe) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  update public.items i
     set sort_order = o.pos
    from unnest(p_ids) with ordinality as o(id, pos)
   where i.id = o.id and i.category_id = p_category;
end;
$$;

-- After login: turn any invites for this (confirmed) email into access. Returns the user's cafés.
create or replace function public.claim_invites()
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
begin
  if v_uid is null then
    raise exception 'Not logged in.' using errcode = '42501';
  end if;
  select lower(email) into v_email from auth.users where id = v_uid and email_confirmed_at is not null;
  if v_email is not null then
    insert into public.cafe_members (cafe_id, user_id, role)
    select cafe_id, v_uid, role from public.cafe_invites where email = v_email
    on conflict (cafe_id, user_id) do nothing;
    delete from public.cafe_invites where email = v_email;
  end if;
  return public.my_cafes();
end;
$$;

create or replace function public.my_cafes()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 'slug', c.slug, 'name_en', c.name_en, 'name_ar', c.name_ar,
           'role', m.role, 'active', c.is_active, 'logo_url', c.logo_url,
           'color_primary', c.color_primary)
         order by c.name_en), '[]'::jsonb)
    from public.cafe_members m
    join public.cafes c on c.id = m.cafe_id
   where m.user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------
--  Platform admin functions (super admins only)
-- ---------------------------------------------------------------------

-- Give someone access to a café by email. If they don't have an account yet,
-- they get access automatically the first time they sign up with that email.
create or replace function public.super_add_member(p_cafe uuid, p_email text, p_role text default 'owner')
returns text language plpgsql volatile security definer set search_path = '' as $$
declare
  v_email text := lower(trim(p_email));
  v_uid uuid;
begin
  if not public.is_super_admin() then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  if p_role not in ('owner', 'staff') then
    raise exception 'Role must be owner or staff.' using errcode = '22023';
  end if;
  select id into v_uid from auth.users where lower(email) = v_email and email_confirmed_at is not null;
  if v_uid is not null then
    insert into public.cafe_members (cafe_id, user_id, role) values (p_cafe, v_uid, p_role)
    on conflict (cafe_id, user_id) do update set role = excluded.role;
    return 'added';
  end if;
  insert into public.cafe_invites (cafe_id, email, role, created_by) values (p_cafe, v_email, p_role, auth.uid())
  on conflict (cafe_id, email) do update set role = excluded.role;
  return 'invited';
end;
$$;

-- One row per café with the numbers you care about.
create or replace function public.super_stats()
returns table (
  id uuid, slug text, name_en text, is_active boolean, created_at timestamptz,
  menu_views_total bigint, menu_views_30d bigint, site_views_30d bigint,
  loyalty_signups bigint, signups_30d bigint, stamps_30d bigint, rewards_total bigint,
  menu_items bigint, owners text[], invites text[])
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_super_admin() then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  return query
  select c.id, c.slug, c.name_en, c.is_active, c.created_at,
         coalesce((select sum(v.views) from public.page_views v where v.cafe_id = c.id and v.page = 'menu'), 0)::bigint,
         coalesce((select sum(v.views) from public.page_views v where v.cafe_id = c.id and v.page = 'menu' and v.day > current_date - 30), 0)::bigint,
         coalesce((select sum(v.views) from public.page_views v where v.cafe_id = c.id and v.page = 'site' and v.day > current_date - 30), 0)::bigint,
         (select count(*) from public.loyalty_customers lc where lc.cafe_id = c.id),
         (select count(*) from public.loyalty_customers lc where lc.cafe_id = c.id and lc.created_at > now() - interval '30 days'),
         coalesce((select sum(e.stamps) from public.loyalty_events e where e.cafe_id = c.id and e.kind = 'stamp' and e.created_at > now() - interval '30 days'), 0)::bigint,
         (select count(*) from public.loyalty_events e where e.cafe_id = c.id and e.kind = 'redeem'),
         (select count(*) from public.items i where i.cafe_id = c.id),
         array(select u.email::text from public.cafe_members m join auth.users u on u.id = m.user_id where m.cafe_id = c.id and m.role = 'owner' order by u.email),
         array(select ci.email from public.cafe_invites ci where ci.cafe_id = c.id order by ci.email)
    from public.cafes c
   order by c.created_at;
end;
$$;

-- ---------------------------------------------------------------------
--  Who may call what
--  (Supabase lets everyone run new functions by default, so lock them down.)
-- ---------------------------------------------------------------------

revoke execute on function public.is_super_admin()                    from public, anon;
revoke execute on function public.cafe_role(uuid)                     from public, anon;
revoke execute on function public.is_cafe_member(uuid)                from public, anon;
revoke execute on function public.is_cafe_owner(uuid)                 from public, anon;
revoke execute on function public.can_write_cafe_file(text)           from public, anon;
revoke execute on function public.loyalty_add_stamp(uuid, text, integer) from public, anon;
revoke execute on function public.loyalty_redeem(uuid, uuid)          from public, anon;
revoke execute on function public.loyalty_remove_stamp(uuid, uuid)    from public, anon;
revoke execute on function public.set_item_sold_out(uuid, boolean)    from public, anon;
revoke execute on function public.reorder_categories(uuid, uuid[])    from public, anon;
revoke execute on function public.reorder_items(uuid, uuid[])         from public, anon;
revoke execute on function public.claim_invites()                     from public, anon;
revoke execute on function public.my_cafes()                          from public, anon;
revoke execute on function public.super_add_member(uuid, text, text)  from public, anon;
revoke execute on function public.super_stats()                       from public, anon;

grant execute on function public.is_super_admin()                    to authenticated;
grant execute on function public.cafe_role(uuid)                     to authenticated;
grant execute on function public.is_cafe_member(uuid)                to authenticated;
grant execute on function public.is_cafe_owner(uuid)                 to authenticated;
grant execute on function public.can_write_cafe_file(text)           to authenticated;
grant execute on function public.loyalty_add_stamp(uuid, text, integer) to authenticated;
grant execute on function public.loyalty_redeem(uuid, uuid)          to authenticated;
grant execute on function public.loyalty_remove_stamp(uuid, uuid)    to authenticated;
grant execute on function public.set_item_sold_out(uuid, boolean)    to authenticated;
grant execute on function public.reorder_categories(uuid, uuid[])    to authenticated;
grant execute on function public.reorder_items(uuid, uuid[])         to authenticated;
grant execute on function public.claim_invites()                     to authenticated;
grant execute on function public.my_cafes()                          to authenticated;
grant execute on function public.super_add_member(uuid, text, text)  to authenticated;
grant execute on function public.super_stats()                       to authenticated;

grant execute on function public.public_cafe(text)                   to anon, authenticated;
grant execute on function public.track_view(text, text)              to anon, authenticated;
grant execute on function public.loyalty_check(text, text, boolean)  to anon, authenticated;
grant execute on function public.normalize_kw_phone(text)           to anon, authenticated;

-- ---------------------------------------------------------------------
--  Photo and logo storage
--  Public bucket (anyone can view images by URL). Only a café's owners
--  can upload, replace or delete files in their café's folder.
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cafe-media', 'cafe-media', true, 3145728, array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists cafe_media_read on storage.objects;
create policy cafe_media_read on storage.objects for select to authenticated
  using (bucket_id = 'cafe-media' and public.can_write_cafe_file(name));
drop policy if exists cafe_media_insert on storage.objects;
create policy cafe_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'cafe-media' and public.can_write_cafe_file(name));
drop policy if exists cafe_media_update on storage.objects;
create policy cafe_media_update on storage.objects for update to authenticated
  using (bucket_id = 'cafe-media' and public.can_write_cafe_file(name))
  with check (bucket_id = 'cafe-media' and public.can_write_cafe_file(name));
drop policy if exists cafe_media_delete on storage.objects;
create policy cafe_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'cafe-media' and public.can_write_cafe_file(name));
