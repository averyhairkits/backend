const express = require('express');
const router = express.Router();
const {
  newRequestController,
  getUserSlotsController,
  getUserSessionsController
} = require('../controllers/apiController');

// client request to volunteer on specific date and time
router.post('/new_request', newRequestController);

//volunteer client request to get all time slots for a certain user
router.get('/get_user_slots', getUserSlotsController);

//volunteer client request to get all already scheduled session for a certain user
router.get('/get_user_sessions', getUserSessionsController);


module.exports = router;
