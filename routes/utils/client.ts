import { createClient, type RedisClientType } from "redis";


let client: RedisClientType | null = null;

export async function initializeRedisClient() {
  if(!client) {
    // Notice that there is no url to redis. Neither in the .env file nor in this file as there is {url: $url} which is accepted by the create client funciton
    // This is not given because the redis automatically tries to connnect to the localhost:6379 
    // As i am using docker container running redis exposed on port 6379, i don't need to configure
    // In production, you need to give the ip address or the domain to your redis instance. This only works for localhost
    // if there is no instance running on the localhost:6379, this operation may or may not fail
    client = createClient();
    client.on("error", (error)=> {
      console.error(error)
    })
    client.on("connect", ()=> {
      console.log("Redis Connected")
    })
    await client.connect()
  }
  return client;
}
