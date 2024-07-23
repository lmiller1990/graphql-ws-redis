import redis
import time
import json

client = redis.Redis(host="localhost", port=6379, db=0)


def publish():
    count = 0
    while True:
        count += 1
        message = f"Count {count}"
        client.publish("HELLO_CHANNEL", json.dumps({ "hello": message }))
        time.sleep(1)


publish()
