const supabase = require('../config/supabase');


//handles when an admin approves a list of pending time slots
const approveRequestController = async (req, res) => {
  const { title, start, end, description, volunteers, created_by  } = req.body;

  if (!start || !end) {
    return res.status(400).json({ error: 'Missing start or end time' });
  }
  //map of attending volunteer's ids
  const { uniqueUserIds, totalSize } = await findOverlappingHelper(start, end, res);

  const insertedSessionId = await insertSessionHelper({ title, description, start, end, created_by }, res);

  await linkVolunteersHelper(insertedSessionId, uniqueUserIds, res);

  return res.status(200).json({ 
    message: 'Session created and volunteers linked', 
    session: insertedSessionId,
  });

};

const findOverlappingHelper = async (start, end, res) => {
  //find volunteer slots overlapping with the session time
  const { data: overlappingSlotsData, error: slotError } = await supabase
    .from('slots')
    .select('user_id, current_size')
    .gte('slot_time', start)
    .lt('slot_time', end);

  if (slotError) {
     throw new Error('Failed to fetch volunteer slots: ', slotError.message);
  }
  console.log("here is findOverlapping returned data", overlappingSlotsData)

  const userMap = new Map();

  for (const slot of overlappingSlotsData) {
    const prev = userMap.get(slot.user_id) || 0;
    const curr = slot.current_size || 0;
    userMap.set(slot.user_id, Math.max(prev, curr));
  }

  const uniqueUserIds = Array.from(userMap.keys());
  const totalSize = Array.from(userMap.values()).reduce((sum, size) => sum + size, 0);


  return {
    uniqueUserIds,
    totalSize
  };
};


const insertSessionHelper = async ({title, description, start, end, created_by}, res) => {
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


const linkVolunteersHelper = async (sessionId, userIds, res) => {
  //link volunteers to session
  const volunteerLinks = userIds.map((userId) => ({
    session_id: sessionId,
    volunteer_id: userId,
  }));

  const { error: linkError } = await supabase
    .from('session_volunteers')
    .insert(volunteerLinks);

  if (linkError) {
    throw new Error('Failed to link volunteers', linkError.message);
  }
  console.log("succeeded")
};



const matchVolunteersController = async (req, res) => {
  const { start, end } = req.query;

  if (!start || !end) {
    return res.status(400).json({ error: 'Missing start or end time' });
  }

  try {
    // Convert 'YYYY-MM-DDTHH:MM:SS.SSSZ' to local 'YYYY-MM-DD HH:MM:SS'
    const localStart = new Date(start);
    const localEnd = new Date(end);

    const formattedStart = formatLocalDateTimeForDB(localStart);
    const formattedEnd = formatLocalDateTimeForDB(localEnd);

    const { uniqueUserIds, totalSize } = await findOverlappingHelper(formattedStart, formattedEnd);
    return res.status(200).json({ 
      volunteers: uniqueUserIds,
      current_size: totalSize
     });
  } catch (err) {
    console.error('Error in matchVolunteersController:', err.message);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
};

// Utility function to format Date as 'YYYY-MM-DD HH:MM:SS'
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
    .delete()
    .eq('id', id);

  if (error) {
    return res.status(500).json({
      error: 'Failed to cancel session',
      details: error.message,
    });
  }

  return res.status(200).json({ message: 'Session successfully cancelled' });
};


//gets all sessions matching a certain user_id
const getSessionsController = async (req, res) => {
  //check for user_id in query
  const { user_id } = req.query; 
  if (!user_id) {
    return res.status(400).json({ error: 'Missing user_id in query' });
  }

  try {
    //search for slots matching user_id in order of slot_time
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('created_by', user_id)
      .order('start', { ascending: true });
    if (error) {
      return res.status(500).json({ error: 'Failed to fetch sessions', details: error.message });
    }

    return res.status(200).json({
      sessions: data
    });
  } catch (err) {
    console.error('Unexpected error in getSessionsController:', err);
    return res.status(500).json({ error: 'Internal server error' });
  };
}

module.exports = { 
  approveRequestController,
  cancelRequestController,
  getSessionsController,
  matchVolunteersController
};
