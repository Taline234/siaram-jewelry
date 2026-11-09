// Supabase Edge Function entry point; the code lives in ../_shared/handlers/courier-cancel.mjs.
import handler from '../_shared/handlers/courier-cancel.mjs';
import { withCors } from '../_shared/http.mjs';

Deno.serve(withCors(handler));
