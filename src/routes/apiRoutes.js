const express = require('express');
const router = express.Router();
const { newRequestController } = require('../controllers/authController');

// client request to volunteer on specific date and time
router.post("/new_request", newRequestController) 
