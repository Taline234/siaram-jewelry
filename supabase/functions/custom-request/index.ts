// Supabase Edge Function entry point; the code lives in ../_shared/handlers/custom-request.mjs.
import handler from '../_shared/handlers/custom-request.mjs';
import { withCors } from '../_shared/http.mjs';

Deno.serve(withCors(handler));
