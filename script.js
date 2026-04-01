import { createClient } from "https://esm.sh/@supabase/supabase-js";

const supabaseUrl = "https://pyoiawasdbkiifrpzrjd.supabase.co";
const supabaseKey = "sb_publishable_K29_2-qfcStEZOOMv7bksA_d238a-kN"; 
const supabase = createClient(supabaseUrl, supabaseKey);

makeMove();

async function makeMove() {
  const { data, error } = await supabase.from("Game").select("currentPlayer");
  console.log(data[0].currentPlayer);
}