const supabase = require('../config/supabase');

const newRequestController = async (req, res) => {
  const { reqTimeStampList, request_size } = req.body;
  // get the user who made this request
  const user = supabase.auth.user()
  for (let i = 0; i < reqTimeStampList.length; i++){
    helper(reqTimeStampList[i], request_size);
  }
}

const approveRequestController = async (req, res) => {
  const { reqTimeStamp } = req.body;
  
}

const helper = async (reqTimeStamp, request_size) => {
  // what day is it today
  const dayOfWeek = now.getDay();
  // date of this week's Sunday
  const diffToSunday = dayOfWeek === 0 ? 0 : -1 * dayOfWeek;
  const thisWeekSunday = new Date(now);
  thisWeekSunday.setDate(dayOfWeek + diffToSunday)

  if ((reqTimeStamp - thisWeekSunday) / (1000 * 60 * 60 * 24) >= 21){
    // requested time more than three weeks from this week's sunday
    return res.status(400).json({
      error: 'cannot register for time slots three weeks from this week'
    });
  }

  // search to see wether this time slot exists or not
  const { data, searchError } = await supabase
    .from('slots')
    .select('*')
    .eq('slot_time', reqTimeStamp);

  if (error){
    return res.status(400).json({
      error: searchError
    })
  }

  if (data.length === 0){ 
    // no such slots for now
    // other people haven't requested to volunteer at this time yet
    const newRequest = {
      created_at: Date.now(),
      slot_time: reqTimeStamp,
      current_size: request_size,
      status: "waiting"
    };
    const { data: slotReturnInfo, error: createRequestError } = await supabase
        .from('slots')
        .insert([newRequest])

    if (createRequestError) {
      // handle error with supabase creating new row
      console.error('Error creating new_request; error inserting row:', createRequestError);
      return res.status(400).json({ 
        error: `Error creating new_request; error inserting row: ${createRequestError}`
      });
    }
    
    return res.status(201).json({
      message: 'request created successfully, wait to be approved',
      slot_info: slotReturnInfo,
    });
  }
  
  // slots exists
  if ( (request_size + data.current_size) > 6 ) {
    // request_size is too large
    return res.status(400).json({
      error: `request size plus current exceeds 6, current size is ${data.current_size}`
    })
  }

  if (data.status === "rejected") {
    // cannot request to volunteer on time slots already rejected by Petina
    return res.status(400).json({
      error: `Time slots ${reqTimeStamp} is unavailable. Please choose another time slot`
    })
  }

  // already has this slot, we update existing row instead of insert new row
  const { updateReturnData, error } = await supabase
    .from('slots')
    .update({ current_size: request_size + data.current_size })
    .match({ slot_time: reqTimeStamp })

  return res.status(201).json({
    message: 'request created successfully, wait to be approved',
    slot_info: updateReturnData,
  });
}

module.exports = { newRequestController, approveRequestController }