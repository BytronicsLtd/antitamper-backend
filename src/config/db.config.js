const chalk = require("chalk");
const mongoose = require("mongoose");

const connect = async () => {
  try {
    const db_ip = process.env.DB_IP;
    const db_port = process.env.DB_PORT;
    const db_user = process.env.DB_USER;
    const db_password = process.env.DB_PASSWORD;
    const db_name = process.env.DB_NAME;
    const rs_name = process.env.DB_RS_NAME;
    const host_0 = `${db_ip}:${db_port}`;
    const connection_string = `mongodb://${db_user}:${db_password}@${host_0}/`;
    console.log("connection string ", connection_string);
    //connect to database
    mongoose.set('strictQuery', false)
    const connection = await mongoose.connect(
      connection_string,
      {
        authSource: "admin",
        replicaSet: rs_name,
        dbName:db_name,
        directConnection:true,
        //
        maxPoolSize: 100,
        serverSelectionTimeoutMS: 30000,
      }
    );
    console.log(chalk.green("Database connection successful"));
    
    return connection;
  } catch (error) {
    console.log("Error connecting to database", error);
    return null;
  }
};

module.exports = connect;