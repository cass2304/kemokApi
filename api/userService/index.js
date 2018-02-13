'use strict';

var express = require('express');
var userController = require ('./userController');

var router = express.Router();

router.post('/',  userController.createNewAgency);

router.post('/from-db',  userController.createAgencyFromDB);

router.get('/all-by-batch',  userController.createNewAgencyByBatch);

router.get('/createUserRegionByBatch',  userController.createUserRegionByBatch);

module.exports = router;