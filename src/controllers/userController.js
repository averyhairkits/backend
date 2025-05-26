const supabase = require('../config/supabase');

const userController = {
  async getAllUsers(req, res) {
    try {
      const { data: users, error } = await supabase
        .from('users')
        .select('id, email, firstname, lastname, created_at');

      if (error) {
        console.error('Error fetching users:', error);
        return res.status(400).json({ error: error.message });
      }

      return res.status(200).json(users);
    } catch (err) {
      console.error('Unexpected error in getAllUsers:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },
};

module.exports = userController;
