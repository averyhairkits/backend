const supabase = require('../config/supabase');

const newRequestController = async (req, res) => {
  const { slots } = req.body;

  //check format of request
  if (!slots || !Array.isArray(slots)) {
    return res.status(400).json({ error: 'Invalid slots format' });
  }
  // get the user who made this request
  // const user = supabase.auth.user()
  const results = [];

  for (let i = 0; i < slots.length; i++) {
    const result = await helper(slots[i].time, slots[i].numPeople);
    results.push(result);
  }

  res.status(200).json({ results });
};

const helper = async (reqTimeStamp, request_size) => {
  try {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToSunday = dayOfWeek === 0 ? 0 : -1 * dayOfWeek;
    const thisWeekSunday = new Date(now);
    thisWeekSunday.setDate(now.getDate() + diffToSunday);

    const requestedDate = new Date(reqTimeStamp);

    if ((requestedDate - thisWeekSunday) / (1000 * 60 * 60 * 24) >= 21) {
      return { error: 'Cannot register more than 3 weeks out', time: reqTimeStamp };
    }

    const { data, error: searchError } = await supabase
      .from('slots')
      .select('*')
      .eq('slot_time', reqTimeStamp);

    if (searchError) return { error: searchError.message, time: reqTimeStamp };

    if (data.length === 0) {
      const newRequest = {
        created_at: new Date().toISOString(),
        slot_time: new Date(reqTimeStamp).toISOString(),
        week_start_date: thisWeekSunday.toISOString(),
        current_size: request_size,
        status: "waiting",
      };

      const { data: insertData, error: insertError } = await supabase
        .from('slots')
        .insert([newRequest]);

      if (insertError) return { error: insertError.message, time: reqTimeStamp };

      return { message: 'Slot created', slot_info: insertData };
    }

    const slot = data[0];

    if ((request_size + slot.current_size) > 6) {
      return {
        error: `Too many volunteers for ${reqTimeStamp}. Current size: ${slot.current_size}`,
        time: reqTimeStamp,
      };
    }

    if (slot.status === "rejected") {
      return {
        error: `Time slot ${reqTimeStamp} was rejected.`,
        time: reqTimeStamp,
      };
    }

    const { data: updatedData, error: updateError } = await supabase
      .from('slots')
      .update({ current_size: slot.current_size + request_size })
      .match({ slot_time: reqTimeStamp });

    if (updateError) return { error: updateError.message, time: reqTimeStamp };

    return { message: 'Slot updated', slot_info: updatedData };
  } catch (err) {
    return { error: err.message, time: reqTimeStamp };
  }
};

const approveRequestController = async (req, res) => {
  const { reqTimeStampList } = req.body;

  for (let i = 0; i < reqTimeStampList.length; i++){
    approveRequestHelper(reqTimeStampList[i], req, res);
  }
}

const rejectRequestController = async (req, res) => {
  const { reqTimeStampList } = req.body;
  // update the status field

  for (let i = 0; i < reqTimeStampList.length; i++){
    rejectRequestHelper(reqTimeStampList[i], req, res);
  }
}

const approveRequestHelper = async (reqTimeStamp, req, res) => {
  
  const token =
    req.cookies.session || req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // get the user who made this request
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return res.status(401).json({ error: 'Authentication failed' });
  }

  const { data: userData, error: dbError } = await supabase
  .from('users')
  .select('role')
  .eq('email', user.email)
  .single();

  if (dbError || !userData || userData.role !== 'admin') {
    return res.status(403).json({
      error: 'Only logged-in admins can approve a time slot',
    });
  }

  // update the status field
  const { approveStatusReturnData, updateStatusError } = await supabase
    .from('slots')
    .update({ status: "approved" })
    .match({ slot_time: reqTimeStamp })
  
  // handle potential error with approving time slot status
  if (updateStatusError) {
    return res.status(400).json({
      error: updateStatusError
    })
  }
  // successfully approved a time slot
  return res.status(200).json({
    message: `successfully updated time slot (${reqTimeStamp}) status from waiting to approved`,
    return_data: approveStatusReturnData
  })
}

const rejectRequestHelper = async (reqTimeStamp, req, res) => {

  const token =
    req.cookies.session || req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // get the user who made this request
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return res.status(401).json({ error: 'Authentication failed' });
  }

  const { data: userData, error: dbError } = await supabase
  .from('users')
  .select('role')
  .eq('email', user.email)
  .single();

  if (dbError || !userData || userData.role !== 'admin') {
    return res.status(403).json({
      error: 'Only logged-in admins can reject a time slot',
    });
  }

  const { rejectStatusReturnData, rejectStatusError } = await supabase
    .from('slots')
    .update({ status: "rejected" })
    .match({ slot_time: reqTimeStamp })
  // handle potential error with approving time slot status
  if (rejectStatusError) {
    return res.status(400).json({
      error: rejectStatusError
    })
  }
  // updated status from waiting to rejected
  return res.status(200).json({
    message: `successfully updated time slot (${reqTimeStamp}) status from waiting to rejected`,
    return_data: rejectStatusReturnData
  })
}

module.exports = { newRequestController, approveRequestController, rejectRequestController }
