var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res) {
  res.render('index', { title: 'Express' });
});

module.exports = router;

/**
 * Main application routes
 */

'use strict';

var errors = require('../components/errors');

module.exports = function(app) {

  app.use('/api/accounts', require('../api/userService'));

  app.use('/api/agency', require('../api/userService'));

  app.use('/api/region', require('../api/userService'));

  // All undefined asset or api routes should return a 404
  app.route('/:url(api|auth|components|app|bower_components|assets)/*')
    .get(errors[404]);

  // All other routes should redirect to the index.html
  app.route('/').get(function(req,res){
    res.send('<h4 align="center">API KEMOK BAC </h4>')
  });
};
