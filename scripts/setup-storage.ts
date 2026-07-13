import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

import { createSupabaseAdmin } from "../src/lib/supabase/server";
import { supabaseConfig } from "../src/config/storage";

async function setupBuckets() {
  const supabase = createSupabaseAdmin();
  const buckets = Object.values(supabaseConfig.buckets);

  for (const bucket of buckets) {
    const { data: existing } = await supabase.storage.getBucket(bucket);
    if (existing) {
      console.log(`✓ Bucket "${bucket}" already exists`);
      continue;
    }

    const { error } = await supabase.storage.createBucket(bucket, {
      public: true,
    });

    if (error) {
      console.error(`✗ Failed to create bucket "${bucket}":`, error.message);
    } else {
      console.log(`✓ Created bucket "${bucket}"`);
    }
  }
}

setupBuckets().catch(console.error);
