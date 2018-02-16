'use strict';

const Homey = require('homey');

class SoundtouchDriver extends Homey.Driver {
    onPair(socket) {
        socket.on('save', async (data, callback) => {
            const settings = {
                ip: data.ip
            };
            callback(settings);
        });
    }

}

module.exports = SoundtouchDriver;