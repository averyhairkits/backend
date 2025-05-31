const supabase = require('../config/supabase');

//handles new slot submissions from users
/**
 * POST /api/new_request
 * Request: {
 *   reqTimes: {
 *    slot_time: timestamp of slot
 *    request_size: integer
 *    user_id: UUID
 *  }
 * }
 * Response : {
 *   message: string,
 *   results: [{
 *       timestamp: string,
 *       status: "ok" | "error",
 *       result?: { status: string, time: string },
 *       error?: string
 *     }]}
 */
const newRequestController = async (req, res) => {
  const { reqTimes } = req.body;
  //iterate reqTimes, call helper on each
  try {
    const results = await Promise.all(
      reqTimes.map(async ({ slot_time, request_size, user_id }) => {
        try {
          //call to helper function
          const result = await newRequestHelper(
            slot_time,
            request_size,
            user_id
          );
          return { timestamp: slot_time, status: 'ok', result };
        } catch (err) {
          return { timestamp: slot_time, status: 'error', error: err.message };
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



/**
 *
 * helper for processing new time slot submission from volunteer
 * handles new slot submissions from users
 *
 */
const newRequestHelper = async (reqTimeStamp, request_size, userid) => {
  //extract date of reqTimeStamp
  const requestedDate = new Date(reqTimeStamp);
  //calculate week start date of date
  const weekStart = getWeekStartDate(requestedDate);

  //reject if more than 3 weeks ahead from this week's Monday
  const today = new Date();
  const todayWeekStart = getWeekStartDate(today);
  const maxDate = new Date(todayWeekStart); //3 weeks ahead
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

  //if no pre-existing matching slot from any user
  if (data.length === 0) {
    //create new slot
    const newRequest = {
      created_at: new Date().toISOString(),
      slot_time: new Date(reqTimeStamp).toISOString(),
      week_start_date: weekStart.toISOString().split('T')[0],
      current_size: request_size,
      user_id: userid,
    };

    //send new slot
    const { error: createRequestError } = await supabase
      .from('slots')
      .insert([newRequest]);

    if (createRequestError) {
      throw new Error(createRequestError.message);
    }
    return { status: 'inserted', time: reqTimeStamp };
  }



  //check if user already has a slot for this time
  const existingUserSlot = data.find((slot) => slot.user_id === userid);
  const otherSlots = data.filter((slot) => slot.user_id !== userid);

  //calculate current total from others
  const otherTotalSize = otherSlots.reduce(
    (sum, slot) => sum + slot.current_size,
    0
  );

  //total size if we add this request
  const proposedTotal = otherTotalSize + request_size;

  if (proposedTotal > 6) {
    throw new Error(`Slot ${reqTimeStamp} exceeds max volunteers.`);
  }

  //if the user has an existing slot, update it
  if (existingUserSlot) {
    const { error: updateError } = await supabase
      .from('slots')
      .update({ current_size: request_size }) // replace old value
      .match({ slot_time: reqTimeStamp, user_id: userid });

    if (updateError) throw new Error(updateError.message);

    return { status: 'updated', time: reqTimeStamp };
  }

  //else, add a new row for this user
  const newRequest = {
    created_at: new Date().toISOString(),
    slot_time: new Date(reqTimeStamp).toISOString(),
    week_start_date: weekStart.toISOString().split('T')[0],
    current_size: request_size,
    user_id: userid,
  };

  const { error: createError } = await supabase
    .from('slots')
    .insert([newRequest]);

  if (createError) throw new Error(createError.message);

  return { status: 'inserted', time: reqTimeStamp };
};


// helper function to calculate Monday of the current week and the next 3 weeks
const getWeekStartDate = (date) => {
  const dayOfWeek = date.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(date);
  monday.setDate(monday.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
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
      return res
        .status(500)
        .json({ error: 'Failed to fetch user slots', details: error.message });
    }

    const slotTotals = {};
    for (const slot of data) {
      const time = slot.slot_time;
      slotTotals[time] = (slotTotals[time] || 0) + slot.current_size;
    }

    const grouped = {};
    for (const slot of data) {
      const weekStart = getWeekStartDate(new Date(slot.slot_time));
      if (!grouped[weekStart]) grouped[weekStart] = [];
      grouped[weekStart].push(slot);
    }

    const groupedSlots = Object.entries(grouped).map(
      ([week_start_date, slots]) => ({
        week_start_date,
        slots,
      })
    );

    return res.status(200).json({
      weeks: groupedSlots,
    });
  } catch (err) {
    console.error('Unexpected error in getUserSlotsController:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};


//handles fetching all session data for a certain user
const getUserSessionsController = async (req, res) => {
  try {
    const { user_id } = req.query;

    if (!user_id) {
      return res.status(400).json({
          status: 'error',
          message: 'Missing user_id in request query'});
    }
    const {data, error} = await supabase
      .from('session_volunteers')
      .select('sessions!inner(*)')
      .eq('sessions.status', 'confirmed')
      .eq('volunteer_id', user_id);

    if (error) {
      console.error('Supabase Error:', error);
      return res.status(500).json({
          status: 'error',
          message: 'Failed to fetch user sessions', 
          error: error.message,
        })}
    
    return res.status(200).json({
      status: 'ok',
      sessions: data,
    });
  }
  catch(err) {
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch user sessions',
      error: err.message,
    })
  }
};

module.exports = {
  newRequestController,
  getUserSlotsController,
  getUserSessionsController,
};
