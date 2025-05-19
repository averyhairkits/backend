const express = require('express');
const router = express.Router();
const {
  approveRequestController,
  cancelRequestController,
} = require('../controllers/adminController');

router.post('/approve_request', approveRequestController);

router.put('/cancel_request/:id', cancelRequestController);

module.exports = router;