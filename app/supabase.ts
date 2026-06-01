import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://hmjqisumcwvtqajyhnzw.supabase.co";

const supabaseKey =
  "sb_publishable_yzLqkgk9xTG3neF-zhbRBg_U1E20Ph8";

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);