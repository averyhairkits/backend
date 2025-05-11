const supabase = require('../config/supabase');

const newRequestController = async (req, res) => {
  const { reqTimeStampList, request_size, user_id } = req.body;

  console.log("here is request Time stamp list", reqTimeStampList);
  console.log("here is request size", request_size);
  console.log("here is userid", user_id);

  try {
    const results = await Promise.all(
      reqTimeStampList.map(async (timestamp) => {
        try {
          const result = await newRequestHelper(timestamp, request_size, user_id);
          return { timestamp, status: 'ok', result };
        } catch (err) {
          return { timestamp, status: 'error', error: err.message };
        }
      })
    );

    return res.status(200).json({
      message: 'Processed all slot submissions',
      results,
    });

  } catch (error) {
    return res.status(500).json({
      error: 'Unexpected failure in processing slots',
      details: error.message,
    });
  }
};


//handles when an admin approves a list of pending time slots
const approveRequestController = async (req, res) => {
  const { reqTimeStampList } = req.body;

  for (let i = 0; i < reqTimeStampList.length; i++) {
    approveRequestHelper(reqTimeStampList[i], req, res);
  }
};

//handles when an admin rejects a list of pending time slots
const rejectRequestController = async (req, res) => {
  const { reqTimeStampList } = req.body;
  // update the status field

  for (let i = 0; i < reqTimeStampList.length; i++) {
    rejectRequestHelper(reqTimeStampList[i], req, res);
  }
};



//helper for processing new time slot submission from volunteer
const newRequestHelper = async (reqTimeStamp, request_size, userid, res) => {
  const requestedDate = new Date(reqTimeStamp);

  const weekStart = getWeekStartDate(requestedDate);

  //reject if more than 3 weeks ahead from this week's Monday
  const today = new Date();
  const todayWeekStart = getWeekStartDate(today);
  const maxDate = new Date(todayWeekStart);
  maxDate.setDate(maxDate.getDate() + 21);

  if (requestedDate > maxDate) {
    throw new Error('Cannot register more than 3 weeks ahead');
  }

  // search to see whether this time slot exists or not
  const { data, error: searchError } = await supabase
    .from('slots')
    .select('*')
    .eq('slot_time', reqTimeStamp);

  if (searchError) throw new Error(searchError.message);

  if (data.length === 0) {
    const newRequest = {
      created_at: new Date().toISOString(),
      slot_time: new Date(reqTimeStamp).toISOString(),
      week_start_date: weekStart.toISOString().split('T')[0],
      current_size: request_size,
      status: 'waiting',
      user_id: userid,
    };

    const { data: slotReturnInfo, error: createRequestError } = await supabase
      .from('slots')
      .insert([newRequest]);

    if (createRequestError) {
      throw new Error(createRequestError.message);
    }
    return { status: 'inserted', time: reqTimeStamp };
  }

  const existing = data[0];

  if (existing.status === 'rejected') {
    throw new Error(`Slot ${reqTimeStamp} is unavailable.`);
  }

  if (existing.current_size + request_size > 6) {
    throw new Error(`Slot ${reqTimeStamp} exceeds max volunteers.`);
  }

  const { error: updateError } = await supabase
    .from('slots')
    .update({ current_size: existing.current_size + request_size })
    .match({ slot_time: reqTimeStamp });

  if (updateError) throw new Error(updateError.message);

  return { status: 'updated', time: reqTimeStamp };
};



//handles approving a time slot - admin only
const approveRequestHelper = async (reqTimeStamp, req, res) => {
  //retrieve token from cookie or auth header
  const token = req.cookies.session || req.headers.authorization?.split(' ')[1];

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
    .update({ status: 'approved' })
    .match({ slot_time: reqTimeStamp });

  // handle potential error with approving time slot status
  if (updateStatusError) {
    return res.status(400).json({
      error: updateStatusError,
    });
  }
  // successfully approved a time slot
  return res.status(200).json({
    message: `successfully updated time slot (${reqTimeStamp}) status from waiting to approved`,
    return_data: approveStatusReturnData,
  });
};

//helper to reject a time slot - admin only
const rejectRequestHelper = async (reqTimeStamp, req, res) => {
  const token = req.cookies.session || req.headers.authorization?.split(' ')[1];

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
    .update({ status: 'rejected' })
    .match({ slot_time: reqTimeStamp });
  // handle potential error with approving time slot status
  if (rejectStatusError) {
    return res.status(400).json({
      error: rejectStatusError,
    });
  }
  // updated status from waiting to rejected
  return res.status(200).json({
    message: `successfully updated time slot (${reqTimeStamp}) status from waiting to rejected`,
    return_data: rejectStatusReturnData,
  });
};

// Helper function to calculate Monday of the current week and the next 3 weeks
const getWeekStartDate = (date) => {
  const dayOfWeek = date.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(date);
  monday.setDate(monday.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
};


// Helper function to get the next 3 weeks' slots
const getSlotsController = async (req, res) => {
  try {
    // Get the current date
    const currentDate = new Date();

    // Get the week_start_date for the current week (Monday of this week)
    const currentWeekStart = getWeekStartDate(currentDate);

    // Calculate the next 3 weeks' start dates (Mondays)
    let weekStartDates = [currentWeekStart];
    for (let i = 1; i <= 3; i++) {
      let nextWeekStart = new Date(currentWeekStart);
      // Add 7 days for the next Monday
      nextWeekStart.setDate(currentWeekStart.getDate() + i * 7);
      weekStartDates.push(nextWeekStart);
    }

    // Format the week start dates as 'yyyy-mm-dd'
    weekStartDates = weekStartDates.map(
      (date) => date.toISOString().split('T')[0]
    );

    // Fetch all slots for the next 4 weeks
    const { data: slots, error } = await supabase
      .from('slots')
      .select('*')
      .in('week_start_date', weekStartDates) // Filter by the week_start_date
      .order('week_start_date', { ascending: true }); // Sort by week_start_date

    if (error) {
      return res
        .status(500)
        .json({ error: 'Failed to fetch slots', details: error });
    }

    // Organize the slots into weeks based on week_start_date
    const groupedSlots = weekStartDates.map((date) => {
      return {
        week_start_date: date,
        slots: slots.filter((slot) => slot.week_start_date === date),
      };
    });

    // Return the structured JSON with the slots grouped by week_start_date
    res.json({ 
      weeks: groupedSlots, 
    });
  } catch (error) {
    console.error('Error fetching slots:', error);
    res.status(500).json({ error: 'Failed to fetch slots' });
  }
};

const userController = async (req, res) => {
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
  };


//gets all slots matching a certain user_id
const getUserSlotsController = async (req, res) => {
  //check for user_id in query
  const { user_id } = req.query; 
  if (!user_id) {
    return res.status(400).json({ error: 'Missing user_id in query' });
  }

  try {
    //search for slots matching user_id in order of slot_time
    const { data, error } = await supabase
      .from('slots')
      .select('*')
      .eq('user_id', user_id)
      .order('slot_time', { ascending: true });
    if (error) {
      return res.status(500).json({ error: 'Failed to fetch user slots', details: error.message });
    }

    const slotTotals = {};
    for (const slot of data) {
      const time = slot.slot_time;
      slotTotals[time] = (slotTotals[time] || 0) + slot.current_size;
    }

    const overbookedSlots = Object.entries(slotTotals)
      .filter(([_, total]) => total >= 6)
      .map(([slot_time, total_size]) => ({ slot_time, total_size }));

    const grouped = {};
    for (const slot of data) {
      const weekStart = getWeekStartDate(new Date(slot.slot_time));
      if (!grouped[weekStart]) grouped[weekStart] = [];
      grouped[weekStart].push(slot);
    }

    const groupedSlots = Object.entries(grouped).map(([week_start_date, slots]) => ({
      week_start_date,
      slots,
    }));

    return res.status(200).json({
      weeks: groupedSlots,
      summary: {
        overbookedSlots,
      },
    });
  } catch (err) {
    console.error('Unexpected error in getUserSlotsController:', err);
    return res.status(500).json({ error: 'Internal server error' });
  };
}

module.exports = {
  newRequestController,
  approveRequestController,
  rejectRequestController,
  getSlotsController,
  getUserSlotsController,
  userController
};