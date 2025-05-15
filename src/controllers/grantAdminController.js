const supabase = require('../config/supabase');

const grantAdminController = async (req, res) => {
  // get jwt token
  const token =
    req.cookies.session || req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
  console.error('Supabase getUser error:', userError);
  return res.status(401).json({ error: 'Authentication failed', details: userError });
}

  const { data: userData, error: dbError } = await supabase
  .from('users')
  .select('role')
  .eq('email', user.email)
  .single();

  if (dbError || !userData || userData.role !== 'admin') {
    return res.status(403).json({
      error: 'Only logged-in admin can grant admin status',
    });
  }

  const { targetUserId } = req.body;

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', targetUserId)
    .single();

  console.log(`debugger: ${targetUserId}`)
  console.log(`debugger: ${data}`)

  // handle error
  if (error){
    return res.status(401).json({
      error: "cannot find the user",
      detail: error
    });
  }

  // handle that user is found 
  if (!data) {
    return res.status(404).json({
      error: "User not found"
    });
  }

  // if the target user is already superadmin or admin we don't update
  // we only update their role if role == volunteer
  if (data.role != "volunteer"){
    return res.status(401).json({
      error: `Failed to update user to Admin. The user is already a(n) ${data.role}`
    });
  }

  // update the role
  const { grantStatusReturnData, grantStatusError } = await supabase
    .from('users')
    .update({ role: "admin" })
    .match({ id: targetUserId })
  
  // handle error with updating the role
  if (grantStatusError){
    return res.status(401).json({
      error: `failed to update status: ${grantStatusError}`
    })
  }

  // successfully updated role to admin
  return res.status(200).json({
    result: "successfully updated user role to admin",
    detail: grantStatusReturnData
  })

}

module.exports = {grantAdminController}