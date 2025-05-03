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

//gets all slots matching a certain user_id
const getUserSlotsController = async (req, res) => {
  const { user_id } = req.query;

  if (!user_id) {
    return res.status(400).json({ error: 'Missing user_id in query' });
  }

  const { data, error } = await supabase
    .from('slots')
    .select('*')
    .eq('user_id', user_id)
    .order('slot_time', { ascending: true });

  if (error) {
    return res.status(500).json({ error: 'Failed to fetch user slots', details: error.message });
  }

  return res.status(200).json({ slots: data });
};


//helper for processing new time slot submission from volunteer
const newRequestHelper = async (reqTimeStamp, request_size, userid, res) => {
  //calculate start of this week
  const now = new Date(); // what day is it today
  const dayOfWeek = now.getDay(); // date of this week's Sunday
  const diffToSunday = dayOfWeek === 0 ? 0 : -1 * dayOfWeek; //this week start date
  const thisWeekSunday = new Date(now);
  thisWeekSunday.setDate(dayOfWeek + diffToSunday);

  const requestedDate = new Date(reqTimeStamp);

  if ((requestedDate - thisWeekSunday) / (1000 * 60 * 60 * 24) >= 21) {
    // requested time more than three weeks from this week's sunday
    throw new Error('Cannot register more than 3 weeks ahead');
  }

  // search to see whether this time slot exists or not
  const { data, error: searchError } = await supabase
    .from('slots')
    .select('*')
    .eq('slot_time', reqTimeStamp);

  if (searchError) throw new Error(searchError.message);

  if (data.length === 0) {
    // no such slots for now
    // other people haven't requested to volunteer at this time yet
    const newRequest = {
      created_at: new Date().toISOString(),
      slot_time: new Date(reqTimeStamp).toISOString(),
      week_start_date: thisWeekSunday.toISOString(),
      current_size: request_size,
      status: 'waiting',
      user_id: userid,
    }

    //insert into slots db
    const { data: slotReturnInfo, error: createRequestError } = await supabase
      .from('slots')
      .insert([newRequest]);

    if (createRequestError) {
      // handle error with supabase creating new row
      throw new Error(createError.message);
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
  // Calculate the offset to the previous Monday
  const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(date);
  monday.setDate(date.getDate() - diffToMonday); // Set to the previous Monday
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
    res.json({ weeks: groupedSlots });
  } catch (error) {
    console.error('Error fetching slots:', error);
    res.status(500).json({ error: 'Failed to fetch slots' });
  }
};

module.exports = {
  newRequestController,
  approveRequestController,
  rejectRequestController,
  getSlotsController,
  getUserSlotsController,
};
