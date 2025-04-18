const supabase = require('../config/supabase');

const newRequestController = async (req, res) => {
  const { reqTimeStampList, request_size } = req.body;
  // get the user who made this request
  // const user = supabase.auth.user()
  // if (user.role != "volunteer"){
  //   res.status(400).json({
  //     error: "only volunteer can request to volunteer"
  //   })
  // }
<<<<<<< Updated upstream
  for (let i = 0; i < reqTimeStampList.length; i++){
=======

  //iterate through each time slot, calling helper on each
  for (let i = 0; i < reqTimeStampList.length; i++) {
>>>>>>> Stashed changes
    newRequestHelper(reqTimeStampList[i], request_size, res);
  }
};

const approveRequestController = async (req, res) => {
  const { reqTimeStampList } = req.body;

  for (let i = 0; i < reqTimeStampList.length; i++) {
    approveRequestHelper(reqTimeStampList[i], req, res);
  }
};

const rejectRequestController = async (req, res) => {
  const { reqTimeStampList } = req.body;
  // update the status field

  for (let i = 0; i < reqTimeStampList.length; i++) {
    rejectRequestHelper(reqTimeStampList[i], req, res);
  }
};

const newRequestHelper = async (reqTimeStamp, request_size, res) => {
<<<<<<< Updated upstream
  const now = new Date();
  // what day is it today
  const dayOfWeek = now.getDay();
  // date of this week's Sunday
  const diffToSunday = dayOfWeek === 0 ? 0 : -1 * dayOfWeek;
  //this week start date
  const thisWeekSunday = new Date(now);
  thisWeekSunday.setDate(dayOfWeek + diffToSunday)

  const requestedDate = new Date(reqTimeStamp);
  if ((requestedDate - thisWeekSunday) / (1000 * 60 * 60 * 24) >= 21){
=======
  //calculate start of this week
  const now = new Date(); // what day is it today
  const dayOfWeek = now.getDay(); // date of this week's Sunday
  const diffToSunday = dayOfWeek === 0 ? 0 : -1 * dayOfWeek; //this week start date
  const thisWeekSunday = new Date(now);
  thisWeekSunday.setDate(dayOfWeek + diffToSunday);

  const requestedDate = new Date(reqTimeStamp);

  if ((requestedDate - thisWeekSunday) / (1000 * 60 * 60 * 24) >= 21) {
>>>>>>> Stashed changes
    // requested time more than three weeks from this week's sunday
    return res.status(400).json({
      error: 'cannot register for time slots three weeks from this week',
    });
  }

  // search to see wether this time slot exists or not
  const { data, searchError } = await supabase
    .from('slots')
    .select('*')
    .eq('slot_time', reqTimeStamp);

  if (searchError) {
    return res.status(400).json({
      error: searchError,
    });
  }

  if (data.length === 0) {
    // no such slots for now
    // other people haven't requested to volunteer at this time yet
    const newRequest = {
      created_at: new Date().toISOString(),
      slot_time: new Date(reqTimeStamp).toISOString(),
      week_start_date: thisWeekSunday.toISOString(),
      current_size: request_size,
      status: 'waiting',
    };
    const { data: slotReturnInfo, error: createRequestError } = await supabase
      .from('slots')
      .insert([newRequest]);

    if (createRequestError) {
      // handle error with supabase creating new row
      console.error(
        'Error creating new_request; error inserting row:',
        createRequestError
      );
      return res.status(400).json({
        error: `Error creating new_request; error inserting row: ${createRequestError.message}`,
        errorDetail: `${createRequestError.details}`,
      });
    }

    return res.status(201).json({
      message: 'request created successfully, wait to be approved',
      slot_info: slotReturnInfo,
    });
  }

  // slots exists
  if (request_size + data.current_size > 6) {
    // request_size is too large
    return res.status(400).json({
      error: `request size plus current exceeds 6, current size is ${data.current_size}`,
    });
  }

  if (data.status === 'rejected') {
    // cannot request to volunteer on time slots already rejected by Petina
    return res.status(400).json({
      error: `Time slots ${reqTimeStamp} is unavailable. Please choose another time slot`,
    });
  }

  // already has this slot, we update existing row instead of insert new row
  const { updateReturnData, error } = await supabase
    .from('slots')
    .update({ current_size: request_size + data.current_size })
    .match({ slot_time: reqTimeStamp });

  return res.status(201).json({
    message: 'request created successfully, wait to be approved',
    slot_info: updateReturnData,
  });
};

const approveRequestHelper = async (reqTimeStamp, req, res) => {
<<<<<<< Updated upstream
  
  const token =
    req.cookies.session || req.headers.authorization?.split(' ')[1];
=======
  //retrieve token from cookie or auth header
  const token = req.cookies.session || req.headers.authorization?.split(' ')[1];
>>>>>>> Stashed changes

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

module.exports = {
  newRequestController,
  approveRequestController,
  rejectRequestController,
};
