const mysql = require('mysql2');
require('dotenv').config();

const checkDatabase = () => {
    const connection = mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD
    });

    return new Promise((resolve, reject) => {
        connection.connect((err) => {
            if (err) {
                console.error('Error connecting to MySQL:', err);
                reject(err);
                return;
            }

            // Check if database exists
            connection.query(`SHOW DATABASES LIKE '${process.env.DB_NAME}'`, (err, results) => {
                if (err) {
                    console.error('Error checking database:', err);
                    connection.end();
                    reject(err);
                    return;
                }

                if (results.length === 0) {
                    console.error(`Database ${process.env.DB_NAME} does not exist`);
                    connection.end();
                    reject(new Error(`Database ${process.env.DB_NAME} does not exist`));
                    return;
                }

                console.log('Database check passed');
                connection.end();
                resolve();
            });
        });
    });
};

module.exports = checkDatabase; 