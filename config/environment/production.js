'use strict';
// Production specific configuration
// ==================================
module.exports = {
  metabase: {
    uri: 'http://metabase-v2.us-east-1.elasticbeanstalk.com'
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
    host: "dev-metabase.cg9u5bhsoxjc.us-east-1.rds.amazonaws.com",
    port: 5432,
    user: "kemokadmin",
    password: "$q%$=0#TyCI1.",
    database:"backemok"
  },

  dbMetabase: {
    host: "aa1ufiml1cmxajv.cg9u5bhsoxjc.us-east-1.rds.amazonaws.com",
    port: 5432,
    user: "kemokadmin",
    password: "$q%$=0#TyCI1.",
    database:"ebdb"
  },

  ip:'127.0.0.1',
  port:9001
};