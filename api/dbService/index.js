'use strict';

var express = require('express');
var userController = require ('./dbController');

var router = express.Router();

router.put('/update-fields',  userController.updateFields);

module.exports = router;