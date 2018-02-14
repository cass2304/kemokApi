'use strict';

var express = require('express');
var dbController = require ('./dbController');

var router = express.Router();

router.put('/update-fields',  dbController.updateFields);

router.put('/update-dates', dbController.updateDates );

module.exports = router;