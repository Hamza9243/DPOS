import { useState } from "react";
import { Building2, Phone, Camera, Check, LogOut, Image } from "lucide-react";
import { showToast, showConfirm } from "../components/Toast";
import { supabase } from "../lib/supabase";

export default function Profile({ business, user, onUpdate }) {
  const [businessName, setBusinessName] = useState(business?.business_name || "");
  const [phone, setPhone] = useState(business?.phone || "");
  const [avatar, setAvatar] = useState(business?.avatar_url || "");
  const [avatarFile, setAvatarFile] = useState(null);
  const [logo, setLogo] = useState(business?.logo_url || "");
  const [logoFile, setLogoFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const themeColor = "#1565C0";

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
    <div className="p-4 md:p-6 bg-[#f4f7ff] min-h-screen pb-24 md:pb-6">
      <div className="mb-6">
        <h2 className="text-2xl font-extrabold text-gray-800">Profile</h2>
        <p className="text-gray-400 text-xs mt-0.5">Manage your business profile</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 max-w-md space-y-5">
        {/* Avatar */}
        <div className="flex flex-col items-center">
          <div className="relative">
            <div className="w-24 h-24 rounded-3xl overflow-hidden border-4 border-white shadow-xl"
              style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)` }}>
              {avatar
                ? <img src={avatar} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-3xl font-black text-white">
                    {businessName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || "D"}
                  </div>
              }
            </div>
            <label htmlFor="avatar-upload" className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-white shadow-lg border border-gray-100 flex items-center justify-center cursor-pointer hover:bg-gray-50 transition">
              <Camera size={14} className="text-blue-600" />
            </label>
            <input type="file" id="avatar-upload" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>
          <p className="text-sm font-bold text-gray-700 mt-3">{businessName || "Your Business"}</p>
          <p className="text-xs text-gray-400">{user?.email}</p>
        </div>

        {/* Business Name */}
        <div>
          <label className="text-xs font-bold text-gray-400 mb-2 block uppercase tracking-wider">Business Name</label>
          <div className="flex items-center border-2 border-gray-100 rounded-2xl px-4 py-3.5 gap-3 bg-gray-50 focus-within:border-blue-400 transition-all">
            <Building2 size={16} className="text-gray-300 flex-shrink-0" />
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Business name"
              className="text-sm outline-none text-gray-700 w-full bg-transparent font-medium"
            />
          </div>
        </div>

        {/* Phone */}
        <div>
          <label className="text-xs font-bold text-gray-400 mb-2 block uppercase tracking-wider">Phone Number</label>
          <div className="flex items-center border-2 border-gray-100 rounded-2xl px-4 py-3.5 gap-3 bg-gray-50 focus-within:border-blue-400 transition-all">
            <Phone size={16} className="text-gray-300 flex-shrink-0" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="03XX-XXXXXXX"
              className="text-sm outline-none text-gray-700 w-full bg-transparent font-medium"
            />
          </div>
        </div>

        {/* Sidebar Logo */}
        <div>
          <label className="text-xs font-bold text-gray-400 mb-2 block uppercase tracking-wider flex items-center gap-2">
            <Image size={12} /> Sidebar Logo
          </label>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl overflow-hidden border-2 border-gray-100 bg-gray-50 flex items-center justify-center flex-shrink-0">
              {logo
                ? <img src={logo} className="w-full h-full object-contain p-1" />
                : <Image size={24} className="text-gray-200" />
              }
            </div>
            <div className="flex-1">
              <input type="file" id="logo-upload" accept="image/*" className="hidden" onChange={handleLogoChange} />
              <label htmlFor="logo-upload" className="w-full py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 cursor-pointer border-2 border-dashed border-gray-200 text-gray-400 hover:bg-gray-50 transition">
                <Camera size={14} /> Upload Logo
              </label>
              <p className="text-xs text-gray-300 mt-1.5 text-center">Shows in sidebar</p>
            </div>
          </div>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full py-4 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition active:scale-95 disabled:opacity-50"
          style={{ background: `linear-gradient(90deg, ${themeColor}, ${themeColor}cc)`, boxShadow: `0 8px 24px ${themeColor}50` }}
        >
          <Check size={16} />
          {loading ? "Saving..." : "Save Changes"}
        </button>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition active:scale-95 border-2 border-red-100 text-red-400 hover:bg-red-50"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </div>
  );
} 