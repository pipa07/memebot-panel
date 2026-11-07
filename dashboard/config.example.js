// Copiá este archivo sobre config.js antes de publicar el tablero.
// config.js no se commitea. La anon key pública ya está en el deploy de
// https://memebot-black.vercel.app/config.js — reutilizá esa, no una service role.
// El secreto es el token que se tipea al entrar. No pongas la service role key acá.
window.MEMEBOT_CONFIG = {
  supabaseUrl: "https://TU_PROYECTO.supabase.co",
  supabaseAnonKey: "TU_ANON_KEY",
};
