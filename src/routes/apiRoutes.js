const express = require('express');
const router = express.Router();
<<<<<<< Updated upstream
<<<<<<< Updated upstream
const { newRequestController, approveRequestController, rejectRequestController } = require('../controllers/apiController');
const { grantAdminController } = require('../controllers/grantAdminController');

// client request to volunteer on specific date and time
router.post("/new_request", newRequestController);
router.post("/approve_request", approveRequestController)
router.post("/reject_request", rejectRequestController)
router.post("/grant_admin", grantAdminController)
=======
const {
  newRequestController,
  approveRequestController,
  rejectRequestController,
} = require('../controllers/apiController');

// client request to volunteer on specific date and time
router.post('/new_request', newRequestController);
router.post('/approve_request', approveRequestController);
router.post('/reject_request', rejectRequestController);
>>>>>>> Stashed changes

=======
const {
  newRequestController,
  approveRequestController,
  rejectRequestController,
} = require('../controllers/apiController');

// client request to volunteer on specific date and time
router.post('/new_request', newRequestController);
router.post('/approve_request', approveRequestController);
router.post('/reject_request', rejectRequestController);

>>>>>>> Stashed changes
module.exports = router;
