import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const accessInput = z.object({
  slug: z.string().min(1).max(120),
  deviceId: z.string().min(8).max(80),
});

const submitInput = z.object({
  slug: z.string().min(1).max(120),
  deviceId: z.string().min(8).max(80),
  studentName: z.string().trim().min(2).max(80),
  studentClass: z.string().trim().min(1).max(40),
  answers: z
    .array(z.object({ questionId: z.string().uuid(), choice: z.number().int().min(-1).max(9) }))
    .max(200),
});

type PublicQuestion = {
  id: string;
  prompt: string;
  options: string[];
  order_index: number;
};

export const getPublicQuiz = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => accessInput.parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: quiz } = await supabaseAdmin
      .from("quizzes")
      .select("id, slug, title, description, subject, grade_level, duration_minutes, published")
      .eq("slug", data.slug)
      .maybeSingle();

    if (!quiz || !quiz.published) return { found: false as const };

    const { data: attempt } = await supabaseAdmin
      .from("attempts")
      .select("student_name, student_class, score, total, created_at")
      .eq("quiz_id", quiz.id)
      .eq("device_id", data.deviceId)
      .maybeSingle();

    const { data: rows } = await supabaseAdmin
      .from("questions")
      .select("id, prompt, options, order_index")
      .eq("quiz_id", quiz.id)
      .order("order_index", { ascending: true });

    const questions: PublicQuestion[] = (rows ?? []).map((r) => ({
      id: r.id,
      prompt: r.prompt,
      options: (r.options as string[]) ?? [],
      order_index: r.order_index,
    }));

    return {
      found: true as const,
      quiz: {
        title: quiz.title,
        description: quiz.description,
        subject: quiz.subject,
        gradeLevel: quiz.grade_level,
        durationMinutes: quiz.duration_minutes,
      },
      questions,
      finished: attempt
        ? {
            studentName: attempt.student_name,
            studentClass: attempt.student_class,
            score: attempt.score,
            total: attempt.total,
          }
        : null,
    };
  });

export const submitAttempt = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => submitInput.parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: quiz } = await supabaseAdmin
      .from("quizzes")
      .select("id, published")
      .eq("slug", data.slug)
      .maybeSingle();

    if (!quiz || !quiz.published) return { ok: false as const, reason: "not_found" as const };

    const { data: existing } = await supabaseAdmin
      .from("attempts")
      .select("id")
      .eq("quiz_id", quiz.id)
      .eq("device_id", data.deviceId)
      .maybeSingle();
    if (existing) return { ok: false as const, reason: "device_used" as const };

    const { data: questions } = await supabaseAdmin
      .from("questions")
      .select("id, correct_index")
      .eq("quiz_id", quiz.id);

    const keys = new Map((questions ?? []).map((q) => [q.id, q.correct_index]));
    let score = 0;
    for (const answer of data.answers) {
      if (keys.get(answer.questionId) === answer.choice) score += 1;
    }
    const total = keys.size;

    const { error } = await supabaseAdmin.from("attempts").insert({
      quiz_id: quiz.id,
      student_name: data.studentName,
      student_class: data.studentClass,
      device_id: data.deviceId,
      score,
      total,
      answers: data.answers,
    });

    if (error) {
      if (error.code === "23505") return { ok: false as const, reason: "identity_used" as const };
      return { ok: false as const, reason: "error" as const };
    }

    return { ok: true as const, score, total };
  });
