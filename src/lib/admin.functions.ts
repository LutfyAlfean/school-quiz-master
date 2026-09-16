import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const ADMIN_EMAIL = "admin@harapanbangsa.sch.id";
const ADMIN_PASSWORD = "P@ssw0rd.123456789";

function slugify(title: string) {
  const base = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base || "kuis"}-${suffix}`;
}

/** Menyiapkan akun admin bawaan satu kali saja. */
export const ensureAdminAccount = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: existing } = await supabaseAdmin
    .from("user_roles")
    .select("id")
    .eq("role", "admin")
    .limit(1);
  if (existing && existing.length > 0) return { ready: true as const };

  const created = await supabaseAdmin.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "Administrator" },
  });

  let userId = created.data.user?.id;
  if (!userId) {
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    userId = list?.users.find((u) => u.email === ADMIN_EMAIL)?.id;
  }
  if (!userId) return { ready: false as const };

  await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });

  return { ready: true as const };
});

const questionSchema = z.object({
  prompt: z.string().trim().min(3).max(1000),
  options: z.array(z.string().trim().min(1).max(300)).min(2).max(6),
  correctIndex: z.number().int().min(0).max(5),
  explanation: z.string().trim().max(1000).default(""),
});

const quizSchema = z.object({
  title: z.string().trim().min(3).max(150),
  description: z.string().trim().max(600).default(""),
  subject: z.string().trim().max(80).default(""),
  gradeLevel: z.string().trim().max(40).default(""),
  durationMinutes: z.number().int().min(1).max(240),
  published: z.boolean().default(true),
  questions: z.array(questionSchema).min(1).max(100),
});

export const getMyAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", context.userId)
      .maybeSingle();
    return {
      roles: (roles ?? []).map((r) => r.role as string),
      fullName: profile?.full_name ?? "",
      email: profile?.email ?? "",
    };
  });

export const listQuizzes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("quizzes")
      .select("id, slug, title, subject, grade_level, duration_minutes, published, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const ids = (data ?? []).map((q) => q.id);
    const counts = new Map<string, { questions: number; attempts: number }>();
    ids.forEach((id) => counts.set(id, { questions: 0, attempts: 0 }));

    if (ids.length > 0) {
      const [{ data: qs }, { data: at }] = await Promise.all([
        context.supabase.from("questions").select("quiz_id").in("quiz_id", ids),
        context.supabase.from("attempts").select("quiz_id").in("quiz_id", ids),
      ]);
      (qs ?? []).forEach((r) => {
        const c = counts.get(r.quiz_id);
        if (c) c.questions += 1;
      });
      (at ?? []).forEach((r) => {
        const c = counts.get(r.quiz_id);
        if (c) c.attempts += 1;
      });
    }

    return (data ?? []).map((q) => ({
      ...q,
      questionCount: counts.get(q.id)?.questions ?? 0,
      attemptCount: counts.get(q.id)?.attempts ?? 0,
    }));
  });

export const createQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => quizSchema.parse(raw))
  .handler(async ({ data, context }) => {
    const slug = slugify(data.title);
    const { data: quiz, error } = await context.supabase
      .from("quizzes")
      .insert({
        slug,
        title: data.title,
        description: data.description,
        subject: data.subject,
        grade_level: data.gradeLevel,
        duration_minutes: data.durationMinutes,
        published: data.published,
        created_by: context.userId,
      })
      .select("id, slug")
      .single();
    if (error) throw new Error(error.message);

    const rows = data.questions.map((q, i) => ({
      quiz_id: quiz.id,
      prompt: q.prompt,
      options: q.options,
      correct_index: Math.min(q.correctIndex, q.options.length - 1),
      explanation: q.explanation,
      order_index: i,
    }));
    const { error: qErr } = await context.supabase.from("questions").insert(rows);
    if (qErr) throw new Error(qErr.message);

    return { id: quiz.id, slug: quiz.slug };
  });

export const setQuizPublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ id: z.string().uuid(), published: z.boolean() }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("quizzes")
      .update({ published: data.published, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("quizzes").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getQuizDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { data: quiz, error } = await context.supabase
      .from("quizzes")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!quiz) throw new Error("Kuis tidak ditemukan");

    const [{ data: questions }, { data: attempts }] = await Promise.all([
      context.supabase
        .from("questions")
        .select("id, prompt, options, correct_index, explanation, order_index")
        .eq("quiz_id", data.id)
        .order("order_index", { ascending: true }),
      context.supabase
        .from("attempts")
        .select("id, student_name, student_class, score, total, created_at")
        .eq("quiz_id", data.id)
        .order("created_at", { ascending: false }),
    ]);

    return { quiz, questions: questions ?? [], attempts: attempts ?? [] };
  });

export const generateQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        material: z.string().trim().min(20).max(20000),
        count: z.number().int().min(1).max(25),
        difficulty: z.enum(["mudah", "sedang", "sulit"]),
        subject: z.string().trim().max(80).default(""),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const { generateQuestionsFromMaterial } = await import("./ai.server");
    return { questions: await generateQuestionsFromMaterial(data) };
  });

export const refineQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        prompt: z.string().trim().min(3).max(1000),
        options: z.array(z.string().max(300)).min(2).max(6),
        instruction: z.string().trim().max(400).default(""),
      })
      .parse(raw),
  )
  .handler(async ({ data }) => {
    const { improveQuestion } = await import("./ai.server");
    return { question: await improveQuestion(data) };
  });

async function assertAdmin(context: { supabase: { rpc: Function }; userId: string }) {
  const { data } = await (context.supabase as any).rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Hanya admin yang boleh melakukan tindakan ini");
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context as never);
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      context.supabase.from("profiles").select("id, full_name, email, created_at"),
      context.supabase.from("user_roles").select("user_id, role"),
    ]);
    return (profiles ?? []).map((p) => ({
      ...p,
      roles: (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role as string),
    }));
  });

export const createStaffUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        email: z.string().trim().email().max(200),
        password: z.string().min(8).max(100),
        fullName: z.string().trim().min(2).max(120),
        role: z.enum(["admin", "guru"]),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const created = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (created.error || !created.data.user) {
      throw new Error(created.error?.message ?? "Gagal membuat pengguna");
    }

    await supabaseAdmin
      .from("profiles")
      .upsert({ id: created.data.user.id, full_name: data.fullName, email: data.email });
    await supabaseAdmin
      .from("user_roles")
      .upsert(
        { user_id: created.data.user.id, role: data.role },
        { onConflict: "user_id,role" },
      );

    return { ok: true };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(["admin", "guru"]),
        enabled: z.boolean(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.enabled) {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
    } else {
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
    }
    return { ok: true };
  });
