'use strict';

const Homey = require('homey');

class SoundtouchDriver extends Homey.Driver {
    onPairListDevices(data, callback ) {

        let devices = [];
        devices.push({
            name: 'Soundtouch 10',
            data: {
                id: 'soundtouch10',
                ip: '192.168.1.17',
                port: 8090
            }
        });

        devices.push({
            name: 'Soundtouch 30',
            data: {
                id: 'soundtouch30',
                ip: '192.168.1.2',
                port: 8090
            }
        });

        callback( null, devices);
    }
}

module.exports = SoundtouchDriver;