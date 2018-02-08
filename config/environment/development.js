'use strict';
const os = require('os');
const ifaces = os.networkInterfaces();
let serverIp;

Object.keys(ifaces).forEach(function (ifname) {
  var alias = 0;

  ifaces[ifname].forEach(function (iface) {
    if ('IPv4' !== iface.family || iface.internal !== false) {
      return;
    }

    if (alias >= 1) {
      serverIp = iface.address;
    } else {
      serverIp = iface.address;
    }
    ++alias;
  });
});

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
  generalPassword: "Hol@.Mund0",

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
