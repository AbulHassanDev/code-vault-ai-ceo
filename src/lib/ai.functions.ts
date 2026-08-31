import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ChatInput = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(8000) }))
    .min(1)
    .max(30),
  agentKey: z.string().max(40).optional(),
});

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Forbidden: founder/admin access required.");
}

export const aiChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ChatInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { runCeoChat } = await import("./ai-engine.server");
    const result = await runCeoChat({
      supabase,
      userId,
      messages: data.messages,
      agentKey: data.agentKey ?? "CEO",
    });
    return { text: result.text, blocked: result.blocked ?? false };
  });

export const decideApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        approvalId: z.string().uuid(),
        decision: z.enum(["approve", "reject"]),
        note: z.string().max(1000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { executeApproval, logActivity } = await import("./ai-engine.server");

    const { data: approval } = await supabase
      .from("ai_approvals")
      .select("id,status,expires_at,tool_name")
      .eq("id", data.approvalId)
      .maybeSingle();
    if (!approval) return { ok: false, message: "Approval not found." };
    if (approval.status !== "pending") return { ok: false, message: `Already ${approval.status}.` };
    if (new Date(approval.expires_at).getTime() < Date.now()) {
      await supabase.from("ai_approvals").update({ status: "expired" }).eq("id", data.approvalId);
      return { ok: false, message: "This approval expired. Ask the AI to propose it again." };
    }

    const status = data.decision === "approve" ? "approved" : "rejected";
    await supabase
      .from("ai_approvals")
      .update({
        status,
        decided_by: userId,
        decided_at: new Date().toISOString(),
        decision_note: data.note ?? null,
      })
      .eq("id", data.approvalId);

    await logActivity(supabase, {
      agent_key: "CEO",
      action: `approval_${status}`,
      tool_name: approval.tool_name,
      approval_id: approval.id,
      result: status,
    });

    // Learn from the decision.
    await supabase.from("ai_memory").insert({
      kind: "decision",
      source: "founder_instruction",
      title: `Founder ${status}: ${approval.tool_name}`,
      content: data.note ? `${status} — ${data.note}` : `Founder ${status} the proposal ${approval.tool_name}.`,
      confirmed: true,
    });

    if (data.decision === "reject") return { ok: true, message: "Proposal rejected." };
    const outcome = await executeApproval(supabase, userId, data.approvalId);
    return outcome;
  });

export const updateAiSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        ai_enabled: z.boolean().optional(),
        paused: z.boolean().optional(),
        emergency_stop: z.boolean().optional(),
        auto_apply_low_risk_seo: z.boolean().optional(),
        daily_budget_cents: z.number().int().min(0).max(100000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const patch: Record<string, unknown> = { ...data, updated_at: new Date().toISOString() };
    if (data.paused === false) patch["pause_reason"] = null;
    const { error } = await supabase.from("ai_settings").update(patch).eq("id", true);
    if (error) throw new Error(error.message);
    await supabase.from("ai_activity_logs").insert({
      agent_key: "CEO",
      action: "settings_updated",
      input_summary: JSON.stringify(data),
      result: "success",
    });
    return { ok: true };
  });

export const toggleAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ key: z.string(), enabled: z.boolean() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { error } = await supabase.from("ai_agents").update({ enabled: data.enabled }).eq("key", data.key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Runs the daily operating loop on demand from the command center. */
export const runDailyLoop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { runDailyOperatingLoop } = await import("./ai-daily.server");
    return runDailyOperatingLoop(supabase, userId);
  });
