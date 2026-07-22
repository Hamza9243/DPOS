import { supabase } from "./supabase";

// Resolve which business a user belongs to AND their role.
//  - Is a staff member  -> { business, role } of the ADMIN's business (checked
//                          FIRST so a cashier never falls back to a stray/empty
//                          business of their own).
//  - Owns a business    -> { business, role: "admin" }
//  - Brand new (neither)-> create a business, they become its admin
export const resolveUserContext = async (userId) => {
  // 1) Staff membership takes priority — the cashier belongs to the admin's
  //    business, so they see the admin's products/orders.
  const { data: membership } = await supabase
    .from("business_members")
    .select("role, business_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (membership?.business_id) {
    const { data: biz } = await supabase
      .from("businesses")
      .select("*")
      .eq("id", membership.business_id)
      .maybeSingle();
    // Return the membership business even if details can't be read, so we never
    // wrongly create a new business for a known staff member.
    return { business: biz || { id: membership.business_id }, role: membership.role || "cashier" };
  }

  // 2) Owner = admin.
  const { data: owned } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", userId)
    .maybeSingle();
  if (owned) return { business: owned, role: "admin" };

  // 3) Genuinely new signup -> create their own business as admin (full access).
  const { data: newBusiness } = await supabase
    .from("businesses")
    .insert({ name: "My Business", owner_id: userId, plan: "pro", plan_selected: true })
    .select()
    .single();
  return { business: newBusiness, role: "admin" };
};