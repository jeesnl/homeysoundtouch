'use strict';

const Homey = require('homey');
const Fetch = require('node-fetch');
const XmlParser = require('xml2js').Parser();

class SoundtouchDevice extends Homey.Device {

    // this method is called when the Device is inited
    onInit() {
        this.log('device init');
        this.log(this.getState());

        const playPresetAction = new Homey.FlowCardAction('play_preset');
        playPresetAction.register()
            .on('run', async (args, state, callback) => {
                this.sendKeyCommand('release', 'PRESET_' + args.preset_number);
                callback(null, true);
            });

        const createZoneWithAction = new Homey.FlowCardAction('create_zone_with');
        createZoneWithAction.register()
            .on('run', (args, state, callback) => {
                this.createZone(args.slave);
                callback(null, true);
            });

        const removeSlaveFromZoneAction = new Homey.FlowCardAction('remove_slave_from_zone');
        removeSlaveFromZoneAction.register()
            .on('run', (args, state, callback) => {
                this.removeFromZone(args.slave);
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

        //poll playing state of speaker
        setInterval(() => {
            this.pollSpeakerState();
        }, 5000)
    }

    // this method is called when the Device is added
    onAdded() {
        this.log('device added');
        this.log('name:', this.getName());
        this.log('class:', this.getClass());
        this.log('settings', this.getSettings());
        this.log('data', this.getData());
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

    createZone(slave) {
        this.log('create zone with', slave.getName());
        this.postToSoundtouch('/setZone',
            '<zone master="' + this.getData().mac + '">' +
            '<member ipaddress="' + slave.getSettings().ip + '">' + slave.getData().mac + '</member>' +
            '</zone>');
    }

    removeFromZone(slave) {
        this.log('remove from zone', slave.getName());
        this.postToSoundtouch('/removeZoneSlave',
            '<zone master="' + this.getData().mac + '">' +
            '<member ipaddress="' + slave.getSettings().ip + '">' + slave.getData().mac + '</member>' +
            '</zone>');
    }

    postToSoundtouch(uri, body) {
        Fetch('http://' + this.getSettings().ip + ':8090' + uri, {method: 'POST', body: body});
    }

    pollSpeakerState() {
        const self = this;
        Fetch('http://' + this.getSettings().ip + ':8090' + '/now_playing', {method: 'GET'})
            .then(res => res.text())
            .then(body => {
                XmlParser.parseString(body, (err, result) => {
                    if (result.nowPlaying.$.source !== 'STANDBY') {
                        self.setCapabilityValue('speaker_playing', true);
                    } else {
                        self.setCapabilityValue('speaker_playing', false);
                    }
                });
            });

        Fetch('http://' + this.getSettings().ip + ':8090' + '/volume', {method: 'GET'})
            .then(res => res.text())
            .then(body => {
                XmlParser.parseString(body, (err, result) => {
                    self.setCapabilityValue('volume_set', parseInt(result.volume.targetvolume[0]) / 100);
                    self.setCapabilityValue('volume_mute', (result.volume.muteenabled[0] === 'true'));
                });
            });
    }
}

module.exports = SoundtouchDevice;