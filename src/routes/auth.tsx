import { SchoolMark } from "@/components/SchoolHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_EMAIL, ensureAdminAccount } from "@/lib/admin.functions";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Masuk — SMK Harapan Bangsa Quiz" },
      {
        name: "description",
        content: "Halaman masuk admin dan guru untuk mengelola kuis SMK Harapan Bangsa.",
      },
      { property: "og:title", content: "Masuk — SMK Harapan Bangsa Quiz" },
      { property: "og:description", content: "Masuk untuk mengelola kuis sekolah." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [identity, setIdentity] = useState("admin");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
    void ensureAdminAccount({ data: undefined }).catch(() => undefined);
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const email = identity.includes("@")
        ? identity.trim()
        : identity.trim().toLowerCase() === "admin"
          ? ADMIN_EMAIL
          : `${identity.trim().toLowerCase()}@harapanbangsa.sch.id`;

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error("Gagal masuk", { description: "Nama pengguna atau kata sandi salah." });
        return;
      }
      toast.success("Berhasil masuk");
      navigate({ to: "/dashboard", replace: true });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-school-gradient paper-grid px-4 py-12">
      <Card className="w-full max-w-md shadow-card">
        <CardHeader className="items-center text-center">
          <SchoolMark size={56} />
          <CardTitle className="mt-3 text-2xl">SMK Harapan Bangsa Quiz</CardTitle>
          <CardDescription>Masuk sebagai admin atau guru</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="identity">Nama pengguna atau email</Label>
              <Input
                id="identity"
                value={identity}
                onChange={(e) => setIdentity(e.target.value)}
                placeholder="admin"
                autoComplete="username"
                required
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Kata sandi</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                maxLength={100}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Memproses..." : "Masuk"}
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Akun siswa tidak diperlukan — siswa cukup membuka tautan kuis.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
