import axios from 'axios';
import * as config from '../config.json';
const tmi = require('tmi.js');

module Idler {
    export class Idler {
        private clientId: string = config.clientId;
        private userName: string = config.userName;
        private userAuth: string = config.userAuth;
        private Token: string = config.token;


        private userId: string = '';
        public part: Array<string> = [];

        private clientOptions: object = {
            connection: {
                reconnect: true,
                secure: true
            },
            identity: {
                username: this.userName,
                password: this.userAuth
            },
            channels: []
        }
        private client: any;

        public getUserId(userName: string) {
            return axios.get(`https://api.twitch.tv/helix/users`, {
                params: {
                    login: userName
                },
                headers: {
                    'Client-ID': this.clientId,
                    'Authorization': `Bearer ${this.Token}`
                }
            })
        }

        // Returns a list of channels followed by given userId
        public getFollowing(userId: string) {
            return axios.get(`https://api.twitch.tv/helix/users/follows`, {
                params: {
                    from_id: userId,
                    first: 100
                },
                headers: {
                    'Client-ID': this.clientId,
                    'Authorization': `Bearer ${this.Token}`
                }
            })
        }

        // Returns a list of Top channels
        public getTopChannels() {
            return axios.get(`https://api.twitch.tv/helix/streams`, {
                params: {
                    first: 50
                },
                headers: {
                    'Client-ID': this.clientId,
                    'Authorization': `Bearer ${this.Token}`
                }
            })
        }

        // Returns a list of live channels
        // Input: Array of usernames to check, retruns only channels that are live
        public checkLiveChannels(channels: Array<string>) {
            return axios.get(`https://api.twitch.tv/helix/streams`, {
                params: {
                    user_login: channels
                },
                headers: {
                    'Client-ID': this.clientId,
                    'Authorization': `Bearer ${this.Token}`
                }
            })
        }

        public joinChannel(channel: string) {
            this.client.join(channel);
            this.part.push(channel);
            console.log('DEBUG | Joined channel', channel);
        }

        public partChannel(channel: string) {
            this.client.part(channel);
            this.part = this.part.filter(p => p !== channel);
            console.log('DEBUG | Left channel', channel);
        }

        private init() {
            // Connect Twitch client
            this.client = new tmi.client(this.clientOptions);
            this.client.connect();

            // Prepare data for api requests
            return new Promise((resolve, reject) => {
                if (!this.userId || this.userId === '' || !this.client) {
                    this.getUserId(this.userName)
                        .then(res => {
                            this.userId = res.data.data.length > 0 ? res.data.data[0].id : undefined;
                            if (this.userId || this.userId !== '') {
                                console.log('DEBUG | Received user-id');
                                resolve();
                            } else {
                                reject();
                            }
                        })
                } else {
                    resolve();
                }
            })
        }

        public idle() {
            this.init()
                .then(() => {
                    console.log('DEBUG | Starting idle process');
                    setInterval(() => {
                        this.getFollowing(this.userId)
                            .then(res => {
                                console.log('DEBUG | Received following channels');
                                this.checkLiveChannels(res.data.data.map((e: { to_name: any; }) => e.to_name))
                                    .then(channels => {
                                        console.log('DEBUG | Received live channels');
                                        let liveChannels = channels.data.data.map((c: { user_name: any; }) => c.user_name);

                                        // Get Top 50 streams 
                                        this.getTopChannels().then(channels => {
                                            console.log('DEBUG | Received top channels');
                                            liveChannels = liveChannels.concat(channels.data.data.map((c: { user_name: any; }) => c.user_name)).filter((user: any) => /^[a-zA-Z_0-9.]+$/.test(user))

                                            // Join online channels we aren't part of
                                            liveChannels.map((channel: string) => {
                                                if (!this.part.includes(channel)) {
                                                    this.joinChannel(channel);
                                                }
                                            })

                                            // Leave channels we are part of, but which are not online anymore
                                            this.part.map(channel => {
                                                if (!liveChannels.includes(channel)) {
                                                    this.partChannel(channel);
                                                }
                                            })
                                        })
                                    })
                            });
                    }, 60000);
                }, () => {
                    throw new Error('ERROR | Could not get user id.');
                })
        }
    }
}

export = Idler;