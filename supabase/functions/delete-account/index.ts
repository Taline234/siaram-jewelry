// Supabase Edge Function entry point; the code lives in ../_shared/handlers/delete-account.mjs.
import handler from '../_shared/handlers/delete-account.mjs';
import { withCors } from '../_shared/http.mjs';

Deno.serve(withCors(handler));
