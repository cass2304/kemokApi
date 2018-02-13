const config = require('../../config/environment/development');
const {Client} = require('pg');

module.exports.updateFields = async (req, res) => {

  const client = new Client(config.dbMetabase);

  await client.connect();

  await client.query(`UPDATE metabase_field SET special_type = 'type/Category' WHERE name = $1`,[req.body.field], (err, resp) => {
    if (err) return res.status(400).json(err);
    return res.status(200).json({message: "All fields updated"});
  });

};