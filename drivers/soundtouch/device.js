'use strict';

const Homey = require('homey');
const Fetch = require('node-fetch');
const XmlParser = require('xml2js').Parser();

const POLL_INTERVAL = 5000;

class SoundtouchDevice extends Homey.Device {

    // this method is called when the Device is inited
    onInit() {
        this._registerCapabilities();

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

        //poll playing state of speaker
        setInterval(() => {
            this.pollSpeakerState();
        }, POLL_INTERVAL)
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

    _registerCapabilities() {
        const capabilitySetMap = new Map([
            ['speaker_playing', this.play],
            ['speaker_prev', this.prev],
            ['speaker_next', this.next],
            ['volume_set', this.setVolume]
        ]);
        this.getCapabilities().forEach(capability =>
        this.registerCapabilityListener(capability, (value) => {
            return capabilitySetMap.get(capability).call(this, value)
                .catch(err => {
                    return Promise.reject(err);
                });
        }))
    }

    play(state) {
        if (state.speaker_playing === true) {
            this.sendKeyCommand('press', 'PLAY');
        } else {
            this.sendKeyCommand('press', 'PAUSE');
        }
    }

    prev(state) {
        this.sendKeyCommand('press', 'PREV_TRACK');
    }

    next(state) {
        this.sendKeyCommand('press', 'NEXT_TRACK');
    }

    setVolume(state) {
        this.sendVolumeCommand(state.volume_set);
    }

    sendKeyCommand(state, value) {
        this.log(value, state);
        this.postToSoundtouch('/key', '<key state="' + state + '" sender="Gabbo">' + value + '</key>');
    }

    sendVolumeCommand(volume) {
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
                    self.changeState('volume_set', parseInt(result.volume.targetvolume[0]) / 100);
                    self.changeState('volume_mute', (result.volume.muteenabled[0] === 'true'));
                });
            });
    }

    changeState(capability, value) {
        this.setCapabilityValue(capability, value);
    }
}

module.exports = SoundtouchDevice;