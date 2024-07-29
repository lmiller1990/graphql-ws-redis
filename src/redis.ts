import redis from "redis";

const CHANNEL = "HELLO_CHANNEL";

async function subscribeToChannel() {
  console.log("Subscribing...");
  // Create a Redis client and connect to the Redis server
  const subscriber = redis.createClient({
    url: "redis://localhost:6379", // Specify the Redis server URL
  });

  await subscriber.connect().catch(console.error);

  // Subscribe to 'test-channel'
  await subscriber.subscribe(CHANNEL, (msg) => {
    if (msg) {
      console.error("Msg => ", msg);
    } else {
      console.log("Subscribed!");
    }
  });

  // Log messages received from the 'test-channel'
  subscriber.on("message", (channel, message) => {
    console.log(`Received message from ${channel}: ${message}`);
  });

  // Handle errors
  subscriber.on("error", (err) => {
    console.error("Error from Redis subscriber:", err);
  });
}

// subscribeToChannel();
