const express = require('express');
const router = express.Router();

const {
  newRequestController,
  approveRequestController,
  rejectRequestController,
} = require('../controllers/apiController');

const { grantAdminController } = require('../controllers/grantAdminController');
const userController = require('../controllers/userController');

// client request to volunteer on specific date and time
router.post('/new_request', newRequestController);
router.post('/approve_request', approveRequestController);
router.post('/reject_request', rejectRequestController);
router.post('/grant_admin', grantAdminController);
router.get('/get_users', userController.getAllUsers);

module.exports = router;
