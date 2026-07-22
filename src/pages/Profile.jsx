import { useState } from "react";
import { Building2, Phone, Camera, Check, LogOut, Image } from "lucide-react";
import { showToast, showConfirm } from "../components/Toast";
import { supabase } from "../lib/supabase";
import ThemeToggle from "../components/ThemeToggle";

export default function Profile({ business, user, onUpdate }) {
  const [businessName, setBusinessName] = useState(business?.business_name || "");
  const [phone, setPhone] = useState(business?.phone || "");
  const [avatar, setAvatar] = useState(business?.avatar_url || "");
  const [avatarFile, setAvatarFile] = useState(null);
  const [logo, setLogo] = useState(business?.logo_url || "");
  const [logoFile, setLogoFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatar(URL.createObjectURL(file));
    setAvatarFile(file);
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLogo(URL.createObjectURL(file));
    setLogoFile(file);
  };

  const uploadFile = async (file, path) => {
    const ext = file.name.split(".").pop();
    const fileName = `${path}/${business.id}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(fileName, file, { upsert: true });
    if (error) return null;
    const { data } = supabase.storage.from("product-images").getPublicUrl(fileName);
    return data.publicUrl;
  };

  const handleSave = async () => {
    setLoading(true);
    let avatarUrl = avatar;
    let logoUrl = logo;

    if (avatarFile) {
      const uploaded = await uploadFile(avatarFile, "avatars");
      if (uploaded) avatarUrl = uploaded;
    }
    if (logoFile) {
      const uploaded = await uploadFile(logoFile, "logos");
      if (uploaded) logoUrl = uploaded;
    }

    await supabase.from("businesses").update({
      business_name: businessName,
      phone: phone,
      avatar_url: avatarUrl,
      logo_url: logoUrl,
    }).eq("id", business.id);

    localStorage.setItem("dpos_logo", logoUrl);

    showToast("Profile updated!", "success");
    if (onUpdate) onUpdate({
      ...business,
      business_name: businessName,
      phone,
      avatar_url: avatarUrl,
      logo_url: logoUrl,
    });
    setLoading(false);
  };

  const handleLogout = async () => {
    const ok = await showConfirm("You will be logged out of DPOS.");
    if (ok) await supabase.auth.signOut();
  };

  return (
    <div className="p-4 md:p-6 bg-ink-50 dark:bg-ink-900 min-h-screen pb-24 md:pb-6">
      <div className="mb-6">
        <h2 className="text-2xl font-extrabold text-ink-900 dark:text-white">Profile</h2>
        <p className="text-ink-600 dark:text-ink-400 text-xs mt-0.5">Manage your business profile</p>
      </div>

      <div className="bg-white dark:bg-ink-800 rounded-3xl shadow-soft border border-black/10 dark:border-white/10 p-6 max-w-md space-y-5 animate-fade-up">
        {/* Avatar */}
        <div className="flex flex-col items-center">
          <div className="relative">
            <div className="w-24 h-24 rounded-3xl overflow-hidden border-4 border-ink-700 shadow-elevated bg-gradient-to-br from-brand-600 to-brand-700">
              {avatar
                ? <img src={avatar} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-3xl font-black text-ink-900 dark:text-white">
                    {businessName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "D"}
                  </div>
              }
            </div>
            <label htmlFor="avatar-upload" className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-ink-100 dark:bg-ink-700 shadow-card border border-black/10 dark:border-white/10 flex items-center justify-center cursor-pointer hover:bg-ink-200 dark:hover:bg-ink-600 transition-colors">
              <Camera size={14} className="text-brand-600 dark:text-brand-300" />
            </label>
            <input type="file" id="avatar-upload" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>
          <p className="text-sm font-bold text-ink-900 dark:text-white mt-3">{businessName || "Your Business"}</p>
          <p className="text-xs text-ink-600 dark:text-ink-400">{user?.email}</p>
        </div>

        {/* Business Name */}
        <div>
          <label className="text-xs font-bold text-ink-600 dark:text-ink-400 mb-2 block uppercase tracking-wider">Business Name</label>
          <div className="flex items-center border-2 border-black/10 dark:border-white/10 rounded-2xl px-4 py-3.5 gap-3 bg-ink-100 dark:bg-ink-700 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/10 transition-all">
            <Building2 size={16} className="text-ink-600 dark:text-ink-400 flex-shrink-0" />
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Business name"
              className="text-sm outline-none text-ink-900 dark:text-white placeholder:text-ink-500 w-full bg-transparent font-medium"
            />
          </div>
        </div>

        {/* Phone */}
        <div>
          <label className="text-xs font-bold text-ink-600 dark:text-ink-400 mb-2 block uppercase tracking-wider">Phone Number</label>
          <div className="flex items-center border-2 border-black/10 dark:border-white/10 rounded-2xl px-4 py-3.5 gap-3 bg-ink-100 dark:bg-ink-700 focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/10 transition-all">
            <Phone size={16} className="text-ink-600 dark:text-ink-400 flex-shrink-0" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="03XX-XXXXXXX"
              className="text-sm outline-none text-ink-900 dark:text-white placeholder:text-ink-500 w-full bg-transparent font-medium"
            />
          </div>
        </div>

        {/* Sidebar Logo */}
        <div>
          <label className="text-xs font-bold text-ink-600 dark:text-ink-400 mb-2 block uppercase tracking-wider flex items-center gap-2">
            <Image size={12} /> Sidebar Logo
          </label>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-black/10 dark:border-white/10 bg-ink-100 dark:bg-ink-700 flex items-center justify-center flex-shrink-0">
              {logo
                ? <img src={logo} className="w-full h-full object-contain p-1" />
                : <Image size={24} className="text-ink-500" />
              }
            </div>
            <div className="flex-1">
              <input type="file" id="logo-upload" accept="image/*" className="hidden" onChange={handleLogoChange} />
              <label htmlFor="logo-upload" className="w-full py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 cursor-pointer border-2 border-dashed border-black/10 dark:border-white/10 text-ink-600 dark:text-ink-400 hover:border-brand-500/40 hover:text-brand-700 dark:hover:text-brand-300 transition-colors">
                <Camera size={14} /> Upload Logo
              </label>
              <p className="text-xs text-ink-500 mt-1.5 text-center">Shows in sidebar</p>
            </div>
          </div>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full py-4 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50 shadow-elevated hover:brightness-110 bg-gradient-to-r from-brand-600 to-brand-700"
        >
          <Check size={16} />
          {loading ? "Saving..." : "Save Changes"}
        </button>

        {/* Theme */}
        <div className="flex items-center justify-between p-4 rounded-2xl bg-ink-100 dark:bg-ink-700 border border-black/10 dark:border-white/10">
          <span className="text-sm font-bold text-ink-700 dark:text-ink-200">Light / Dark Theme</span>
          <ThemeToggle />
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-colors active:scale-95 border-2 border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/10"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </div>
  );
}