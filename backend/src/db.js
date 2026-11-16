import mysql from 'mysql2/promise';
export function createPool(options) {
  const pool = mysql.createPool(options);
  pool.on('connection', (connection) => {
    connection.query("SET time_zone = '+00:00'");
  });
  return pool;
}

// Confirma todas as alterações juntas; em caso de erro, desfaz e libera a conexão.
export async function withTransaction(pool, action) {
  const db = await pool.getConnection();
  try {
    await db.beginTransaction();
    const result = await action(db);
    await db.commit();
    return result;
  } catch (error) {
    await db.rollback();
    throw error;
  } finally {
    db.release();
  }
}
