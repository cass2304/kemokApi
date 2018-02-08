'use strict';

var express = require('express');
var userController = require ('./userController');

var router = express.Router();

router.post('/',  userController.createNewAgency);

router.post('/fromDb',  userController.createAgencyFromDB);

router.get('/createUserAgencyByBatch',  userController.createNewAgencyByBatch);

router.get('/createUserRegionByBatch',  userController.createUserRegionByBatch);

module.exports = router;