import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

interface WhatsAppPayload {
  technicianPhone: string;
  technicianName: string;
  complaintTitle: string;
  complaintDescription: string;
  flatLocation: string;
  priority: string;
  slaDeadline: string;
}

const priorityEmoji: Record<string, string> = {
  critical: "🚨",
  high: "🔴",
  medium: "🟡",
  low: "🟢",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Read env variables
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const fromNumber = Deno.env.get("TWILIO_WHATSAPP_FROM");

    if (!accountSid || !authToken || !fromNumber) {
      return new Response(
        JSON.stringify({ error: "Missing Twilio environment variables." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const payload: WhatsAppPayload = await req.json();
    const {
      technicianPhone,
      technicianName,
      complaintTitle,
      complaintDescription,
      flatLocation,
      priority,
      slaDeadline,
    } = payload;

    if (!technicianPhone || !complaintTitle || !priority) {
      return new Response(
        JSON.stringify({ error: "Missing required fields in payload." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emoji = priorityEmoji[priority.toLowerCase()] ?? "⚪";

    // Build the WhatsApp message body
    const messageBody = [
      `🔧 *New Task Assigned — BlockFlow*`,
      ``,
      `*Complaint:* ${complaintTitle}`,
      `*Location:* ${flatLocation}`,
      `*Priority:* ${emoji} ${priority}`,
      `*SLA Deadline:* ${slaDeadline}`,
      ``,
      `*Details:* ${complaintDescription}`,
      ``,
      `Please open the BlockFlow app to accept or decline.`,
    ].join("\n");

    // Encode Basic Auth credentials
    const credentials = btoa(`${accountSid}:${authToken}`);

    // Build form-encoded body for Twilio API
    const formData = new URLSearchParams();
    formData.append("From", `whatsapp:${fromNumber}`);
    formData.append("To", `whatsapp:${technicianPhone}`);
    formData.append("Body", messageBody);

    // Call Twilio Messages API
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error("Twilio error:", twilioData);
      return new Response(
        JSON.stringify({
          error: twilioData.message ?? "Failed to send WhatsApp message.",
          details: twilioData,
        }),
        { status: twilioResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`WhatsApp sent to ${technicianName} (${technicianPhone}), SID: ${twilioData.sid}`);

    return new Response(
      JSON.stringify({ success: true, messageSid: twilioData.sid }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unexpected error occurred." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
