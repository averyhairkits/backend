const supabase = require('../config/supabase');


//handles when an admin approves a list of pending time slots
const approveRequestController = async (req, res) => {
  const { title, start, end, description, volunteers, created_by  } = req.body;

  if (!start || !end) {
    return res.status(400).json({ error: 'Missing start or end time' });
  }
  //map of attending volunteer's ids
  const attendingVolunteerIds = await findOverlappingHelper(start, end, res);
  const insertedSessionId = await insertSessionHelper({ title, description, start, end, created_by }, res);
  await linkVolunteersHelper(insertedSessionId, attendingVolunteerIds, res);

  return res.status(200).json({ 
    message: 'Session created and volunteers linked', 
    session: insertedSessionId
  });

};

const findOverlappingHelper = async (start, end, res) => {
  //find volunteer slots overlapping with the session time
  const { data: overlappingSlotsData, error: slotError } = await supabase
    .from('slots')
    .select('user_id')
    .gte('slot_time', new Date(start).toISOString())
    .lt('slot_time', new Date(end).toISOString());

  if (slotError) {
    return res.status(500).json({ error: 'Failed to fetch volunteer slots', details: slotError.message });
  }

  //deduplicate user_ids
  const uniqueUserIds = [...new Set(overlappingSlotsData.map((slot) => slot.user_id))];
  
  return uniqueUserIds;
};

const insertSessionHelper = async ({title, description, start, end, created_by}, res) => {
  const { data: sessionInsertData, error: sessionError } = await supabase
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

  if (sessionError || !sessionInsertData || sessionInsertData.length === 0) {
    return res.status(500).json({
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
    res.status(500).json({ error: 'Failed to link volunteers', details: error.message });
  }
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
};
