"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  User,
  Mail,
  Shield,
  ExternalLink,
  Home,
  FileText,
  Upload,
  Pencil,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { useUser } from "@clerk/nextjs";

export default function AccountPage() {
  const router = useRouter();
  const { user } = useUser();
  const [copied, setCopied] = useState(false);

  // Editing state
  const [editing, setEditing] = useState(false);
  const [editFirst, setEditFirst] = useState("");
  const [editLast, setEditLast] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync edit fields when user data loads
  useEffect(() => {
    if (user) {
      setEditFirst(user.firstName || "");
      setEditLast(user.lastName || "");
    }
  }, [user]);

  const handleStartEdit = () => {
    setEditFirst(user?.firstName || "");
    setEditLast(user?.lastName || "");
    setEditing(true);
    setSaveSuccess(false);
  };

  const handleCancelEdit = () => {
    setEditing(false);
  };

  const handleSave = async () => {
    if (!user || !editFirst.trim()) return;
    setSaving(true);
    try {
      await user.update({
        firstName: editFirst.trim(),
        lastName: editLast.trim(),
      });
      setEditing(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error("Failed to update profile:", err);
    } finally {
      setSaving(false);
    }
  };

  const initials = user
    ? `${(user.firstName || "")[0] || ""}${(user.lastName || "")[0] || ""}`.toUpperCase() || "U"
    : "U";

  const copyUserId = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F4EE]">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-[rgba(217,185,130,0.25)] bg-[#FDFCF9]/92 backdrop-blur-xl">
        <div className="max-w-lg mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => router.push("/profile")}
            className="text-[#8a7f6f] hover:text-[#1a1815] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold text-[#1a1815]">Account</span>
        </div>
      </nav>

      <main className="max-w-lg mx-auto px-4 py-6 pb-24">
        {/* Avatar + Name */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-white font-bold text-2xl shadow-md shadow-purple-500/15 mb-3">
            {initials}
          </div>
          <h1
            className="text-lg font-bold text-[#1a1815]"
            style={{ fontFamily: "'Georgia', serif" }}
          >
            {user?.fullName || "Student"}
          </h1>
          <p className="text-xs text-[#8a7f6f] mt-0.5">
            Member since{" "}
            {user?.createdAt
              ? new Date(user.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                })
              : "—"}
          </p>
        </div>

        {/* Account Details */}
        <div className="bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] rounded-xl overflow-hidden mb-4">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <p className="text-[10px] font-bold text-[#8a7f6f] uppercase tracking-widest">
              Account details
            </p>
            {!editing ? (
              <button
                onClick={handleStartEdit}
                className="flex items-center gap-1 text-[11px] text-purple-600 hover:text-purple-700 font-medium"
              >
                <Pencil className="w-3 h-3" />
                Edit
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCancelEdit}
                  className="p-1 text-[#8a7f6f] hover:text-[#1a1815] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                <button
                  onClick={handleSave}
                  disabled={!editFirst.trim() || saving}
                  className="flex items-center gap-1 text-[11px] text-white bg-[#1a1815] hover:bg-[#2a2520] disabled:opacity-40 px-2.5 py-1 rounded-md font-medium transition-colors"
                >
                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                  Save
                </button>
              </div>
            )}
          </div>

          {/* Name fields */}
          {editing ? (
            <div className="px-4 py-3 space-y-3">
              <div>
                <label className="text-[10px] text-[#b5ad9e] mb-1 block">First name</label>
                <input
                  type="text"
                  value={editFirst}
                  onChange={(e) => setEditFirst(e.target.value)}
                  autoFocus
                  className="w-full px-3 py-2 bg-[#F7F4EE] border border-[rgba(217,185,130,0.3)] rounded-lg text-sm text-[#1a1815] placeholder:text-[#b5ad9e] focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400/20"
                  onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
                />
              </div>
              <div>
                <label className="text-[10px] text-[#b5ad9e] mb-1 block">Last name</label>
                <input
                  type="text"
                  value={editLast}
                  onChange={(e) => setEditLast(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F7F4EE] border border-[rgba(217,185,130,0.3)] rounded-lg text-sm text-[#1a1815] placeholder:text-[#b5ad9e] focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400/20"
                  onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
                />
              </div>
            </div>
          ) : (
            <div className="px-4 py-3">
              <div className="flex items-center gap-3">
                <User className="w-4 h-4 text-[#8a7f6f]" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-[#b5ad9e] mb-0.5">Full name</p>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-[#1a1815]">{user?.fullName || "—"}</p>
                    {saveSuccess && (
                      <span className="text-[10px] text-emerald-600 font-medium">Updated!</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="border-t border-[rgba(217,185,130,0.15)] mx-4" />

          <div className="px-4 py-3">
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-[#8a7f6f]" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-[#b5ad9e] mb-0.5">Email</p>
                <p className="text-sm text-[#1a1815] truncate">
                  {user?.primaryEmailAddress?.emailAddress || "—"}
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-[rgba(217,185,130,0.15)] mx-4" />

          <div className="px-4 py-3">
            <div className="flex items-center gap-3">
              <Shield className="w-4 h-4 text-[#8a7f6f]" />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-[#b5ad9e] mb-0.5">User ID</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-[#1a1815] font-mono text-[12px] truncate">
                    {user?.id || "—"}
                  </p>
                  <button
                    onClick={copyUserId}
                    className="text-[10px] text-purple-600 hover:text-purple-700 font-medium flex-shrink-0"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Manage Account */}
        <div className="bg-[#FDFCF9] border border-[rgba(217,185,130,0.25)] rounded-xl overflow-hidden mb-4">
          <p className="text-[10px] font-bold text-[#8a7f6f] uppercase tracking-widest px-4 pt-4 pb-2">
            Manage
          </p>

          <button
            onClick={() => user?.id && window.open("https://accounts.clerk.dev/user", "_blank")}
            className="flex items-center justify-between w-full px-4 py-3 hover:bg-[#F7F4EE] transition-colors"
          >
            <div className="flex items-center gap-3">
              <Shield className="w-4 h-4 text-[#8a7f6f]" />
              <div className="text-left">
                <span className="text-sm text-[#1a1815] block">Security & Password</span>
                <span className="text-[10px] text-[#b5ad9e]">Manage via Clerk</span>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-[#8a7f6f]" />
          </button>
        </div>

        {/* Info note */}
        <p className="text-[11px] text-[#b5ad9e] text-center px-4">
          Account authentication is managed securely by Clerk. To change your password or enable 2FA, use the security settings above.
        </p>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#FDFCF9] border-t border-[rgba(217,185,130,0.25)] backdrop-blur-xl">
        <div className="flex items-center justify-around h-14">
          <Link href="/dashboard" className="flex flex-col items-center gap-0.5 text-[#8a7f6f] hover:text-[#1a1815]">
            <Home className="w-5 h-5" />
            <span className="text-[10px] font-medium">Home</span>
          </Link>
          <Link href="/lectures" className="flex flex-col items-center gap-0.5 text-[#8a7f6f] hover:text-[#1a1815]">
            <FileText className="w-5 h-5" />
            <span className="text-[10px] font-medium">Lectures</span>
          </Link>
          <Link href="/upload" className="flex flex-col items-center gap-0.5 text-[#8a7f6f] hover:text-[#1a1815]">
            <Upload className="w-5 h-5" />
            <span className="text-[10px] font-medium">Upload</span>
          </Link>
          <Link href="/profile" className="flex flex-col items-center gap-0.5 text-purple-600">
            <User className="w-5 h-5" />
            <span className="text-[10px] font-medium">You</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
