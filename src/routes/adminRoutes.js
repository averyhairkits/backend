const express = require('express');
const router = express.Router();
const {
  approveRequestController,
  cancelRequestController,
  getSessionsController,
} = require('../controllers/adminController');

router.post('/approve_request', approveRequestController);
router.put('/cancel_request/:id', cancelRequestController);
router.get('/get_sessions', getSessionsController);

module.exports = router;