const express = require('express');
const router = express.Router();
const {
  newRequestController,
  getUserSlotsController,
  userController,
} = require('../controllers/apiController');


// client request to volunteer on specific date and time
router.post('/new_request', newRequestController);

//volunteer client request to get all time slots for a certain user
router.get('/get_user_slots', getUserSlotsController);

//admin request for all users
router.get('/get_users', userController);

module.exports = router;