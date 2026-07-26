import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

import { createSupabaseAdmin } from "../src/lib/supabase/server";
import { supabaseConfig } from "../src/config/storage";

/**
 * Provision Supabase Storage buckets as PRIVATE.
 * The app hands out short-lived signed URLs from `src/lib/supabase/storage.ts`
 * (see SIGNED_URL_TTL_SECONDS) — public buckets would bypass the auth checks
 * that gate GET/POST routes.
 *
 * NOTE: any buckets that already exist as public in the Supabase dashboard
 * must be flipped to private manually — the JS client cannot toggle
 * `public` on an existing bucket via createBucket. Use
 * `supabase.storage.updateBucket(name, { public: false })` or the dashboard.
 */
async function setupBuckets() {
  const supabase = createSupabaseAdmin();
  const buckets = Object.values(supabaseConfig.buckets);

  for (const bucket of buckets) {
    const { data: existing } = await supabase.storage.getBucket(bucket);
    if (existing) {
      if (existing.public) {
        const { error: updateError } = await supabase.storage.updateBucket(
          bucket,
          { public: false }
        );
        if (updateError) {
          console.warn(
            `! Bucket "${bucket}" is PUBLIC — failed to flip private automatically: ${updateError.message}. Flip it in the Supabase dashboard.`
          );
        } else {
          console.log(`↺ Bucket "${bucket}" flipped to private`);
        }
      } else {
        console.log(`✓ Bucket "${bucket}" already exists (private)`);
      }
      continue;
    }

    const { error } = await supabase.storage.createBucket(bucket, {
      public: false,
    });

    if (error) {
      console.error(`✗ Failed to create bucket "${bucket}":`, error.message);
    } else {
      console.log(`✓ Created bucket "${bucket}" (private)`);
    }
  }
}

setupBuckets().catch(console.error);
