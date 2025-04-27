const express = require('express');
const router = express.Router();
const {
  newRequestController,
  approveRequestController,
  rejectRequestController,
  getSlotsController,
} = require('../controllers/apiController');

// client request to volunteer on specific date and time
router.post('/new_request', newRequestController);
router.post('/approve_request', approveRequestController);
router.post('/reject_request', rejectRequestController);

// admin client request to get all available time slots
router.get('/get_slots', getSlotsController);

module.exports = router;
