'use strict';

const Homey = require('homey');

class SoundtouchDriver extends Homey.Driver {
    onPair(socket) {
        this.log('pairing started');
    }
}

module.exports = SoundtouchDriver;