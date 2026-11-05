// Supabase Edge Function entry point; the code lives in ../_shared/handlers/newsletter-unsubscribe.mjs.
import handler from '../_shared/handlers/newsletter-unsubscribe.mjs';
import { withCors } from '../_shared/http.mjs';

Deno.serve(withCors(handler));
