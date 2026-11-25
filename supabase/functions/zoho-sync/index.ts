// Supabase Edge Function entry point; the code lives in ../_shared/handlers/zoho-sync.mjs.
import handler from '../_shared/handlers/zoho-sync.mjs';
import { withCors } from '../_shared/http.mjs';

Deno.serve(withCors(handler));
