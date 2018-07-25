const Request = require('request');
const _ = require('lodash');
const _async = require('async');
const config = require('../../config/environment/production');
const {Client} = require('pg');
const options = {
  method: 'POST',
  headers:
    {'content-type': 'application/json'},
  json: true
};

/*
* { username: [array of agencys ] }
*/

/* POST BODY USERS DOESN'T EXISTS

{
	"username":["r42"],
	"originCollection":"Dashboards modelo",
	"originDashboard": "*Monitoreo",
	"originView": "gv"
}

 */

module.exports.createNewAgency = async (req, res) => {

  if (_.isArray(req.body.username) && req.body.originCollection && req.body.originDashboard && req.body.originView) {

    const client = new Client(config.dbMetabase);

    await client.connect();

    const collectionId  = await client.query(`Select id from collection where name = '${req.body.originCollection}' `);

    const dashboardInfo = await client.query(`SELECT * from report_dashboard where name = '${req.body.originDashboard}' `);

    const queryResponse = await client.query(`SELECT *, a.visualization_settings vis_set_dashboard_card, b.visualization_settings vis_set_report_card from report_card B INNER JOIN report_dashboardcard A on A.card_id = B.id where b.collection_id = ${collectionId.rows[0].id} and dashboard_id = ${dashboardInfo.rows[0].id}`);

    options.url = config.metabase.uri + config.auth;
    options.body = {
      username: config.username,
      password: config.password
    };

    Request(options, function (error, response, metaBody) {
      if (error) return res.status(500).json({message: "Error on auth with metabase service"});

      if (metaBody.id) {

        _async.each(req.body.username, function (user, callback) {

          options.url = config.metabase.uri + config.groups;
          options.headers['X-Metabase-Session'] = metaBody.id;
          options.body = {
            name: user
          };

          Request(options, async function (error, response, groupsBody) {
            if (error) return callback(error);
            let groupId;

            if (_.isString(groupsBody)) {
              options.url = config.metabase.uri + config.groups;
              options.method = 'GET';
              delete options.body;


              groupId = await new Promise( (resolve,reject) => {
                Request(options, async function (error, response, gBody) {
                  if(error) reject(error);
                  _.find(gBody, (grp) => {
                    console.log("grp ",grp)
                    if (grp.name.indexOf(user.toLowerCase()) > -1)
                      resolve( grp );
                  })
                });
              });

              options.method = 'POST';
            } else {
              groupId = groupsBody;
            }

            options.url = config.metabase.uri + config.users;
            options.body = {
              first_name: user,
              last_name: user,
              email: user.toLowerCase() + "@baccredomatic.gt",
              password: user + config.generalPassword
            };

            Request(options, function (error, response, userBody) {
              if (error) return callback(error);
              options.url = config.metabase.uri + config.addUsertoGroup;
              options.body = {
                group_id: groupId.id,
                user_id: userBody.id
              };
              Request(options, function (error, response, addGroupBody) {
                if (error) console.log("user already belong to that group");
                options.url = config.metabase.uri + config.collections;
                options.body = {
                  name: user+" - "+req.body.originCollection,
                  color: getRandomColor(),
                  description: "Collection for agency " + user,
                };
                Request(options, async function (error, response, collectionBody) {
                  if (error) return callback(error);
                  let collection;
                  if (collectionBody.errors) {
                    options.url = config.metabase.uri + config.collections;
                    options.method = 'GET';
                    delete options.body;
                    await Request(options, async function (error, response, cBody) {
                      collection = _.find(cBody, (col) => {
                        if (col.slug.indexOf(user.toLowerCase()) > -1)
                          return col;
                      })
                    });
                    options.method = 'POST';
                  }else {
                    collection = collectionBody;
                  }

                  if (collection) {

                    try {
                      await client.query(`INSERT INTO permissions (object, group_id) VALUES ( '/collection/${collection.id}/read/', ${groupId.id})`);
                    }catch (error){
                      console.log("User already has permission");
                    }

                    let jsonToParse = JSON.parse(dashboardInfo.rows[0].parameters);

                    jsonToParse = JSON.stringify(jsonToParse);

                    let dashboardName = req.body.originDashboard + " - ";

                    dashboardName += user;

                    const newDashboard = await client.query("INSERT INTO report_dashboard (created_at,updated_at,name,description,creator_id,parameters,"+
                      "points_of_interest,caveats,show_in_getting_started,public_uuid,made_public_by_id,"+
                      "enable_embedding,embedding_params,archived,position)"+
                      "VALUES ( $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15 ) RETURNING id", [new Date(dashboardInfo.rows[0].created_at).toISOString(),new Date(dashboardInfo.rows[0].updated_at).toISOString(),
                      dashboardName, dashboardInfo.rows[0].description, dashboardInfo.rows[0].creator_id, jsonToParse, dashboardInfo.rows[0].points_of_interest,dashboardInfo.rows[0].caveats,
                      dashboardInfo.rows[0].show_in_getting_started, dashboardInfo.rows[0].public_uuid, dashboardInfo.rows[0].made_public_by_id, dashboardInfo.rows[0].enable_embedding ,
                      dashboardInfo.rows[0].embedding_params, dashboardInfo.rows[0].archived, dashboardInfo.rows[0].position ]);

                    _async.each(queryResponse.rows, (card, cardsCallback) => {

                      let newQuery = JSON.parse(card.dataset_query);

                      let cardName = card.name;

                      cardName = cardName.replace(req.body.originView, user.toLowerCase());

                      while(newQuery.native.query.indexOf(req.body.originView) > -1 ){
                        newQuery.native.query = newQuery.native.query.replace(req.body.originView, user.toLowerCase());
                      }

                      let originView = newQuery.native.query.slice(newQuery.native.query.indexOf(user.toLowerCase()+"_"), newQuery.native.query.length).split(" ")[0];
                      originView = originView.split("\n")[0].toLowerCase();
                      originView = originView.split(".")[0];


                      client.query(`SELECT db_id, schema, id from metabase_table where name = $1`,[originView], (err, resp) => {
                        client.query(`INSERT INTO permissions (object, group_id) VALUES ( '/db/${resp.rows[0].db_id}/schema/${resp.rows[0].schema}/table/${resp.rows[0].id}/',${groupId.id})`, (err, res) => {
                          if (err) console.log("permission already exists on db");
                        });
                      });

                      _async.each(Object.keys(newQuery.native.template_tags), (key, callb) => {
                        client.query("Select b.id from metabase_table a inner join metabase_field b ON a.id = b.table_id where a.name = $1 and b.name = $2 ", [originView, key], (err, resp) => {
                          if (err) callb(err);
                          if (resp.rows.length > 0)
                            newQuery.native.template_tags["" + key + ""].dimension = ["field-id", resp.rows[0].id];
                          callb();
                        });

                      }, (err) => {
                        if(err) return cardsCallback(err);

                        newQuery = JSON.stringify(newQuery);

                        let metadataResult = JSON.parse(card.result_metadata);

                        metadataResult = JSON.stringify(metadataResult);

                        client.query("INSERT INTO report_card (created_at, updated_at, name, description, display, dataset_query,"+
                          "visualization_settings, creator_id, database_id, table_id, query_type,"+
                          "archived, collection_id, public_uuid, made_public_by_id, enable_embedding,"+
                          "embedding_params, cache_ttl, result_metadata)"+
                          "VALUES ( $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) RETURNING id",
                          [new Date (card.created_at).toISOString(),new Date(card.updated_at).toISOString(),cardName,card.description,card.display,newQuery,
                            card.vis_set_report_card,card.creator_id,card.database_id,card.table_id,card.query_type,
                            card.archived,collectionBody.id,card.public_uuid,card.made_public_by_id,card.enable_embedding,
                            card.embedding_params,card.cache_ttl,metadataResult], (err, res) => {
                            if(err) return cardsCallback(err);
                            if(res) {
                              let parameterMappings = JSON.parse(card.parameter_mappings);
                              let changedParameterMappings = [];

                              _.forEach(parameterMappings, (parameter) => {
                                parameter.card_id = res.rows[0].id;
                                changedParameterMappings.push(parameter);
                              });

                              changedParameterMappings = JSON.stringify(changedParameterMappings);

                              client.query("INSERT INTO report_dashboardcard (created_at,updated_at,\"sizeX\",\"sizeY\",row,col,card_id,dashboard_id,parameter_mappings,visualization_settings)" +
                                "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
                                [new Date(card.created_at).toISOString(), new Date(card.updated_at).toISOString(), card.sizeX, card.sizeY, card.row,
                                  card.col, res.rows[0].id, newDashboard.rows[0].id, changedParameterMappings,
                                  card.vis_set_dashboard_card], (err, res) => {
                                  if(err) return cardsCallback(err);
                                  return cardsCallback();
                                });
                            }else{
                              return cardsCallback({message: "Error on insert"})
                            }
                          });
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
          return res.status(201).json({message: "All created and duplicated from Collection "+ req.body.originCollection + " and Dashboard "+req.body.originDashboard});
        })
      }else{
        return res.status(400).json({message: "Error_on_auth"});
      }
    })
  } else {
    return res.status(400).json({message: "Missing_params"});
  }
};

/* POST BODY USERS EXISTS

{
	"username":["r42"],
	"originCollection":"Dashboards modelo",
	"originDashboard": "*Monitoreo",
	"originView": "gv"
}

 */

module.exports.createAgencyFromDB = async (req, res) => {

  // Conection to the database and search in the database for the collection and dashboard id to clone. With those ids we look into the database for the questions to clone.

  const client = new Client(config.dbMetabase);

  await client.connect();

  const collectionId = await client.query(`SELECT id from collection where name = '${req.body.originCollection}' `);

  if(collectionId.rows.length === 0) return res.status(404).json({message: "origin_collection_does_not_exists"});

  const dashboardInfo = await client.query(`SELECT * from report_dashboard where name = '${req.body.originDashboard}' `);

  if(dashboardInfo.rows.length === 0) return res.status(404).json({message: "origin_dashboard_does_not_exists"});

  const queryResponse = await client.query(`SELECT *, a.visualization_settings vis_set_dashboard_card, b.visualization_settings vis_set_report_card from report_card B INNER JOIN report_dashboardcard A on A.card_id = B.id where b.collection_id = ${collectionId.rows[0].id} and dashboard_id = ${dashboardInfo.rows[0].id}`);

  if(queryResponse.rows.length === 0 ) return res.status(404).json({message: "no_questions_to_clone"});

  let varToSend = JSON.stringify(req.body.username).replace("[", "").replace("]", "");

  while (varToSend.indexOf("\"") > -1) {
    varToSend = varToSend.replace("\"", "'");
  }

  // look in the database for the user to create the dashboard.
  const users = await client.query("SELECT * FROM core_user where is_superuser = false and is_active = true and (LOWER(first_name) in (" + varToSend.toLowerCase() + ") or LOWER(last_name) in (" + varToSend.toLowerCase() + ")) order by first_name asc limit 4");
  if (users.rows.length === 0) return res.status(404).json({message: "user_does_not_exist_on_db"});

  // We set the parameters to authenticate with the metabase api.

  options.url = config.metabase.uri + config.auth;
  options.body = {
    username: config.username,
    password: config.password
  };

  Request(options, function (error, response, metaBody) {
    if (error) return res.status(400).json({message: "Error on auth with metabase service"});

    //if metabody has id that means that the user authenticated correctly and now we can start the process.
    if (metaBody.id) {
      // We set the parameters to fetch all the groups on the system.
      options.method = 'GET';
      options.url = config.metabase.uri + config.groups;
      options.headers['X-Metabase-Session'] = metaBody.id;

      Request(options, function (error, response, gBody) {

        //Once we have the group information we start the user cycle to start the clonning process.
        _async.eachSeries(users.rows, (user, gcallback) => {

          // to avoid creating dashboard from users that are not agencies or regions we limit the user first name to 3 or to the word REGION.

          if (user.first_name.length <= 3 || user.first_name === "REGION") {

            let group = _.find(gBody, (g) => {
              if ((g.name.toLowerCase() === user.first_name.toLowerCase()) || g.name.toLowerCase() === user.last_name.toLowerCase())
                return g
            });

            // if user group doesn't exist we have to create the group and assign that user to that new group.
            if (group === undefined) {
              options.method = 'POST';
              options.url = config.metabase.uri + config.groups;
              options.body = {
                name: user.email.split("@")[0]
              };

              Request(options, function (error, response, groupsBody) {
                if (error) return gcallback(error);
                let groupId;
                //this is a double check in case of something went wrong before, the result of the post is a string that means that the user group did exist and i look for it to assign it.
                if (_.isString(groupsBody)) {
                  options.url = config.metabase.uri + config.groups;
                  options.method = 'GET';
                  delete options.body;
                  Request(options, async function (error, response, gBody) {
                    groupId = _.find(gBody, (grp) => {
                      if (grp.name.indexOf(user.email.split("@")[0].toLowerCase()) > -1)
                        return grp;
                    })
                  });
                  options.method = 'POST';
                } else {
                  groupId = groupsBody;
                }
                options.url = config.metabase.uri + config.addUsertoGroup;
                options.body = {
                  group_id: groupId.id,
                  user_id: user.id
                };

                // we assign the user to the group.
                Request(options, function (error, response, addGroupBody) {
                  if (error) console.log("user already belong to that group");
                  options.url = config.metabase.uri + config.collections;
                  options.body = {
                    name: user.first_name+" "+user.last_name+" - "+req.body.originCollection,
                    color: getRandomColor(),
                    description: "Collection for agency " + user.first_name + " " + user.last_name,
                  };
                  // we create the new collection or if the collection exists we use the current collection id.
                  Request(options, async function (error, response, collectionBody) {
                    if (error) return gcallback(error);
                    let collection;
                    if (collectionBody.errors) {
                      options.url = config.metabase.uri + config.collections;
                      options.method = 'GET';
                      delete options.body;
                      await Request(options, async function (error, response, cBody) {
                        collection = _.find(cBody, (col) => {
                          if (col.slug.indexOf(user.toLowerCase()) > -1)
                            return col;
                        })
                      });
                      options.method = 'POST';
                    } else {
                      collection = collectionBody;
                    }

                    if (collection) {
                      // we manually add the group permissions to the database.

                      try {
                        await client.query(`INSERT INTO permissions (object, group_id) VALUES ( '/collection/${collection.id}/read/', ${groupId.id})`);
                      }catch (error){
                        console.log("User already has permission");
                      }

                      let jsonToParse = JSON.parse(dashboardInfo.rows[0].parameters);

                      jsonToParse = JSON.stringify(jsonToParse);

                      let dashboardName = req.body.originDashboard + " - ";
                      dashboardName += user.first_name === "REGION" ? user.last_name : user.first_name;

                      // We first create the dashboard by cloning all the origin dashboard properties and only changing the name.

                      const newDashboard = await client.query("INSERT INTO report_dashboard (created_at,updated_at,name,description,creator_id,parameters," +
                        "points_of_interest,caveats,show_in_getting_started,public_uuid,made_public_by_id," +
                        "enable_embedding,embedding_params,archived,position)" +
                        "VALUES ( $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15 ) RETURNING id", [new Date(dashboardInfo.rows[0].created_at).toISOString(), new Date(dashboardInfo.rows[0].updated_at).toISOString(),
                        dashboardName, dashboardInfo.rows[0].description, dashboardInfo.rows[0].creator_id, jsonToParse, dashboardInfo.rows[0].points_of_interest, dashboardInfo.rows[0].caveats,
                        dashboardInfo.rows[0].show_in_getting_started, dashboardInfo.rows[0].public_uuid, dashboardInfo.rows[0].made_public_by_id, dashboardInfo.rows[0].enable_embedding,
                        dashboardInfo.rows[0].embedding_params, dashboardInfo.rows[0].archived, dashboardInfo.rows[0].position]);

                      _async.eachSeries(queryResponse.rows, (card, cardsCallback) => {

                        // after we created the new dashboard we create the questions and associate them with the dashboard and also we create the db view permissions.

                        let newQuery = JSON.parse(card.dataset_query);

                        // we change the origin view name with the new view name.

                        while(newQuery.native.query.indexOf(req.body.originView) > -1 ){
                          newQuery.native.query = newQuery.native.query.replace(req.body.originView, user.email.split("@")[0].toLowerCase());
                        }

                        let cardName = card.name;

                        cardName = cardName.replace(req.body.originView, user.email.split("@")[0]);

                        let originView = newQuery.native.query.slice(newQuery.native.query.indexOf(user.email.split("@")[0].toLowerCase() + "_"), newQuery.native.query.length).split(" ")[0];
                        originView = originView.split("\n")[0].toLowerCase();
                        originView = originView.split(".")[0];

                        client.query(`SELECT db_id, schema, id from metabase_table where name = $1`, [originView], (err, resp) => {
                          client.query(`INSERT INTO permissions (object, group_id) VALUES ( '/db/${resp.rows[0].db_id}/schema/${resp.rows[0].schema}/table/${resp.rows[0].id}/',${groupId.id})`, (err, res) => {
                            if (err) console.log("permission already exists on db");
                          });
                        });

                        // this is where we map every question variable.

                        _async.eachSeries(Object.keys(newQuery.native.template_tags), (key, callb) => {
                          client.query("Select b.id from metabase_table a inner join metabase_field b ON a.id = b.table_id where a.name = $1 and b.name = $2 ", [originView, key], (err, resp) => {
                            if (err) callb(err);
                            if (resp.rows.length > 0)
                              newQuery.native.template_tags["" + key + ""].dimension = ["field-id", resp.rows[0].id];
                            callb();
                          });
                        }, (err) => {
                          if (err) return cardsCallback(err);

                          newQuery = JSON.stringify(newQuery);

                          let metadataResult = JSON.parse(card.result_metadata);

                          metadataResult = JSON.stringify(metadataResult);

                          // we create the question, clone all the similar information and we only change the collection id and the query with the new db view.

                          client.query("INSERT INTO report_card (created_at, updated_at, name, description, display, dataset_query," +
                            "visualization_settings, creator_id, database_id, table_id, query_type," +
                            "archived, collection_id, public_uuid, made_public_by_id, enable_embedding," +
                            "embedding_params, cache_ttl, result_metadata)" +
                            "VALUES ( $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) RETURNING id",
                            [new Date(card.created_at).toISOString(), new Date(card.updated_at).toISOString(), cardName, card.description, card.display, newQuery,
                              card.vis_set_report_card, card.creator_id, card.database_id, card.table_id, card.query_type,
                              card.archived, collectionBody.id, card.public_uuid, card.made_public_by_id, card.enable_embedding,
                              card.embedding_params, card.cache_ttl, metadataResult], (err, res) => {
                              if (err) return cardsCallback(err);
                              if (res) {
                                let parameterMappings = JSON.parse(card.parameter_mappings);
                                let changedParameterMappings = [];

                                // this is where we map all the card parameters.
                                _.forEach(parameterMappings, (parameter) => {
                                  parameter.card_id = res.rows[0].id;
                                  changedParameterMappings.push(parameter);
                                });

                                changedParameterMappings = JSON.stringify(changedParameterMappings);

                                // after we map we have to put that question into the dashboard, we preserve everything the same and we only change the origin dashboard id with the new dashboard id and the mapped parameters.

                                client.query("INSERT INTO report_dashboardcard (created_at,updated_at,\"sizeX\",\"sizeY\",row,col,card_id,dashboard_id,parameter_mappings,visualization_settings)" +
                                  "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
                                  [new Date(card.created_at).toISOString(), new Date(card.updated_at).toISOString(), card.sizeX, card.sizeY, card.row,
                                    card.col, res.rows[0].id, newDashboard.rows[0].id, changedParameterMappings,
                                    card.vis_set_dashboard_card], (err, res) => {
                                    if (err) return cardsCallback(err);
                                    return cardsCallback();
                                  });
                              } else {
                                return cardsCallback({message: "Error on insert"})
                              }
                            });
                        });
                      }, (err) => {
                        if (err) return gcallback(err);
                        return gcallback();
                      })
                    } else {
                      return gcallback();
                    }
                  });
                })
              })
            } else {
              // This is the same process but only not creating the group because already exists.

              options.method = 'POST';
              options.url = config.metabase.uri + config.addUsertoGroup;
              options.body = {
                group_id: group.id,
                user_id: user.id
              };

              Request(options, function (error, response, addGroupBody) {
                if (error || addGroupBody.message) console.log("user already belong to that group");
                options.url = config.metabase.uri + config.collections;
                options.body = {
                  name: user.first_name+" "+user.last_name+" - "+req.body.originCollection,
                  color: getRandomColor(),
                  description: "Collection for agency " + user.first_name,
                };
                Request(options, async function (error, response, collectionBody) {
                  if (error) return gcallback(error);
                  let collection;

                  if (collectionBody.errors) {
                    options.url = config.metabase.uri + config.collections;
                    options.method = 'GET';
                    delete options.body;

                    collection = await new Promise( (resolve,reject) => {
                      Request(options, async function (error, response, cBody) {
                        if(error) reject(error);
                        _.find(cBody, (col) => {
                          if (col.slug.indexOf(user.first_name.toLowerCase()) > -1)
                            resolve (col);
                        })
                      });
                    });

                    options.method = 'POST';
                  } else {
                    collection = collectionBody;
                  }

                  if (collection) {

                    try {
                      await client.query(`INSERT INTO permissions (object, group_id) VALUES ( '/collection/${collection.id}/read/', ${group.id})`)
                    }catch (error){
                      console.log("User already has permission");
                    }

                    let jsonToParse = JSON.parse(dashboardInfo.rows[0].parameters);

                    jsonToParse = JSON.stringify(jsonToParse);

                    let dashboardName = req.body.originDashboard + " - ";
                    dashboardName += user.first_name === "REGION" ? user.last_name : user.first_name;

                    const newDashboard = await client.query("INSERT INTO report_dashboard (created_at,updated_at,name,description,creator_id,parameters," +
                      "points_of_interest,caveats,show_in_getting_started,public_uuid,made_public_by_id," +
                      "enable_embedding,embedding_params,archived,position)" +
                      "VALUES ( $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15 ) RETURNING id", [new Date(dashboardInfo.rows[0].created_at).toISOString(), new Date(dashboardInfo.rows[0].updated_at).toISOString(),
                      dashboardName, dashboardInfo.rows[0].description, dashboardInfo.rows[0].creator_id, jsonToParse, dashboardInfo.rows[0].points_of_interest, dashboardInfo.rows[0].caveats,
                      dashboardInfo.rows[0].show_in_getting_started, dashboardInfo.rows[0].public_uuid, dashboardInfo.rows[0].made_public_by_id, dashboardInfo.rows[0].enable_embedding,
                      dashboardInfo.rows[0].embedding_params, dashboardInfo.rows[0].archived, dashboardInfo.rows[0].position]);

                    _async.eachSeries(queryResponse.rows, (card, cardsCallback) => {

                      let newQuery = JSON.parse(card.dataset_query);

                      while(newQuery.native.query.indexOf(req.body.originView) > -1 ){
                        newQuery.native.query = newQuery.native.query.replace(req.body.originView, user.email.split("@")[0].toLowerCase());
                      }

                      let cardName = card.name;

                      cardName = cardName.replace(req.body.originView, user.email.split("@")[0]);

                      let originView = newQuery.native.query.slice(newQuery.native.query.indexOf(user.email.split("@")[0].toLowerCase() + "_"), newQuery.native.query.length).split(" ")[0];
                      originView = originView.split("\n")[0].toLowerCase();
                      originView = originView.split(".")[0];

                      client.query(`SELECT db_id, schema, id from metabase_table where name = $1`,[originView], (err, resp) => {
                        client.query(`INSERT INTO permissions (object, group_id) VALUES ( '/db/${resp.rows[0].db_id}/schema/${resp.rows[0].schema}/table/${resp.rows[0].id}/',${group.id})`, (err, res) => {
                          if (err) console.log("permission already exists on db");
                        });
                      });

                      _async.eachSeries(Object.keys(newQuery.native.template_tags), (key, callb) => {
                        client.query("Select b.id from metabase_table a inner join metabase_field b ON a.id = b.table_id where a.name = $1 and b.name = $2 ", [originView, key], (err, resp) => {
                          if (err) callb(err);
                          if (resp.rows.length > 0)
                            newQuery.native.template_tags["" + key + ""].dimension = ["field-id", resp.rows[0].id];
                          callb();
                        });

                      }, (err) => {
                        if (err) return cardsCallback(err);

                        newQuery = JSON.stringify(newQuery);

                        let metadataResult = JSON.parse(card.result_metadata);

                        metadataResult = JSON.stringify(metadataResult);

                        client.query("INSERT INTO report_card (created_at, updated_at, name, description, display, dataset_query," +
                          "visualization_settings, creator_id, database_id, table_id, query_type," +
                          "archived, collection_id, public_uuid, made_public_by_id, enable_embedding," +
                          "embedding_params, cache_ttl, result_metadata)" +
                          "VALUES ( $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) RETURNING id",
                          [new Date(card.created_at).toISOString(), new Date(card.updated_at).toISOString(), cardName, card.description, card.display, newQuery,
                            card.vis_set_report_card, card.creator_id, card.database_id, card.table_id, card.query_type,
                            card.archived, collectionBody.id, card.public_uuid, card.made_public_by_id, card.enable_embedding,
                            card.embedding_params, card.cache_ttl, metadataResult], (err, res) => {
                            if (err) return cardsCallback(err);
                            if (res) {
                              let parameterMappings = JSON.parse(card.parameter_mappings);
                              let changedParameterMappings = [];

                              _.forEach(parameterMappings, (parameter) => {
                                parameter.card_id = res.rows[0].id;
                                changedParameterMappings.push(parameter);
                              });

                              changedParameterMappings = JSON.stringify(changedParameterMappings);

                              client.query("INSERT INTO report_dashboardcard (created_at,updated_at,\"sizeX\",\"sizeY\",row,col,card_id,dashboard_id,parameter_mappings,visualization_settings)" +
                                "VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)",
                                [new Date(card.created_at).toISOString(), new Date(card.updated_at).toISOString(), card.sizeX, card.sizeY, card.row,
                                  card.col, res.rows[0].id, newDashboard.rows[0].id, changedParameterMappings,
                                  card.vis_set_dashboard_card], (err, res) => {
                                  if (err) return cardsCallback(err);
                                  return cardsCallback();
                                });
                            } else {
                              return cardsCallback({message: "Error on insert"})
                            }
                          });
                      });
                    }, (err) => {
                      if (err) return gcallback(err);
                      return gcallback();
                    })
                  } else {
                    return gcallback();
                  }
                });
              })
            }
          } else {
            console.log("user discarted ---->", user);
            gcallback();
          }
        }, (err) => {
          console.log("Some error ? ",err);
          if (err) return res.status(400).json({message: "Error_creating_collections", error: err});
          client.end();
          return res.status(200).json("Dashboards clonated sucessfully");
        })
      })
    }
    else {
      console.log(metaBody);
      client.end();
      return res.status(400).json(metaBody);
    }
  });
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

          options.body = {
            first_name: agency.oficial,
            last_name: agency.agencia,
            email: agency.oficial.toLowerCase()+"@baccredomatic.gt",
            password: agency.oficial+config.generalPassword
          };

          Request(options, function (error, response, userBody) {
            if (error) return callback(error);

            options.url = config.metabase.uri + config.addUsertoGroup;
            options.body = {
              group_id: groupsBody.id,
              user_id: userBody.id
            };

            Request(options, function (error, response, addGroupBody) {
              if (error) console.log("user already belong to that group");
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
            email: agency.region.toLowerCase()+"@baccredomatic.gt",
            password: agency.region+config.generalPassword
          };

          Request(options, function (error, response, userBody) {
            if (error) return callback(error);

            options.url = config.metabase.uri + config.addUsertoGroup;
            options.body = {
              group_id: groupsBody.id,
              user_id: userBody.id
            };

            Request(options, function (error, response, addGroupBody) {
              if (error) console.log("user already belong to that group");
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