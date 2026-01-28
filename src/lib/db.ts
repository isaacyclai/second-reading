import { Pool } from 'pg'

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // Connection pool optimization
    max: 20,                    // Maximum number of connections
    idleTimeoutMillis: 30000,   // Close idle connections after 30s
    connectionTimeoutMillis: 5000, // Timeout after 5s if can't connect
})

export const query = async (text: string, params?: (string | number)[]) => {
    const res = await pool.query(text, params)
    return res
}

export default pool