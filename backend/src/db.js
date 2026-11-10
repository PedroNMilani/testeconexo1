import mysql from 'mysql2/promise';
export function createPool(options) {
  const pool=mysql.createPool(options);
  pool.on('connection',connection=>{connection.query("SET time_zone = '+00:00'");});
  return pool;
}
