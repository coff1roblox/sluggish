/*
  Settings for this deployment. Fill these in from Supabase > Project Settings > API.
  Both values are safe to publish. Never put the service_role / secret key here.

  Leave supabaseUrl empty to run in demo mode: pages load the snapshots in /demo/
  instead of the database (useful before Supabase is set up).
*/
window.CP_CONFIG = {
  platformName: 'Café Platform',
  supabaseUrl: '',      // e.g. 'https://abcdefgh.supabase.co'
  supabaseAnonKey: '',  // the anon / publishable key
};
