'use strict';

var express = require('express');
var userController = require ('./userController');

var router = express.Router();

router.post('/',  userController.createNewAgency);

module.exports = router;