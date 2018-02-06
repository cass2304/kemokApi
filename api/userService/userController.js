const Request = require('request');
const _ = require('lodash');
const _async = require('async');
const config = require('../../config/environment/development');
const {Client} = require('pg');
const moment = require('moment');
const options = {
  method: 'POST',
  headers:
    {'content-type': 'application/json'},
  json: true
};

/*
* { username: [array of agencs ] }
*/

module.exports.createNewAgency = async (req, res) => {

  options.url = config.metabase.uri + config.auth;
  options.body = {
    username: config.username,
    password: config.password
  };

  const client = new Client(config.dbMetabase);

  await client.connect();

  const collectionId  = await  client.query(`Select id from collection where name = '${req.body.originName}' `);

  const queryResponse = await client.query(`SELECT * FROM report_card where collection_id = ${collectionId.rows[0].id}`);

  const dashboardInfo = await client.query(`SELECT * from report_dashboard where name = '${req.body.dashboardName}' `);

  const dashboardQuestions = await client.query(`SELECT * from report_dashboardcard where dashboard_id = ${dashboardInfo.rows[0].id}`);

  if (_.isArray(req.body.username)) {

    Request(options, function (error, response, metaBody) {
      if (error) return res.status(500).json({message: "Error on metabase service"});

      if (metaBody.id) {

        _async.each(req.body.username, function (user, callback) {

          options.url = config.metabase.uri + config.groups;
          options.headers['X-Metabase-Session'] = metaBody.id;
          options.body = {
            name: user
          };

          Request(options, function (error, response, groupsBody) {
            if (error) return callback(error);
            options.url = config.metabase.uri + config.users;
            options.body = {
              first_name: user,
              last_name: user,
              email: user + "@baccredomatic.gt",
              password: user + config.generalPassword
            };

            Request(options, function (error, response, userBody) {

              if (error) return callback(error);
              options.url = config.metabase.uri + config.addUsertoGroup;
              options.body = {
                group_id: groupsBody.id,
                user_id: userBody.id
              };
              Request(options, function (error, response, addGroupBody) {

                if (error) return callback(error);
                options.url = config.metabase.uri + config.collections;
                options.body = {
                  name: user,
                  color: getRandomColor(),
                  description: "Collection for agency " + user,
                };
                Request(options, async function (error, response, collectionBody) {
                  if (error) return callback(error);
                  if (collectionBody) {
                    await client.query(`INSERT INTO permissions (object, group_id) VALUES ( '/collection/${collectionBody.id}/read/', ${groupsBody.id})`);

                    const newDashboard = await client.query(`INSERT INTO report_dashboard (created_at,updated_at,name,description,creator_id,parameters,
                                                                        points_of_interest,caveats,show_in_getting_started,public_uuid,made_public_by_id,
                                                                        enable_embedding,embedding_params,archived,position)
                                                                        VALUES ('${new Date(dashboardInfo.rows[0].created_at).toISOString()}','${new Date(dashboardInfo.rows[0].updated_at).toISOString()}','Dashboard ${user}',${dashboardInfo.rows[0].description},${dashboardInfo.rows[0].creator_id},
                                                                                '${JSON.stringify(dashboardInfo.rows[0].parameters)}', ${dashboardInfo.rows[0].points_of_interest},${dashboardInfo.rows[0].caveats},${dashboardInfo.rows[0].show_in_getting_started},
                                                                                ${dashboardInfo.rows[0].public_uuid},${dashboardInfo.rows[0].made_public_by_id},${dashboardInfo.rows[0].enable_embedding}, ${dashboardInfo.rows[0].embedding_params},
                                                                                ${dashboardInfo.rows[0].archived},${dashboardInfo.rows[0].position})`);

                    await _async.each(queryResponse, async (card, cardsCallback) => {
                      let newQuery = JSON.parse(card.dataset_query);

                      newQuery.native.query = newQuery.native.query.replace(req.body.originName, user);

                      await client.query(`INSERT INTO report_card (created_at, updated_at, name, description, display, dataset_query,
                                                                   visualization_settings, creator_id, database_id, table_id, query_type,
                                                                   archived, collection_id, public_uuid, made_public_by_id, enable_embedding,
                                                                   embedding_params, cache_ttl, result_metadata)
                                                       VALUES ('${new Date (card.created_at).toISOString()}','${new Date(card.updated_at).toISOString()}',${card.name},${card.description},${card.display},'${JSON.stringify(newQuery)}',
                                                                 ${card.visualization_settings},${card.creator_id},${card.database_id},${card.table_id},${card.query_type},
                                                                 ${card.archived},${collectionBody.id},${card.public_uuid},${card.made_public_by_id},${card.enable_embedding},
                                                                 ${card.embedding_params},${card.cache_ttl},${JSON.stringify(card.result_metadata)} )`, (err, res) => {
                        if (err) return cardsCallback(err);

                      });

                      await _async.each(dashboardQuestions, async (cardConfig, cardConfigCallback) => {

                        await client.query(`INSERT INTO report_dashboardcard (created_at,updated_at,sizeX,sizeY,row,col,card_id,dashboard_id,parameter_mappings,visualization_settings)
                                                                        VALUES (${new Date(cardConfig.created_at).toISOString()},${new Date(cardConfig.updated_at).toISOString()},${cardConfig.sizeX},${cardConfig.sizeY},${cardConfig.row},
                                                                                ${cardConfig.col}, ${cardConfig.card_id},${newDashboard.rows[0].id},'${JSON.stringify(cardConfig.parameter_mappings)}',
                                                                                ${cardConfig.visualization_settings})`);
                        cardConfigCallback();
                      }, (err) => {
                        if (err) return cardsCallback(err);
                        return cardsCallback();
                      });

                    }, (err) => {
                      if (err) return callback(err);
                      return callback();
                    })
                  } else {
                    return callback();
                  }
                });
              })
            })
          })
        }, function (err) {
          if (err) return res.status(400).json(err);
          client.end();
          return res.status(201).json({});
        })
      }
    })
  } else {
    return res.status(400).json({message: "Missing_params"});
  }
};


/*
* create agency by bath }
*/
module.exports.createNewAgencyByBatch = async function (req, res) {


  options.url = config.metabase.uri + config.auth;
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
        if (error) res.status(400).json({message: "ERROR_AUTHENTICATING_USER"})
        options.url = config.metabase.uri + config.users;

        _async.each(queryResponse.rows, (agency, callback) => {
          console.log('creating ...', agency);
          options.body = {
            first_name: agency.oficial,
            last_name: agency.agencia,
            email: agency.oficial + "@baccredomatic.gt",
            password: agency.oficial + config.generalPassword
          };

          Request(options, function (error, response, userBody) {
            if (error) return callback(error);

            options.url = config.metabase.uri + config.addUsertoGroup;
            options.body = {
              group_id: groupsBody.id,
              user_id: userBody.id
            };

            Request(options, function (error, response, addGroupBody) {
              if (error) return callback(error);
              callback()
            })
          })

        }, (err) => {
          if (err) return res.status(400).json(err);
          return res.status(201).json({data: queryResponse.rows});
        });
      })
    } else
      return res.status(400).json({message: "PROBLEM_CREATING_USERS"})
  });

};

module.exports.createUserRegionByBatch = async function (req, res) {


  options.url = config.metabase.uri + config.auth;
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
        if (error) res.status(400).json({message: "ERROR_AUTHENTICATING_USER"})
        options.url = config.metabase.uri + config.users;

        _async.each(queryResponse.rows, (agency, callback) => {

          options.body = {
            first_name: 'REGION',
            last_name: agency.region,
            email: agency.region + "@baccredomatic.gt",
            password: agency.oficial + config.generalPassword
          };

          Request(options, function (error, response, userBody) {
            if (error) return callback(error);

            options.url = config.metabase.uri + config.addUsertoGroup;
            options.body = {
              group_id: groupsBody.id,
              user_id: userBody.id
            };

            Request(options, function (error, response, addGroupBody) {
              if (error) return callback(error);
              callback()
            })
          })

        }, (err) => {
          if (err) return res.status(400).json(err);
          return res.status(201).json({data: queryResponse.rows});
        });
      })
    } else
      return res.status(400).json({message: "PROBLEM_CREATING_USERS"})
  });


};

function getRandomColor() {
  let letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}