const config = require('../../config/environment/production');
const {Client} = require('pg');
const _async = require('async');
const dateRegex = /([12]\d{3}-(0[1-9]|1[0-2]))/

/* POSTMAN PUT BODY
{
  "field":"agencia"
}
 */

module.exports.updateFields = async (req, res) => {

  const client = new Client(config.dbMetabase);

  await client.connect();

  await client.query(`UPDATE metabase_field SET special_type = 'type/Category' WHERE name = $1`,[req.body.field], (err, resp) => {
    if (err) return res.status(400).json(err);
    return res.status(200).json({message: "All fields updated"});
  });

};

/* POSTMAN PUT BODY
{
  "date":"2018-02"
}
 */

module.exports.updateDates = async (req, res) => {

  const client = new Client(config.dbMetabase);

  await client.connect();

  if(req.body.date && dateRegex.test(req.body.date)) {
    const dashboards = await client.query(`SELECT * FROM report_dashboard`)

    _async.forEachOf(dashboards.rows, (dashboard, i, callback) => {
      let parameters = JSON.parse(dashboard.parameters);

      _async.each(parameters, (param, callb) => {
        if (param.type === 'date/month-year') {
          param.default = req.body.date;
          parameters[i] = param;
        }
        callb();
      }, (err) => {
        if (err) return callback(err);
        parameters = JSON.stringify(parameters);
        client.query('UPDATE report_dashboard SET parameters = $1 WHERE id = $2',[parameters,dashboard.id], (err, res) => {
          if (err) return callback(err);
          callback();
        });
      })
    }, (err) => {
      if (err) return res.status(400).json(err);
      return res.status(200).json({message: "All fields updated"});
    });
  }else{
    return res.status(400).json({message: "missing_date_field_or_wrong_date", dateFormat: "YYYY-MM"});
  }
};