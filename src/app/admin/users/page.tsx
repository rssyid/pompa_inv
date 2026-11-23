"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell, ClientSessionUser } from "@/components/AppShell";
import { MasterTreeData } from "@/components/HierarchyFilterBar";
import { ErrorState, LoadingState } from "@/components/UiStates";
import { fetchJson } from "@/lib/client-fetch";

interface UserRow {
  id: number;
  username: string;
  name: string;
  role: "admin" | "petugas";
  defaultEstateId: number | null;
  defaultEstateCode: string | null;
  isActive: boolean;
}

export default function AdminUsersPage() {
  const [me, setMe] = useState<ClientSessionUser | null>(null);
  const [master, setMaster] = useState<MasterTreeData | null>(null);
  const [usersList, setUsersList] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "petugas">("petugas");
  const [defaultEstateId, setDefaultEstateId] = useState("");

  const [resetUserId, setResetUserId] = useState<number | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [meRes, treeRes, usersRes] = await Promise.all([
        fetchJson<{ user: ClientSessionUser }>("/api/auth/me"),
        fetchJson<MasterTreeData>("/api/master/tree"),
        fetchJson<{ users: UserRow[] }>("/api/users"),
      ]);
      setMe(meRes.user);
      setMaster(treeRes);
      setUsersList(usersRes.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat data user.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await fetchJson("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          name,
          password,
          role,
          defaultEstateId: defaultEstateId ? Number(defaultEstateId) : null,
        }),
      });
      setNotice(`Akun "${username}" berhasil dibuat.`);
      setUsername("");
      setName("");
      setPassword("");
      setDefaultEstateId("");
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menambahkan user.");
    } finally {
      setSaving(false);
    }
  }

  async function updateUser(id: number, payload: Record<string, unknown>, msg: string) {
    setError(null);
    setNotice(null);
    try {
      await fetchJson(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setNotice(msg);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memperbarui user.");
    }
  }

  if (loading || !me || !master) {
    return (
      <div className="min-h-screen bg-field-bg p-6">
        <LoadingState message="Memuat manajemen user..." />
      </div>
    );
  }

  return (
    <AppShell
      user={me}
      title="Kelola User"
      subtitle="Tambahkan akun Admin atau Petugas Lapangan serta atur estate tugasnya."
    >
      <div className="space-y-5">
        {error && <ErrorState message={error} />}
        {notice && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-md border border-[#86EFAC] bg-[#DCFCE7] px-4 py-3 text-sm font-semibold text-[#166534]"
          >
            {notice}
          </div>
        )}

        <section className="rounded-lg border border-field-border bg-field-surface p-4">
          <h2 className="mb-3 text-base font-bold text-field-ink">Tambah User Baru</h2>
          <form onSubmit={handleCreateUser} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <label htmlFor="u-username" className="mb-1 block text-xs font-semibold text-field-muted">
                Username
              </label>
              <input
                id="u-username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Contoh: budi.mho"
                className="min-h-[44px] w-full rounded-md border border-field-border px-3 text-sm"
              />
            </div>

            <div>
              <label htmlFor="u-name" className="mb-1 block text-xs font-semibold text-field-muted">
                Nama Lengkap
              </label>
              <input
                id="u-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Budi Santoso"
                className="min-h-[44px] w-full rounded-md border border-field-border px-3 text-sm"
              />
            </div>

            <div>
              <label htmlFor="u-pass" className="mb-1 block text-xs font-semibold text-field-muted">
                Kata Sandi Awal
              </label>
              <input
                id="u-pass"
                type="password"
                minLength={6}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="min-h-[44px] w-full rounded-md border border-field-border px-3 text-sm"
              />
            </div>

            <div>
              <label htmlFor="u-role" className="mb-1 block text-xs font-semibold text-field-muted">
                Role
              </label>
              <select
                id="u-role"
                value={role}
                onChange={(e) => setRole(e.target.value as "admin" | "petugas")}
                className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm"
              >
                <option value="petugas">Petugas Lapangan</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div>
              <label htmlFor="u-estate" className="mb-1 block text-xs font-semibold text-field-muted">
                Estate Tugas (Opsional)
              </label>
              <select
                id="u-estate"
                value={defaultEstateId}
                onChange={(e) => setDefaultEstateId(e.target.value)}
                className="min-h-[44px] w-full rounded-md border border-field-border bg-white px-3 text-sm"
              >
                <option value="">Semua Estate</option>
                {master.estates.map((es) => (
                  <option key={es.id} value={String(es.id)}>
                    {es.code}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2 lg:col-span-5 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="min-h-[44px] rounded-md bg-field-accent px-5 text-sm font-semibold text-white hover:bg-field-accent-hover disabled:opacity-60"
              >
                {saving ? "Menyimpan..." : "Buat Akun User"}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-lg border border-field-border bg-field-surface">
          <div className="border-b border-field-border px-4 py-3">
            <h2 className="text-base font-bold text-field-ink">
              Daftar Akun ({usersList.length})
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[740px] text-left text-sm">
              <thead className="border-b border-field-border bg-field-bg text-xs font-semibold text-field-muted">
                <tr>
                  <th className="px-3 py-2.5">Username</th>
                  <th className="px-3 py-2.5">Nama</th>
                  <th className="px-3 py-2.5">Role</th>
                  <th className="px-3 py-2.5">Estate Tugas</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-field-border">
                {usersList.map((u) => (
                  <tr key={u.id}>
                    <td className="px-3 py-2.5 font-mono font-semibold">{u.username}</td>
                    <td className="px-3 py-2.5">{u.name}</td>
                    <td className="px-3 py-2.5">
                      <select
                        aria-label={`Role untuk ${u.username}`}
                        value={u.role}
                        onChange={(e) =>
                          updateUser(
                            u.id,
                            { role: e.target.value },
                            `Role ${u.username} diubah menjadi ${e.target.value}.`
                          )
                        }
                        className="min-h-[40px] rounded border border-field-border bg-white px-2 text-xs font-semibold"
                      >
                        <option value="petugas">Petugas</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-xs">
                      {u.defaultEstateCode ?? "Semua"}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {u.isActive ? "Aktif" : "Nonaktif"}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setResetUserId(u.id);
                            setResetPassword("");
                          }}
                          className="min-h-[44px] rounded border border-field-border bg-field-bg px-3 text-xs font-semibold"
                        >
                          Reset Sandi
                        </button>
                        {u.id !== me.userId && (
                          <button
                            type="button"
                            onClick={() =>
                              updateUser(
                                u.id,
                                { isActive: !u.isActive },
                                `Status akun ${u.username} diperbarui.`
                              )
                            }
                            className="min-h-[44px] rounded border border-field-border bg-field-bg px-3 text-xs font-semibold"
                          >
                            {u.isActive ? "Nonaktifkan" : "Aktifkan"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {resetUserId !== null && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Reset kata sandi user"
            onKeyDown={(e) => {
              if (e.key === "Escape") setResetUserId(null);
            }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateUser(
                  resetUserId,
                  { newPassword: resetPassword },
                  "Kata sandi user berhasil direset."
                ).then(() => setResetUserId(null));
              }}
              className="w-full max-w-sm space-y-4 rounded-lg bg-field-surface p-5 shadow-lg"
            >
              <h3 className="text-base font-bold text-field-ink">Reset Kata Sandi</h3>
              <div>
                <label htmlFor="reset-pass" className="mb-1 block text-xs font-semibold text-field-muted">
                  Kata Sandi Baru (minimal 6 karakter)
                </label>
                <input
                  id="reset-pass"
                  type="password"
                  minLength={6}
                  required
                  autoFocus
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  className="min-h-[44px] w-full rounded-md border border-field-border px-3 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setResetUserId(null)}
                  className="min-h-[44px] rounded-md border border-field-border bg-field-bg px-4 text-sm font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] rounded-md bg-field-accent px-4 text-sm font-semibold text-white"
                >
                  Simpan Sandi
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </AppShell>
  );
}
