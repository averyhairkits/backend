const supabase = require('../config/supabase');

//handles when an admin approves a list of pending time slots
const approveRequestController = async (req, res) => {
  const { title, start, end, description, created_by } = req.body;

  if (!start || !end) {
    return res.status(400).json({ error: 'Missing start or end time' });
  }
  //map of attending volunteer's ids
  const { uniqueUserIds, totalSize } = await findOverlappingHelper(start, end);

  const insertedSessionId = await insertSessionHelper({
    title,
    description,
    start,
    end,
    created_by,
    volunteer_count: totalSize,
  });

  try {
    await linkVolunteersHelper(insertedSessionId, uniqueUserIds);
  } catch (err) {
    console.error('Linking volunteers failed:', err.message);
  }

  // fetch user details
  const { data: userDetails, error: userFetchError } = await supabase
    .from('users')
    .select('id, firstname, lastname, email')
    .in('id', uniqueUserIds);

  if (userFetchError) {
    console.error('Failed to fetch user details:', userFetchError.message);
  }

  return res.status(200).json({
    message: 'Session created and volunteers linked',
    session: {
      id: insertedSessionId,
      title,
      description,
      start,
      end,
      created_by,
      current_size: totalSize,
      volunteers: userDetails || [],
    },
  });
};

const findOverlappingHelper = async (start, end) => {
  //find volunteer slots overlapping with the session time
  const { data: overlappingSlotsData, error: slotError } = await supabase
    .from('slots')
    .select('user_id, current_size')
    .gte('slot_time', start)
    .lt('slot_time', end);

  if (slotError) {
    throw new Error('Failed to fetch volunteer slots: ', slotError.message);
  }

  const userMap = new Map();

  for (const slot of overlappingSlotsData) {
    const prev = userMap.get(slot.user_id) || 0;
    const curr = slot.current_size || 0;
    userMap.set(slot.user_id, Math.max(prev, curr));
  }

  const uniqueUserIds = Array.from(userMap.keys());

  const totalSize = Array.from(userMap.values()).reduce(
    (sum, size) => sum + size,
    0
  );

  console.log(
    'find overlapping helper result of unique users: ',
    uniqueUserIds
  );
  console.log('find overlapping helper result of totalsize: ', totalSize);

  return {
    uniqueUserIds,
    totalSize,
  };
};

const insertSessionHelper = async ({
  title,
  description,
  start,
  end,
  created_by,
  volunteer_count,
}) => {
  const { data: sessionInsertData, error: sessionError } = await supabase
    .from('sessions')
    .insert([
      {
        title,
        description,
        start: start,
        end: end,
        status: 'confirmed',
        created_by: created_by,
        volunteer_count: volunteer_count,
      },
    ])
    .select()
    .single();

  if (sessionError || !sessionInsertData || sessionInsertData.length === 0) {
    throw new Error({
      error: 'Database insert failed',
      details: sessionError?.message,
    });
  }
  const sessionId = sessionInsertData.id;

  return sessionId;
};

const linkVolunteersHelper = async (sessionId, userIds) => {
  //link volunteers to session
  const volunteerLinks = userIds.map((userId) => ({
    session_id: sessionId,
    volunteer_id: userId,
  }));

  const { error: linkError } = await supabase
    .from('session_volunteers')
    .insert(volunteerLinks);

  if (linkError) {
    console.error('Supabase insert failed:', linkError);
    throw new Error(`Failed to link volunteers: ${linkError.message}`);
  }
  console.log('🚨 INSERTING into session_volunteers:', volunteerLinks);

};

const matchVolunteersController = async (req, res) => {
  const { start, end } = req.query;

  if (!start || !end) {
    return res.status(400).json({ error: 'Missing start or end time' });
  }

  try {
    const localStart = new Date(start);
    const localEnd = new Date(end);

    const formattedStart = formatLocalDateTimeForDB(localStart); // ← forces it to 'YYYY-MM-DD HH:MM:SS' using local time
    const formattedEnd = formatLocalDateTimeForDB(localEnd);


    console.log('match volunteer scontroller - formattedStart:', formattedStart, 'formattedEnd:', formattedEnd);

    const { uniqueUserIds, totalSize } = await findOverlappingHelper(
      formattedStart,
      formattedEnd
    );

    // fetch user details for each unique user: id, firstname, lastname, email
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('id, firstname, lastname, email')
      .in('id', uniqueUserIds);

    if (usersError) {
      console.error('Failed to fetch user info:', usersError.message);
      return res.status(500).json({ error: 'Failed to fetch user info' });
    }

    return res.status(200).json({
      volunteers: usersData,
      current_size: totalSize,
    });
  } catch (err) {
    console.error('Error in matchVolunteersController:', err.message);
    return res
      .status(500)
      .json({ error: 'Internal server error', details: err.message });
  }
};

// utility function to format Date as 'YYYY-MM-DD HH:MM:SS'
const formatLocalDateTimeForDB = (date) => {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
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

  return res.status(200).json({ message: 'Session successfully cancelled' });
};

/**
 *
 * gets all sessions across all admins
 * GET /admin/get_slots
 * Request: -
 * Response : {
 *   weeks: groupedSlots
 * }
 */
// /admin/get_sessions
const getSessionsController = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('sessions')
      .select(
        `
        id, title, description, start, end, status, created_by, volunteer_count,
        session_volunteers (
          volunteer_id,
          users (
            id,
            email,
            firstname,
            lastname
          )
        )
      `
      )
      .eq('status', 'confirmed')
      .order('start', { ascending: true });

    if (error) {
      return res.status(500).json({
        error: 'Failed to fetch sessions',
        details: error.message,
      });
    }

    // flatten the volunteer info for frontend
    const enriched = data.map((session) => ({
      ...session,
      current_size: session.volunteer_count || 0,
      volunteers: session.session_volunteers.map((link) => link.users),
    }));

    console.log('Sessions fetched from Supabase:', JSON.stringify(data, null, 2));

    return res.status(200).json({
      sessions: enriched,
    });
  } catch (err) {
    console.error('Unexpected error in getSessionsController:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

//get all slots for all users
/**
 * GET /admin/get_slots
 * Request: -
 * Response : {
 *   weeks: groupedSlots
 * }
 */
const getSlotsController = async (req, res) => {
  try {
    // get the current date
    const currentDate = new Date();

    // get the week_start_date for the current week (Monday of this week)
    const currentWeekStart = getWeekStartDate(currentDate);

    // calculate the next 3 weeks' start dates (Mondays)
    let weekStartDates = [currentWeekStart];
    for (let i = 1; i <= 3; i++) {
      let nextWeekStart = new Date(currentWeekStart);
      // add 7 days for the next Monday
      nextWeekStart.setDate(currentWeekStart.getDate() + i * 7);
      weekStartDates.push(nextWeekStart);
    }

    // format the week start dates as 'yyyy-mm-dd'
    weekStartDates = weekStartDates.map(
      (date) => date.toISOString().split('T')[0]
    );

    // fetch all slots for the next 4 weeks
    const { data: slots, error } = await supabase
      .from('slots')
      .select('*')
      .in('week_start_date', weekStartDates) // filter by the week_start_date
      .order('week_start_date', { ascending: true }); // sort by week_start_date

    if (error) {
      return res
        .status(500)
        .json({ error: 'Failed to fetch slotss', details: error });
    }

    // organize the slots into weeks based on week_start_date
    const groupedSlots = weekStartDates.map((date) => {
      return {
        week_start_date: date,
        slots: slots.filter((slot) => slot.week_start_date === date),
      };
    });

    // return the structured JSON with the slots grouped by week_start_date
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
      .select('id, email, firstname, lastname, role, created_at');

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

// helper function to calculate Monday of the current week and the next 3 weeks
const getWeekStartDate = (date) => {
  const dayOfWeek = date.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(date);
  monday.setDate(monday.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

module.exports = {
  approveRequestController,
  cancelRequestController,
  getSessionsController,
  getSlotsController,
  userController,
  matchVolunteersController,
};
