// Supabase Edge Function entry point; the code lives in ../_shared/handlers/check-voucher.mjs.
import handler from '../_shared/handlers/check-voucher.mjs';
import { withCors } from '../_shared/http.mjs';

Deno.serve(withCors(handler));
