# Staff Roles (Admin / Cashier) — Setup

Yeh feature ek restaurant ke liye 2 tarah ke logins deta hai:

- **Admin (owner)** — sab features: POS, Orders, Inventory, Dashboard, Staff.
- **Cashier** — sirf **POS + Orders** (view + invoice/print). Inventory, Dashboard,
  Staff, aur Orders ke return/edit/status actions chhupe rehte hain.

Cashier accounts admin app ke andar **Staff** screen se banta hai.

---

## Step 1 — Database (ek dafa)

1. Supabase Dashboard → **SQL Editor** → **New query**
2. `supabase/migrations/001_business_members.sql` ka poora content paste karein
3. **Run** dabayein

Isse `business_members` table + helper functions + RLS policies ban jayengi.

## Step 2 — Edge Function deploy (ek dafa)

Apne computer pe (project folder mein), Supabase CLI ke saath:

```bash
# 1. CLI install (agar nahi hai): https://supabase.com/docs/guides/cli
npm install -g supabase

# 2. Login + project link
supabase login
supabase link --project-ref gcbehtrvnkoxytdqpeyh

# 3. Service role key set karein (Dashboard → Settings → API → service_role key)
supabase secrets set SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY

# 4. Function deploy
supabase functions deploy manage-staff
```

> **Note:** `SUPABASE_URL` aur `SUPABASE_ANON_KEY` Supabase khud inject karta hai —
> sirf `SERVICE_ROLE_KEY` set karni hai. Service role key ko KABHI frontend mein
> mat daalein; wo sirf is function ke andar use hoti hai.

## Step 3 — Use karein

1. Admin (aap) login karein → sidebar mein naya **Staff** option aayega.
2. **Add Cashier** → cashier ka email + password daalein → **Create**.
3. Wahi email/password cashier ko de dein. Wo login karega to usse sirf
   **POS** aur **Orders** dikhega.

---

## Kaise kaam karta hai (short)

- Login pe app dekhti hai: user kisi business ka **owner** hai? → `admin`.
  Warna `business_members` mein uski membership? → us business ka `cashier`.
- Routes role se gate hote hain (`src/App.jsx`), sidebar links role se filter
  (`src/components/Sidebar.jsx`), aur Orders ke destructive actions sirf admin
  ko (`src/pages/Orders.jsx`).
- Cashier delete karne pe uska auth user bhi delete hota hai (function), taake
  wo dobara login na kar sake.

## Security note (recommended)

UI gating + `business_members` RLS lag chuki hai. **Behtareen security** ke liye
baqi tables (products, orders, etc.) pe bhi RLS enable karein — uske liye SQL ka
commented "OPTIONAL HARDENING" hissa migration file ke neeche mojood hai. Isse
cashier API ke through bhi admin-only data tak nahi pohonch sakega.
