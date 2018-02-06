'use strict';

// Development specific configuration
// ==================================
module.exports = {
  metabase: {
    uri: 'http://metabase-2n3qs-env.us-east-1.elasticbeanstalk.com'
  },
  username: "cesar.augs@gmail.com",
  password: "holamundo.123456",
  card: "/api/card",
  auth:"/api/session",
  users:"/api/user",
  groups:"/api/permissions/group",
  addUsertoGroup: "/api/permissions/membership",
  generalPassword: "Hol@.Mund0",
  collections:"",

  db: {
    host: "dev-kemok-bac.cg9u5bhsoxjc.us-east-1.rds.amazonaws.com",
    port: 5432,
    user: "kemokadmin",
    password: "$q%$=0#TyCI1.",
    database:"backemok"
  },

  ip:'127.0.0.1',
  port:9001
};
