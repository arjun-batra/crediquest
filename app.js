// Initialize Supabase
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'your_supabase_url'; // Replace with your Supabase URL
const supabaseKey = 'your_supabase_key'; // Replace with your Supabase key
const supabase = createClient(supabaseUrl, supabaseKey);

// Error handling and logging
supabase
  .from('rewards')
  .select('*')
  .then(response => {
    if (response.error) {
      console.error('Error loading rewards:', response.error);
      return;
    }
    loadRewards(response.data);
  });

// Call loadRewards after ensuring Supabase is properly initialized
function loadRewards(data) {
    // Process and display rewards
}
