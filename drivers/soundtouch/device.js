'use strict';

const Homey = require('homey');
const Fetch = require('node-fetch');

class SoundtouchDevice extends Homey.Device {
    // this method is called when the Device is inited
    onInit() {
        this.log('device init');

        const playPresetAction = new Homey.FlowCardAction('play_preset');
        playPresetAction.register()
            .on('run', async (args, state, callback) => {
                this.sendKeyCommand('release', 'PRESET_' + args.preset_number);
                callback(null, true);
            });

        const createZoneWithAction = new Homey.FlowCardAction('create_zone_with');
        createZoneWithAction.register()
            .on('run', async (args, state, callback) => {
                console.log(args);
                console.log(state);
                callback(null, true);
            });

        this.registerMultipleCapabilityListener(['speaker_playing', 'speaker_prev', 'speaker_next', 'volume_set', 'volume_mute'], (value, opts) => {
            if (value.speaker_playing !== undefined) {
                if (value.speaker_playing === true) {
                    this.sendKeyCommand('press', 'PLAY');
                } else {
                    this.sendKeyCommand('press', 'PAUSE');
                }
            }

            if (value.speaker_prev !== undefined) {
                this.sendKeyCommand('press', 'PREV_TRACK');
            }

            if (value.speaker_next !== undefined) {
                this.sendKeyCommand('press', 'NEXT_TRACK');
            }

            if (value.volume_set !== undefined) {
                this.setVolume(value.volume_set);
            }

            if (value.volume_mute !== undefined) {
                this.sendKeyCommand('press', 'MUTE');
            }

            return Promise.resolve();
        }, 500);
    }



    // this method is called when the Device is added
    onAdded() {
        this.log('device added');
        this.log('name:', this.getName());
        this.log('class:', this.getClass());
        this.log('settings', this.getSettings());
    }

    // this method is called when the Device is deleted
    onDeleted() {
        this.log('device deleted');
    }

    onSettings(oldSettings, newSettings, changedKeys, callback) {
        this.log('settings changed', newSettings);
        callback(null);
    }

    sendKeyCommand(state, value) {
        this.log(value, state);
        this.postToSoundtouch('/key', '<key state="' + state + '" sender="Gabbo">' + value + '</key>');
    }

    setVolume(volume) {
        this.log('volume', volume);
        this.postToSoundtouch('/volume', '<volume>' + volume * 100 + '</volume>');
    }

    createZone() {
        this.log('create zone');
        this.postToSoundtouch('/setZone',
            '<zone master="' + this.getSettings().mac + '">\n' +
            '  <member ipaddress="$IPADDR">$MACADDR</member>\n' +
            '  ...\n' +
            '</zone>');
    }

    postToSoundtouch(uri, body) {
        Fetch('http://' + this.getSettings().ip + ':8090' + uri, {method: 'POST', body: body});
    }
}

module.exports = SoundtouchDevice;