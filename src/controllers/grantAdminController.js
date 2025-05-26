const supabase = require('../config/supabase');

const updateRoleController = async (req, res) => {
  const { usertoupdate } = req.body;

  if (!usertoupdate || !usertoupdate.id || !usertoupdate.role) {
    return res.status(400).json({
      error: 'Invalid user object or missing role field in request',
    });
  }

  const currentRole = usertoupdate.role;
  const newRole = currentRole === 'admin' ? 'volunteer' : 'admin';

  console.log('NEWROLE', newRole);

  const { data: updatedUser, error: updateError } = await supabase
    .from('users')
    .update({ role: newRole })
    .eq('id', usertoupdate.id);

  if (updateError) {
    return res.status(500).json({
      error: 'Failed to update role',
      detail: updateError,
    });
  }

  return res.status(200).json({
    message: `User role successfully updated to ${newRole}`,
    user: updatedUser,
  });
};

module.exports = { updateRoleController };
