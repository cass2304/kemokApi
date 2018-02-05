var Request = require('request');
var _=require('lodash');
var async = require('async');
var config = require('../../config/environment/development')
const options = {
  method: 'POST',
  headers:
    { 'content-type': 'application/json' },
  json: true
};

exports.createNewAgency = function (req, res) {

  options.url = config.metabase.uri+config.auth;
  options.body = {
    username: config.username,
    password: config.password
  };

  if (_.isArray(req.body.username)) {

    Request(options, function (error, response, metaBody) {
      if (error) return res.status(500).json({message: "Error on metabase service"})

      if (metaBody.id) {

        async.each(req.body.username, function (user, callback) {

          options.url = config.metabase.uri + config.groups;
          options.headers['X-Metabase-Session'] = metaBody.id;
          options.body = {
            name: user
          };

          Request(options, function (error, response, groupsBody) {
            if(error) return callback(error);
            options.url = config.metabase.uri + config.users;
            options.body = {
              first_name: user,
              last_name: user,
              email: user+"@baccredomatic.gt",
              password: user+config.generalPassword
            };

            Request(options, function (error, response, userBody) {

              if(error) return callback(error);
              options.url = config.metabase.uri + config.addUsertoGroup;
              options.body = {
                group_id: groupsBody.id,
                user_id: userBody.id
              };
              Request(options, function (error, response, addGroupBody){
                callback()
              })

            })

          })
        }, function (err) {
          if(err) return res.status(400).json(err);
          return res.status(201).json({});
        })
      }
    })
  }

};