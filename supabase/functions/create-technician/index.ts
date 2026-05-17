// @ts-ignore: Deno imports are not recognized by the default Node/React TypeScript config
import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// @ts-ignore
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
// @ts-ignore
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { email, name, phone, specializations, society_id } = await req.json();

    if (!email || !name) {
      throw new Error("Email and Name are required.");
    }

    // 1. Create auth user
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password: crypto.randomUUID(), // Secure random password
      email_confirm: true,
    });

    if (authErr || !authData.user) {
      throw new Error(authErr?.message || "Failed to create auth user.");
    }

    const newUserId = authData.user.id;

    // 2. Insert into public.users
    const { error: userErr } = await supabase.from('users').insert({
      id: newUserId,
      name: name,
      phone: phone || null,
      role: 'technician',
      society_id: society_id || null,
    });

    if (userErr) throw new Error(`User insert error: ${userErr.message}`);

    // 3. Insert into public.technicians
    const { data: techData, error: techErr } = await supabase.from('technicians').insert({
      user_id: newUserId,
      society_id: society_id || null,
      specializations: specializations || [],
    }).select('id').single();

    if (techErr) throw new Error(`Technician insert error: ${techErr.message}`);

    return new Response(JSON.stringify({ success: true, technician_id: techData.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
