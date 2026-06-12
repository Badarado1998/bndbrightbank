const mysql = require('mysql2/promise');

const host = process.env.MYSQL_HOST;
const user = process.env.MYSQL_USER;
const password = process.env.MYSQL_PASSWORD;
const database = process.env.MYSQL_DATABASE;
const port = process.env.MYSQL_PORT || 3306;

let pool = null;

if (host && user && database) {
    try {
        pool = mysql.createPool({
            host,
            user,
            password,
            database,
            port: parseInt(port),
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            ssl: {
                rejectUnauthorized: false // Prevents Hostinger database SSL handshake warnings
            }
        });
        console.log("[MySQL] Connection pool created successfully.");
    } catch (e) {
        console.error("[MySQL] Error creating connection pool:", e);
    }
}

const mysqlHelper = pool ? {
    async query(sql, params = []) {
        const [rows] = await pool.execute(sql, params);
        return rows;
    },

    async get(sql, params = []) {
        const rows = await this.query(sql, params);
        return rows.length > 0 ? rows[0] : null;
    },

    async all(sql, params = []) {
        return await this.query(sql, params);
    },

    async run(sql, params = []) {
        const [result] = await pool.execute(sql, params);
        return {
            id: result.insertId,
            changes: result.affectedRows
        };
    },

    async transaction(callback) {
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        try {
            const txHelper = {
                async query(sql, params = []) {
                    const [rows] = await connection.execute(sql, params);
                    return rows;
                },
                async get(sql, params = []) {
                    const rows = await this.query(sql, params);
                    return rows.length > 0 ? rows[0] : null;
                },
                async all(sql, params = []) {
                    return await this.query(sql, params);
                },
                async run(sql, params = []) {
                    const [result] = await connection.execute(sql, params);
                    return {
                        id: result.insertId,
                        changes: result.affectedRows
                    };
                }
            };
            const result = await callback(txHelper);
            await connection.commit();
            return result;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
} : null;

module.exports = mysqlHelper;
