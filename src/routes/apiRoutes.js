const express = require('express');
const router = express.Router();
const { newRequestController } = require('../controllers/apiController');

// client request to volunteer on specific date and time
console.log("debugger 9.0")
router.post("/new_request", newRequestController);

module.exports = router;