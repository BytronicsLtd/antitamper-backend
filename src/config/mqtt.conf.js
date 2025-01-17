// MqttClient.js
const chalk = require('chalk');
const mqtt = require('mqtt');

class MqttClient {
    constructor({ host, port, username, password, custom_name, topic }) {
        
        if (MqttClient.instance) {
            console.log("Mqtt already connected");
            return MqttClient.instance;
        }
        this.host = host;
        this.port = port;
        this.username = username;
        this.password = password;
        this.custom_name = custom_name;
        this.client_id = `mqtt_${Math.random().toString(16).slice(3)}`;
        this.url = `mqtt://${host}:${port}`;
        this.topic = topic;
        this.client = null;
        MqttClient.instance = this;

    }

    connect() {
        return new Promise((resolve, reject) => {
            if (this.client) {
                resolve();
                return;
            }
            this.client = mqtt.connect(this.url, {
                clientId: this.client_id,
                username: this.username,
                password: this.password,
                custom_name: this.custom_name
            })

            this.client.on('connect', () => {
                console.log('Connected to MQTT broker');
                resolve();
                this.client.subscribe(this.topic, (err) => {
                    if (err) {
                        console.log(chalk.red("Could not subscribe to "), chalk.yellow.bold(this.topic));
                    }
                    else {
                        console.log("subscribed to topic ", this.topic)
                    }
                });
            });

            this.client.on('error', (err) => {
                console.error('MQTT error:', err);
                reject(err);
            });
        });
    }

    subscribe(topic) {
        return new Promise((resolve, reject) => {
            if (!this.client) {
                reject(new Error('MQTT client not connected'));
                return;
            }

            this.client.subscribe(topic, (err) => {
                if (!err) {
                    console.log(`Subscribed to ${topic}`);
                    resolve();
                } else {
                    console.error('Subscription error:', err);
                    reject(err);
                }
            });
        });
    }

    publish(topic, message) {
        return new Promise((resolve, reject) => {
            if (!this.client) {
                reject(new Error('MQTT client not connected'));
                return;
            }

            this.client.publish(topic, message, (err) => {
                if (!err) {
                    resolve();
                } else {
                    reject(err);
                }
            });
        });
    }

    onMessage(callback) {
        if (!this.client) {
            throw new Error('MQTT client not connected');
        }

        this.client.on('message', (topic, message) => {
            callback(topic, message.toString());
        });
    }

    disconnect() {
        return new Promise((resolve) => {
            if (this.client) {
                this.client.end(false, () => {
                    console.log('Disconnected from MQTT broker');
                    this.client = null;
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
}

module.exports = MqttClient;