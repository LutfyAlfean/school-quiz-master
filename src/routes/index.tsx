import { SchoolHeader } from "@/components/SchoolHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link, createFileRoute } from "@tanstack/react-router";
import { BookOpenCheck, ShieldCheck, Sparkles, Link2 } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SMK Harapan Bangsa Quiz — Ujian & Latihan Digital" },
      {
        name: "description",
        content:
          "Buat kuis pilihan ganda dengan bantuan AI, bagikan tautannya ke siswa, dan pastikan setiap perangkat hanya bisa mengerjakan sekali.",
      },
      { property: "og:title", content: "SMK Harapan Bangsa Quiz" },
      {
        property: "og:description",
        content: "Kuis digital sekolah: dibuat dengan AI, dibagikan lewat tautan, sekali kerjakan.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: Sparkles,
    title: "Dibantu AI",
    text: "Tempel materi pelajaran, AI menyusun soal pilihan ganda beserta pembahasannya.",
  },
  {
    icon: Link2,
    title: "Tautan khusus",
    text: "Setiap kuis punya alamat sendiri, cukup bagikan tautannya ke siswa.",
  },
  {
    icon: ShieldCheck,
    title: "Sekali kerjakan",
    text: "Satu perangkat dan satu nama+kelas hanya bisa mengerjakan kuis satu kali.",
  },
  {
    icon: BookOpenCheck,
    title: "Nilai otomatis",
    text: "Hasil siswa langsung terekam lengkap dengan nilai dan waktu pengerjaan.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <SchoolHeader
        actions={
          <Button asChild variant="secondary">
            <Link to="/auth">Masuk Admin</Link>
          </Button>
        }
      />

      <main>
        <section className="bg-school-gradient paper-grid text-primary-foreground">
          <div className="mx-auto max-w-6xl px-4 py-20 text-center">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary-foreground/70">
              Ujian digital sekolah
            </p>
            <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-bold sm:text-5xl">
              Bikin kuis sekolah dalam hitungan menit, bagikan satu tautan saja
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-primary-foreground/80">
              Guru menyusun soal dengan bantuan AI, siswa cukup memasukkan nama dan kelas. Tidak
              perlu akun siswa, tidak bisa dikerjakan dua kali dari perangkat yang sama.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="bg-accent-gradient text-accent-foreground">
                <Link to="/auth">Masuk sebagai admin / guru</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <Card key={f.title} className="border-border/70 shadow-soft">
                <CardContent className="pt-6">
                  <span className="inline-flex size-11 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                    <f.icon className="size-5" />
                  </span>
                  <h2 className="mt-4 text-lg font-semibold">{f.title}</h2>
                  <p className="mt-2 text-sm text-muted-foreground">{f.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 pb-20 text-center">
          <h2 className="text-2xl font-semibold">Siswa punya tautan kuis?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Buka tautan yang diberikan guru, lalu isi nama dan kelas untuk mulai mengerjakan.
          </p>
        </section>
      </main>

      <footer className="border-t bg-card py-6 text-center text-sm text-muted-foreground">
        SMK Harapan Bangsa Quiz
      </footer>
    </div>
  );
}
