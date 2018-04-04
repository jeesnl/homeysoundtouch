'use strict';

const Homey = require('homey');
const Fetch = require('node-fetch');
const XmlParser = require('xml2js').Parser();

const POLL_INTERVAL = 5000;

class SoundtouchDevice extends Homey.Device {

    // this method is called when the Device is inited
    onInit() {
        this._registerCapabilities();

        this.startedPlayingTrigger = new Homey.FlowCardTriggerDevice('started_playing')
            .register();

        this.stoppedPlayingTrigger = new Homey.FlowCardTriggerDevice('stopped_playing')
            .register();

        const isPlayingCondition = new Homey.FlowCardCondition('is_playing')
            .register()
            .registerRunListener((args, state) => {
                const playing = this.getCapabilityValue('speaker_playing', true);
                return Promise.resolve(playing);
            });

        const isInZoneCondition = new Homey.FlowCardCondition('is_in_zone')
            .register()
            .registerRunListener(async (args, state) => {
                const isInZone = await this.getZone();
                return Promise.resolve(isInZone);
            });


        const playPresetAction = new Homey.FlowCardAction('play_preset');
        playPresetAction.register()
            .on('run', async (args, state, callback) => {
                this.sendKeyCommand('release', 'PRESET_' + args.preset_number);
                callback(null, true);
            });

        const setBassCapability = new Homey.FlowCardAction('bass_capability');
        setBassCapability.register()
            .on('run', async (args, state, callback) => {
                this.sendBassCommand(args.bass_number);
                callback(null, true);
            });

        const createZoneWithAction = new Homey.FlowCardAction('create_zone_with');
        createZoneWithAction.register()
            .on('run', (args, state, callback) => {
                this.createZone(args.slave);
                callback(null, true);
            });

        const addSlaveToZone = new Homey.FlowCardAction('add_slave_to_zone');
        addSlaveToZone.register()
            .on('run', (args, state, callback) => {
                this.addSlave(args.slave);
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
        if (state === true) {
            this.sendKeyCommand('press', 'PLAY');
        } else {
            this.sendKeyCommand('press', 'PAUSE');
        }
        return Promise.resolve();
    }

    prev(state) {
        this.sendKeyCommand('press', 'PREV_TRACK');
        return Promise.resolve();
    }

    next(state) {
        this.sendKeyCommand('press', 'NEXT_TRACK');
        return Promise.resolve();
    }

    setVolume(volume) {
        this.log(volume);
        this.sendVolumeCommand(volume);
        return Promise.resolve();
    }

    sendKeyCommand(state, value) {
        this.log(value, state);
        this.postToSoundtouch('/key', '<key state="' + state + '" sender="Gabbo">' + value + '</key>');
    }

    sendVolumeCommand(volume) {
        this.log('volume', volume);
        this.postToSoundtouch('/volume', '<volume>' + volume * 100 + '</volume>');
    }

    sendBassCommand(bass) {
        this.log('bass', bass);
        this.postToSoundtouch('/bass', '<bass>' + bass + '</bass>');
    }

    async getZone() {
        return new Promise(async (resolve, reject) => {
            const res = await Fetch('http://' + this.getSettings().ip + ':8090' + '/getZone', {method: 'GET'});
            const txt = await res.text();
            XmlParser.parseString(txt, (err, result) => {
                if (result.zone !== '') {
                    resolve(true);
                } else {
                    resolve(false);
                }
            });
            reject(false);
        });
    }

    createZone(slave) {
        this.log('create zone with', slave.getName());
        this.postToSoundtouch('/setZone',
            '<zone master="' + this.getData().mac + '">' +
            '<member ipaddress="' + slave.getSettings().ip + '">' + slave.getData().mac + '</member>' +
            '</zone>');
    }

    addSlave(slave) {
        this.log('add slave to zone', slave.getName());
        this.postToSoundtouch('/addZoneSlave',
            '<zone master="' + this.getData().mac + '">' +
            '<member ipaddress="' + slave.getSettings().ip + '">' + slave.getData().mac + '</member>' +
            '</zone>')
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
                    if (result.nowPlaying.$.source !== 'STANDBY' && result.nowPlaying.playStatus[0] !== 'PAUSE_STATE') {
                        if (self.getCapabilityValue('speaker_playing') === false) {
                            self.startedPlayingTrigger.trigger(self, null).catch(e => console.log(e));
                        }
                        self.setCapabilityValue('speaker_playing', true);
                    } else {
                        if (self.getCapabilityValue('speaker_playing') === true) {
                            self.stoppedPlayingTrigger.trigger(self, null).catch(e => console.log(e));
                        }
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