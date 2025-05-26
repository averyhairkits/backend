const express = require('express');
const router = express.Router();
const {
  approveRequestController,
  cancelRequestController,
  getSessionsController,
  getSlotsController,
  userController,
  matchVolunteersController
} = require('../controllers/adminController');

router.post('/approve_request', approveRequestController);

router.put('/cancel_request/:id', cancelRequestController);

router.get('/get_sessions', getSessionsController);

router.get('/match_volunteers', matchVolunteersController);
// admin client request to get all available time slots
router.get('/get_slots', getSlotsController);

//admin request for all users
router.get('/get_users', userController);

module.exports = router;