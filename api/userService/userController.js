var Request = require('request');
var _=require('lodash');
var _async = require('async');
var config = require('../../config/environment/development')
const { Client } = require('pg')
const options = {
  method: 'POST',
  headers:
    { 'content-type': 'application/json' },
  json: true
};

/*
* { username: [array of agencs ] }
*/

module.exports.createNewAgency = function (req, res) {

  options.url = config.metabase.uri+config.auth;
  options.body = {
    username: config.username,
    password: config.password
  };

  if (_.isArray(req.body.username)) {

    Request(options, function (error, response, metaBody) {
      if (error) return res.status(500).json({message: "Error on metabase service"})

      if (metaBody.id) {

        _async.each(req.body.username, function (user, callback) {

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
  return  res.status(400).json({message:"Missing_params"});

};


/*
* create agency by bath } 
*/
module.exports.createNewAgencyByBatch = async function (req, res) {


  options.url = config.metabase.uri+config.auth;
  options.body = {
    username: config.username,
    password: config.password
  };

  const client = new Client(config.db)

  await client.connect()

  const queryResponse = await client.query('SELECT * FROM agencia')

  await client.end()

  Request(options, function (error, response, metaBody) {
    if (error) return res.status(500).json({message: "Error on metabase service"})

    if (metaBody.id) {

      options.url = config.metabase.uri + config.groups;
      options.headers['X-Metabase-Session'] = metaBody.id;
      options.body = {
        name: "General"
      };

      Request(options, function (error, response, groupsBody) {
        if(error) res.status(400).json({message: "ERROR_AUTHENTICATING_USER"})
        options.url = config.metabase.uri + config.users;

        _async.each(queryResponse.rows, (agency, callback) => {
          console.log('creating ...', agency);
          options.body = {
            first_name: agency.oficial,
            last_name: agency.agencia,
            email: agency.oficial+"@baccredomatic.gt",
            password: agency.oficial+config.generalPassword
          };

          Request(options, function (error, response, userBody) {
            if(error) return callback(error);

            options.url = config.metabase.uri + config.addUsertoGroup;
            options.body = {
              group_id: groupsBody.id,
              user_id: userBody.id
            };

            Request(options, function (error, response, addGroupBody){
              if(error) return callback(error);
              callback()
            })
          })

        }, (err) => {
          if(err) return res.status(400).json(err);
          return res.status(201).json({data:queryResponse.rows});
        });
      })
    }else
      return res.status(400).json({message: "PROBLEM_CREATING_USERS"})
  });




};

module.exports.createUserRegionByBatch = async function (req, res) {


  options.url = config.metabase.uri+config.auth;
  options.body = {
    username: config.username,
    password: config.password
  };

  const client = new Client(config.db)

  await client.connect()

  const queryResponse = await client.query('SELECT  distinct(region) FROM agencia')

  await client.end()

  Request(options, function (error, response, metaBody) {
    if (error) return res.status(500).json({message: "Error on metabase service"})

    if (metaBody.id) {

      options.url = config.metabase.uri + config.groups;
      options.headers['X-Metabase-Session'] = metaBody.id;
      options.body = {
        name: "General"
      };

      Request(options, function (error, response, groupsBody) {
        if(error) res.status(400).json({message: "ERROR_AUTHENTICATING_USER"})
        options.url = config.metabase.uri + config.users;

        _async.each(queryResponse.rows, (agency, callback) => {

          options.body = {
            first_name: 'REGION',
            last_name: agency.region,
            email: agency.region+"@baccredomatic.gt",
            password: agency.oficial+config.generalPassword
          };

          Request(options, function (error, response, userBody) {
            if(error) return callback(error);

            options.url = config.metabase.uri + config.addUsertoGroup;
            options.body = {
              group_id: groupsBody.id,
              user_id: userBody.id
            };

            Request(options, function (error, response, addGroupBody){
              if(error) return callback(error);
              callback()
            })
          })

        }, (err) => {
          if(err) return res.status(400).json(err);
          return res.status(201).json({data:queryResponse.rows});
        });
      })
    }else
      return res.status(400).json({message: "PROBLEM_CREATING_USERS"})
  });




};