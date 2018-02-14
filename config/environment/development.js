'use strict';
// Development specific configuration
// ==================================
module.exports = {
  metabase: {
    uri: 'http://metabase-2n3qs-env.us-east-1.elasticbeanstalk.com'
  },
  username: "tech@kemok.io",
  password: "0iX2op0xOmiBaT",
  card: "/api/card",
  auth:"/api/session",
  users:"/api/user",
  groups:"/api/permissions/group",
  addUsertoGroup: "/api/permissions/membership",
  collections:"/api/collection/",
  dashboard: "/api/dashboard/",
  generalPassword: "C@nalesBAC",

  db: {
    host: "dev-kemok-bac.cg9u5bhsoxjc.us-east-1.rds.amazonaws.com",
    port: 5432,
    user: "kemokadmin",
    password: "$q%$=0#TyCI1.",
    database:"backemok"
  },

  dbMetabase: {
    host: "aa9047ajg1b4c.cg9u5bhsoxjc.us-east-1.rds.amazonaws.com",
    port: 5432,
    user: "kemokadmin",
    password: "$q%$=0#TyCI1.",
    database:"ebdb"
  },

  ip: '0.0.0.0',
  port:9001
};