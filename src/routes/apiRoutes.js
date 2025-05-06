const express = require('express');
const router = express.Router();
const {
  newRequestController,
  approveRequestController,
  rejectRequestController,
  getSlotsController,
  getUserSlotsController,
  userController,
} = require('../controllers/apiController');

// client request to volunteer on specific date and time
router.post('/new_request', newRequestController);
router.post('/approve_request', approveRequestController);
router.post('/reject_request', rejectRequestController);

// admin client request to get all available time slots
router.get('/get_slots', getSlotsController);

//volunteer client request to get all time slots for a certain user
router.get('/get_user_slots', getUserSlotsController);

router.get('/get_users', userController);

module.exports = router;
