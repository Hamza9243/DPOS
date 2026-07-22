# Staff Roles (Admin / Manager / Cashier) — Setup

Yeh feature ek business ke liye 3 tarah ke logins deta hai:

- **Admin (owner)** — sab features: POS, Orders, Inventory, Dashboard, Staff.
- **Manager** — POS, Orders (full — status/return/edit), Inventory, Dashboard/Reports.
  Staff screen sirf admin ko dikhti hai.
- **Cashier** — sirf **POS + Orders** (view + invoice/print). Inventory, Dashboard,
  Staff, aur Orders ke return/edit/status actions chhupe rehte hain.

Manager/Cashier accounts admin app ke andar **Staff** screen se bante hain.

---

## Step 1 — Database (do dafa: pehli baar 001, phir 002)

1. Supabase Dashboard → **SQL Editor** → **New query**
2. `supabase/migrations/001_business_members.sql` ka poora content paste karein → **Run**
3. Naya query kholein, `supabase/migrations/002_full_rls_and_orders.sql` ka poora
   content paste karein → **Run**

Migration `002` yeh karti hai:
- `products`, `categories`, `orders`, `order_items`, `businesses` par **RLS enable**
  karti hai (pehle sirf `business_members` par thi — baqi tables completely khuli
  thin, yani koi bhi signed-in user kisi bhi business ka data API se seedha
  padh/badal sakta tha).
- `business_members.role` mein `manager` add karti hai.
- 4 RPC functions banati hai (`create_order`, `add_order_item`, `update_order_item`,
  `set_order_status`) jo checkout/stock/total ko **atomically, server-side** handle
  karte hain — total ab kabhi browser se trust nahi hota, aur stock kabhi negative
  nahi ho sakta.

Migration re-run karna safe hai (sab kuch `drop ... if exists` / `create or replace`).

## Step 2 — Edge Function deploy/update (ek dafa, ya jab bhi function change ho)

Apne computer pe (project folder mein), Supabase CLI ke saath:

```bash
# 1. CLI install (agar nahi hai): https://supabase.com/docs/guides/cli
npm install -g supabase

# 2. Login + project link
supabase login
supabase link --project-ref gcbehtrvnkoxytdqpeyh

# 3. Service role key set karein (Dashboard → Settings → API → service_role key)
supabase secrets set SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY

# 4. (Recommended, production) apni deployed app ka origin lock karein
supabase secrets set ALLOWED_ORIGIN=https://yourapp.com

# 5. Function deploy
supabase functions deploy manage-staff
```

> **Note:** `SUPABASE_URL` aur `SUPABASE_ANON_KEY` Supabase khud inject karta hai —
> sirf `SERVICE_ROLE_KEY` (aur, production mein, `ALLOWED_ORIGIN`) set karni hai.
> Service role key ko KABHI frontend mein mat daalein; wo sirf is function ke andar
> use hoti hai. `ALLOWED_ORIGIN` na set karein to function har origin se call ho
> sakta hai (dev ke liye theek hai, production ke liye apna domain lock karein).

## Step 3 — Use karein

1. Admin (aap) login karein → sidebar mein naya **Staff** option aayega.
2. **Add Staff** → role choose karein (**Cashier** ya **Manager**) → email + password
   (kam se kam 8 characters) daalein → **Create**.
3. Wahi email/password us staff member ko de dein.
   - **Cashier**: login karne par sirf **POS** aur **Orders** (view/print) dikhega.
   - **Manager**: **POS, Orders (full), Inventory, Dashboard** dikhega — **Staff**
     nahi (wo sirf admin/owner ke liye hai).

---

## Kaise kaam karta hai (short)

- Login pe app dekhti hai: user kisi business ka **owner** hai? → `admin`.
  Warna `business_members` mein uski membership? → us role (`manager`/`cashier`).
- Routes role se gate hote hain (`src/App.jsx`), sidebar links role se filter
  (`src/components/Sidebar.jsx`), aur Orders ke destructive actions sirf
  admin/manager ko (`src/pages/Orders.jsx`).
- **Har write server-side bhi verify hoti hai** — sirf UI hide karna kaafi nahi tha
  (pehle `Orders.jsx` mein role check hi nahi tha, koi bhi cashier har order edit kar
  sakta tha). Ab RLS policies + `current_role()` check har table/RPC ke andar bhi
  role dobara verify karte hain, isliye API ko directly call karke bhi bypass nahi
  ho sakta.
- Cashier delete karne pe uska auth user bhi delete hota hai (function), taake
  wo dobara login na kar sake.

## Security status

- ✅ `business_members` — RLS (migration 001)
- ✅ `businesses`, `products`, `categories`, `orders`, `order_items` — RLS
  (migration 002) — pehle yeh **optional** tha, ab **applied** hai.
- ✅ Order total/stock ab client se trust nahi hota — `create_order` RPC DB ke
  actual price se total banata hai aur row-lock ke saath atomically stock check
  + kam karta hai (do cashiers ek hi waqt same product bech dein to bhi oversell
  nahi hoga).
- ✅ Stock adjustments ab `product_id` se hote hain, product **name** se match
  karke nahi (purana tareeqa duplicate/similar naam waale products ke saath galat
  ho sakta tha).
