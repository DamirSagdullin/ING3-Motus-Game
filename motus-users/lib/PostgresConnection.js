const { Pool, Client } = require("pg");

class PostgresConnection {
  constructor(user, password, database, host, port) {
    this.pgClient = new Client({
      user,
      host,
      database,
      password,
      port,
    });

    this.pgPool = new Pool({
      user,
      host,
      database,
      password,
      port,
    });
  }

  async connect() {
    try {
      await this.pgClient.connect();
    } catch (err) {
      console.error("Failed to connect to Postgres:", err);
      process.exit(1);
    }

    while (true) {
      try {
        await this.pgClient.query("SELECT NOW()");
        console.log("Postgres is up");
        return;
      } catch (err) {
        console.log("Error:", err.message);
        console.log("Postgres is unavailable - sleeping");
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }

  async connectPool() {
    try {
      return await this.pgPool.connect();
    } catch (error) {
      console.error(error);
    }
  }

  async closeOnExit() {
    process.on("exit", async () => {
      await this.pgPool.release();
      await this.pgClient.end();
      console.log("Postgres client session closed");
    });
  }
}

module.exports = PostgresConnection;
