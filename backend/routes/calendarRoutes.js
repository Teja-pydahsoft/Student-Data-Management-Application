const express = require('express');
const {
  getNonWorkingDays,
  getCustomHolidays,
  saveCustomHoliday,
  deleteCustomHoliday
} = require('../controllers/calendarController');
const authMiddleware = require('../middleware/auth');
const { requireAdmin } = require('../middleware/authorize');

const router = express.Router();

router.use(authMiddleware);

router.get('/non-working-days', getNonWorkingDays);
router.get('/custom-holidays', getCustomHolidays);
router.post('/custom-holidays', requireAdmin, saveCustomHoliday);
router.delete('/custom-holidays/:date', requireAdmin, deleteCustomHoliday);

module.exports = router;

