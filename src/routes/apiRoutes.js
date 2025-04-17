const express = require('express');
const router = express.Router();
const { newRequestController, approveRequestController, rejectRequestController } = require('../controllers/apiController');
const { grantAdminController } = require('../controllers/grantAdminController');

// client request to volunteer on specific date and time
router.post("/new_request", newRequestController);
router.post("/approve_request", approveRequestController)
router.post("/reject_request", rejectRequestController)
router.post("/grant_admin", grantAdminController)

module.exports = router;