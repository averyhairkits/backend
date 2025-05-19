const supabase = require('../config/supabase');


//handles when an admin approves a list of pending time slots
const approveRequestController = async (req, res) => {
  const { title, start, end, description, volunteers, created_by  } = req.body;

  if (!start || !end) {
    return res.status(400).json({ error: 'Missing start or end time' });
  }

  const { data, error } = await supabase
    .from('sessions')
    .insert([
      {
        title,
        description,
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
        status: 'confirmed',
        created_by: created_by,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Supabase insert error:', error);
    return res.status(500).json({
      error: 'Database insert failed',
      details: error.message,});
  }

  return res.status(200).json({ message: 'Confirmed time block saved from backend', session: data });
};


const cancelRequestController = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'Missing session ID' });
  }

  const { error } = await supabase
    .from('sessions')
    .update({ status: 'cancelled' })
    .eq('id', id);

  if (error) {
    return res.status(500).json({
      error: 'Failed to cancel session',
      details: error.message,
    });
  }

  return res.status(200).json({ message: 'Session status updated to cancelled' });
};

module.exports = { 
  approveRequestController,
  cancelRequestController,
};





// //handles when an admin rejects a list of pending time slots
// const rejectRequestController = async (req, res) => {
//   const { reqTimeStampList } = req.body;
//   // update the status field

//   for (let i = 0; i < reqTimeStampList.length; i++) {
//     rejectRequestHelper(reqTimeStampList[i], req, res);
//   }
// };


// //helper to reject a time slot - admin only
// const rejectRequestHelper = async (reqTimeStamp, req, res) => {
//   const token = req.cookies.session || req.headers.authorization?.split(' ')[1];

//   if (!token) {
//     return res.status(401).json({ error: 'Not authenticated' });
//   }

//   // get the user who made this request
//   const {
//     data: { user },
//     error: userError,
//   } = await supabase.auth.getUser(token);

//   if (userError || !user) {
//     return res.status(401).json({ error: 'Authentication failed' });
//   }

//   const { data: userData, error: dbError } = await supabase
//     .from('users')
//     .select('role')
//     .eq('email', user.email)
//     .single();

//   if (dbError || !userData || userData.role !== 'admin') {
//     return res.status(403).json({
//       error: 'Only logged-in admins can reject a time slot',
//     });
//   }

//   const { rejectStatusReturnData, rejectStatusError } = await supabase
//     .from('slots')
//     .update({ status: 'rejected' })
//     .match({ slot_time: reqTimeStamp });
//   // handle potential error with approving time slot status
//   if (rejectStatusError) {
//     return res.status(400).json({
//       error: rejectStatusError,
//     });
//   }
//   // updated status from waiting to rejected
//   return res.status(200).json({
//     message: `successfully updated time slot (${reqTimeStamp}) status from waiting to rejected`,
//     return_data: rejectStatusReturnData,
//   });
// };

// // Helper function to calculate Monday of the current week and the next 3 weeks
// const getWeekStartDate = (date) => {
//   const dayOfWeek = date.getDay();
//   const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
//   const monday = new Date(date);
//   monday.setDate(monday.getDate() + diffToMonday);
//   monday.setHours(0, 0, 0, 0);
//   return monday;
// };


// module.exports = {
//   approveRequestController,
//   rejectRequestController,
// };