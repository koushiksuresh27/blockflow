// @ts-ignore: Deno imports are not recognized by the default Node/React TypeScript config
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// @ts-ignore
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
// @ts-ignore
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req: Request) => {
  try {
    // Note: In production, verify the Authorization header if not using pg_cron internally
    
    console.log("Starting SLA check...");

    // 1. Process Overdue Complaints -> Escalate
    const { data: overdue, error: overdueErr } = await supabase
      .from("complaints")
      .select("id, status")
      .not("status", "in", "('closed', 'verified', 'escalated', 'resolved')")
      .lt("sla_deadline", new Date().toISOString());

    if (overdueErr) throw overdueErr;

    console.log(`Found ${overdue?.length || 0} overdue complaints to escalate.`);

    if (overdue && overdue.length > 0) {
      for (const complaint of overdue) {
        // Update status
        await supabase
          .from("complaints")
          .update({ status: "escalated", updated_at: new Date().toISOString() })
          .eq("id", complaint.id);

        // Insert log (using a hardcoded system UUID or null if actor_id allows null, 
        // assuming we can omit actor_id or need a system actor)
        // If actor_id is required, ideally use a specific system user UUID, 
        // but for now we'll attempt to insert without actor_id if possible,
        // or just rely on service role. 
        // *Assuming actor_id is nullable in complaint_logs*
        await supabase.from("complaint_logs").insert({
          complaint_id: complaint.id,
          action: "auto_escalated",
          old_status: complaint.status,
          new_status: "escalated",
          note: "Automated SLA escalation due to deadline breach."
        });
      }
    }

    // 2. Process Warning Zone (SLA deadline within 2 hours)
    const now = new Date();
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    const { data: warnings, error: warningErr } = await supabase
      .from("complaints")
      .select("id, title, society_id, status")
      .not("status", "in", "('closed', 'verified', 'escalated', 'resolved')")
      .gte("sla_deadline", now.toISOString())
      .lte("sla_deadline", twoHoursFromNow.toISOString());

    if (warningErr) throw warningErr;

    console.log(`Found ${warnings?.length || 0} complaints in warning zone.`);

    if (warnings && warnings.length > 0) {
      // For each warning, find admins of that society to notify
      // To avoid spamming, we could check if a warning notification was already sent,
      // but for simplicity, we'll insert it. 
      // A robust system would check the `notifications` table to avoid duplicates.
      for (const complaint of warnings) {
        // Check if a warning already exists for this complaint
        const { data: existingWarning } = await supabase
          .from("notifications")
          .select("id")
          .eq("complaint_id", complaint.id)
          .eq("type", "sla_warning")
          .limit(1);

        if (existingWarning && existingWarning.length > 0) continue;

        // Get admins
        const { data: admins } = await supabase
          .from("users")
          .select("id")
          .eq("society_id", complaint.society_id)
          .in("role", ["admin", "super_admin"]);

        if (admins) {
          const notificationsToInsert = admins.map((admin: { id: string }) => ({
            recipient_id: admin.id,
            complaint_id: complaint.id,
            type: "sla_warning",
            title: "SLA Deadline Approaching",
            body: `Complaint "${complaint.title}" is due within 2 hours.`
          }));

          if (notificationsToInsert.length > 0) {
            await supabase.from("notifications").insert(notificationsToInsert);
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, escalated: overdue?.length, warned: warnings?.length }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error("SLA Check failed:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
