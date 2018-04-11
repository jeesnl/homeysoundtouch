'use strict';

const Homey = require('homey');
const Fetch = require('node-fetch');
const XmlParser = require('xml2js').Parser();

const POLL_INTERVAL = 5000;

class SoundtouchDevice extends Homey.Device {

    // this method is called when the Device is inited
    onInit() {
        this._registerCapabilities();

        this._startedPlayingTrigger = new Homey.FlowCardTriggerDevice('started_playing')
            .register();

        this._stoppedPlayingTrigger = new Homey.FlowCardTriggerDevice('stopped_playing')
            .register();

        const _isPlayingCondition = new Homey.FlowCardCondition('is_playing')
            .register()
            .registerRunListener((args, state) => {
                const playing = this.getCapabilityValue('speaker_playing', true);
                return Promise.resolve(playing);
            });

        const _isInZoneCondition = new Homey.FlowCardCondition('is_in_zone')
            .register()
            .registerRunListener(async (args, state) => {
                const isInZone = await this._getZone();
                return Promise.resolve(isInZone);
            });


        const _playPresetAction = new Homey.FlowCardAction('play_preset');
        _playPresetAction.register()
            .on('run', async (args, state, callback) => {
                this._sendKeyCommand('release', 'PRESET_' + args.preset_number);
                callback(null, true);
            });

        const _setBassCapability = new Homey.FlowCardAction('bass_capability');
        _setBassCapability.register()
            .on('run', async (args, state, callback) => {
                this._sendBassCommand(args.bass_number);
                callback(null, true);
            });

        const _createZoneWithAction = new Homey.FlowCardAction('create_zone_with');
        _createZoneWithAction.register()
            .on('run', (args, state, callback) => {
                this._createZone(args.slave);
                callback(null, true);
            });

        const _addSlaveToZoneAction = new Homey.FlowCardAction('add_slave_to_zone');
        _addSlaveToZoneAction.register()
            .on('run', (args, state, callback) => {
                this._addSlave(args.slave);
                callback(null, true);
            });

        const _removeSlaveFromZoneAction = new Homey.FlowCardAction('remove_slave_from_zone');
        _removeSlaveFromZoneAction.register()
            .on('run', (args, state, callback) => {
                this._removeFromZone(args.slave);
                callback(null, true);
            });

        //poll playing state of speaker
        setInterval(() => {
            this._pollSpeakerState();
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
            ['speaker_playing', this._play],
            ['speaker_prev', this._prev],
            ['speaker_next', this._next],
            ['volume_set', this._setVolume],
            ['volume_mute', this._setMute],
        ]);
        this.getCapabilities().forEach(capability =>
        this.registerCapabilityListener(capability, (value) => {
            return capabilitySetMap.get(capability).call(this, value)
                .catch(err => {
                    return Promise.reject(err);
                });
        }))
    }

    async _play(state) {
        try {
            if (state === true) {
                return Promise.resolve(await this._sendKeyCommand('press', 'PLAY'));
            } else {
                return Promise.resolve(await this._sendKeyCommand('press', 'PAUSE'));
            }
        } catch (e) {
            return Promise.reject(e);
        }
    }

    async _prev(state) {
        try {
            return Promise.resolve(await this._sendKeyCommand('press', 'PREV_TRACK'));
        } catch (e) {
            return Promise.reject(e);
        }
    }

    async _next(state) {
        try {
            return Promise.resolve(await this._sendKeyCommand('press', 'NEXT_TRACK'));
        } catch (e) {
            return Promise.reject(e);
        }
    }

    async _setVolume(volume) {
        try {
            return Promise.resolve(await this._sendVolumeCommand(volume));
        } catch (e) {
            return Promise.reject(e);
        }
    }

    async _setMute(mute) {
        try {
            if (mute) {
                if (!this.getCapabilityValue('volume_mute')) {
                    return Promise.resolve(await this._sendKeyCommand('press', 'MUTE'));
                }
            } else {
                if (this.getCapabilityValue('volume_mute')) {
                    return Promise.resolve(await this._sendKeyCommand('press', 'MUTE'));
                }
            }
        } catch (e) {
            return Promise.reject(e);
        }
    }

    async _sendKeyCommand(state, value) {
        this.log(value, state);
        try {
            return await this._postToSoundtouch('/key', '<key state="' + state + '" sender="Gabbo">' + value + '</key>');
        } catch (e) {
            return e;
        }
    }

    async _sendVolumeCommand(volume) {
        this.log('volume', volume);
        try {
            return await this._postToSoundtouch('/volume', '<volume>' + volume * 100 + '</volume>');
        } catch (e) {
            return e;
        }
    }

    async _sendBassCommand(bass) {
        this.log('bass', bass);
        try {
            return await this._postToSoundtouch('/bass', '<bass>' + bass + '</bass>');
        } catch (e) {
            return e;
        }
    }

    async _getZone() {
        try {
            const res = await Fetch('http://' + this.getSettings().ip + ':8090' + '/getZone', {method: 'GET'});
            const txt = await res.text();
            const jsObj = await this._parseXML(txt);
            if (jsObj.zone !== '') {
                return true;
            } else {
                return false;
            }
        } catch (e) {
            reject(e);
        }
    }

    async _createZone(slave) {
        this.log('create zone with', slave.getName());
        try {
            return await this._postToSoundtouch('/setZone',
                '<zone master="' + this.getData().mac + '">' +
                '<member ipaddress="' + slave.getSettings().ip + '">' + slave.getData().mac + '</member>' +
                '</zone>');
        } catch (e) {
            return e;
        }
    }

    async _addSlave(slave) {
        this.log('add slave to zone', slave.getName());
        try {
            return await this._postToSoundtouch('/addZoneSlave',
                '<zone master="' + this.getData().mac + '">' +
                '<member ipaddress="' + slave.getSettings().ip + '">' + slave.getData().mac + '</member>' +
                '</zone>');
        } catch (e) {
            return e;
        }
    }

    async _removeFromZone(slave) {
        this.log('remove from zone', slave.getName());
        try {
            return await this._postToSoundtouch('/removeZoneSlave',
                '<zone master="' + this.getData().mac + '">' +
                '<member ipaddress="' + slave.getSettings().ip + '">' + slave.getData().mac + '</member>' +
                '</zone>');
        } catch (e) {
            return e;
        }
    }

    async _postToSoundtouch(uri, body) {
            try {
                return await Fetch('http://' + this.getSettings().ip + ':8090' + uri, {method: 'POST', body: body});
            } catch (e) {
                return(e);
            }
    }

    async _pollSpeakerState() {
        try {
            const res = await  Fetch('http://' + this.getSettings().ip + ':8090' + '/now_playing', {method: 'GET'});
            const body = await res.text();
            const jsObj = await this._parseXML(body);
            const isAlreadyPlaying = this.getCapabilityValue('speaker_playing');
            if (jsObj.nowPlaying.$.source !== 'STANDBY' && jsObj.nowPlaying.playStatus[0] !== 'PAUSE_STATE') {
                if (!isAlreadyPlaying) {
                    this._startedPlayingTrigger.trigger(this, null).catch(e => console.log(e));
                }
                this.setCapabilityValue('speaker_playing', true);
            } else {
                if (isAlreadyPlaying) {
                    this._stoppedPlayingTrigger.trigger(this, null).catch(e => console.log(e));
                }
                this.setCapabilityValue('speaker_playing', false);
            }
        } catch (e) {
            return e;
        }
        try {
            const res = await  Fetch('http://' + this.getSettings().ip + ':8090' + '/volume', {method: 'GET'});
            const body = await res.text();
            const jsObj = await this._parseXML(body);
            this.setCapabilityValue('volume_set', parseInt(jsObj.volume.targetvolume[0]) / 100);
            this.setCapabilityValue('volume_mute', (jsObj.volume.muteenabled[0] === 'true'));
        } catch (e) {
            return e;
        }
    }

    async _parseXML(xml) {
        return new Promise((resolve, reject) => {
            XmlParser.parseString(xml, (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }
}

module.exports = SoundtouchDevice;