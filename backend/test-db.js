import { MongoClient } from 'mongodb';

const uri = "mongodb://wasibk025_db_user:Wasibnagina%401@ac-xp5lfps-shard-00-00.r5ssqkz.mongodb.net:27017,ac-xp5lfps-shard-00-01.r5ssqkz.mongodb.net:27017,ac-xp5lfps-shard-00-02.r5ssqkz.mongodb.net:27017/mewat-play-chips?ssl=true&authSource=admin&replicaSet=atlas-gtrvpy-shard-0&appName=MewatPlayChips";

async function run() {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    console.log("Connected successfully to server");
  } catch (err) {
    console.log("Error connecting to MongoDB:", err);
  } finally {
    await client.close();
  }
}

run().catch(console.dir);
