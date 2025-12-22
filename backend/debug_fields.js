const db = require('./config/database');
db.masterPool.query('DESCRIBE students').then(([rows]) => {
    console.log(JSON.stringify(rows.map(r => r.Field)));
    process.exit(0);
}).catch(e => {
    console.error(e);
    process.exit(1);
});
