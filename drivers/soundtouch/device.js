'use strict';

const Homey = require('homey');
const Fetch = require('node-fetch');
const XmlParser = require('xml2js').Parser();
const Api = require('../../api/api.js');

const POLL_INTERVAL = 5000;

class SoundtouchDevice extends Homey.Device {

    // this method is called when the Device is inited
    onInit() {
        this._api = new Api(this.getSettings()._ip);
        this._registerCapabilities();

        this._startedPlayingTrigger = new Homey.FlowCardTriggerDevice('started_playing')
            .register();

        this._stoppedPlayingTrigger = new Homey.FlowCardTriggerDevice('stopped_playing')
            .register();

        this._volumeChangedTrigger = new Homey.FlowCardTriggerDevice('changed_volume')
            .register();

        const _isPlayingCondition = new Homey.FlowCardCondition('is_playing')
            .register()
            .registerRunListener((args, state) => {
                return Promise.resolve(this.getCapabilityValue('speaker_playing', true));
            });

        const _isInZoneCondition = new Homey.FlowCardCondition('is_in_zone')
            .register()
            .registerRunListener(async (args, state) => {
                try {
                    return Promise.resolve(await this._isInZone());
                } catch (e) {
                    return Promise.reject(e);
                }
            });

        const _playPresetAction = new Homey.FlowCardAction('play_preset')
            .register()
            .registerRunListener(async (args, state) => {
                try {
                    await this._sendKeyCommand('release', 'PRESET_' + args.preset_number);
                    return Promise.resolve(true);
                } catch (e) {
                    return Promise.reject(e);
                }
            });

        const _setBassCapability = new Homey.FlowCardAction('bass_capability')
            .register()
            .registerRunListener(async (args, state) => {
                try {
                    await this._sendBassCommand(args.bass_number);
                    return Promise.resolve(true);
                } catch (e) {
                    return Promise.reject(e);
                }
            });

        const _createZoneWithAction = new Homey.FlowCardAction('create_zone_with')
            .register()
            .registerRunListener(async (args, state) => {
                try {
                    await this._createZone(args.slave);
                    return Promise.resolve(true);
                } catch (e) {
                    return promise.reject(e);
                }
            });

        const _addSlaveToZoneAction = new Homey.FlowCardAction('add_slave_to_zone')
            .register()
            .registerRunListener(async (args, state) => {
                try {
                    await this._addSlave(args.slave);
                    return Promise.resolve(true);
                } catch (e) {
                    return Promise.reject(e);
                }
            });

        const _removeSlaveFromZoneAction = new Homey.FlowCardAction('remove_slave_from_zone')
            .register()
            .registerRunListener(async (args, state) => {
                try {
                    await this._removeFromZone(args.slave);
                    return Promise.resolve();
                } catch (e) {
                    return Promise.reject(e);
                }
            });

        const _togglePowerAction = new Homey.FlowCardAction('toggle_power')
            .register()
            .registerRunListener(async (args, state) => {
                try {
                    await this._sendKeyCommand('press', 'POWER');
                    return Promise.resolve();
                } catch (e) {
                    return Promise.reject(e);
                }
            });

        const _setSourceAction = new Homey.FlowCardAction('set_source')
            .register()
            .registerRunListener(async (args, state) => {
                try {
                    await this._setSource(args.source);
                    return Promise.resolve();
                } catch (e) {
                    return Promise.reject(e);
                }
            });


        if (this.bass === undefined) {
            this._getBassCapabilitiesAndSave();
        }

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
        this.log('play', state);
        try {
            if (state === true) {
                this.log('sending play');
                return Promise.resolve(await this._api.play());
            } else {
                this.log('sending pause');
                return Promise.resolve(await this._api.pause());
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
        if (!this.bass.available) {
            return Promise.reject('Bass not available');
        }
        const bassSteps = Math.abs(100 / (this.bass.min - this.bass.max));
        const bassLevel = this.bass.min + Math.round((bass * 100) / bassSteps);
        this.log('bass', bassLevel);
        try {
            return await this._postToSoundtouch('/bass', '<bass>' + bassLevel + '</bass>');
        } catch (e) {
            return e;
        }
    }

    async _isInZone() {
        try {
            const res = await this._getFromSoundtouch('/getZone');
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
                '<member ipaddress="' + slave.getSettings()._ip + '">' + slave.getData().mac + '</member>' +
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
                '<member ipaddress="' + slave.getSettings()._ip + '">' + slave.getData().mac + '</member>' +
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
                '<member ipaddress="' + slave.getSettings()._ip + '">' + slave.getData().mac + '</member>' +
                '</zone>');
        } catch (e) {
            return e;
        }
    }

    async _setSource(source) {
        this.log('select source', source);
        try {
            let body = '';
            if (source === 'aux') {
                body = '<ContentItem source="AUX" location="" sourceAccount=""></ContentItem>';
            } else if (source === 'bluetooth') {
                body = '<ContentItem source="BLUETOOTH" location="" sourceAccount=""></ContentItem>';
            }
            return await this._postToSoundtouch('/select', body);
        } catch (e) {
            return e;
        }
    }

    async _getBassCapabilitiesAndSave() {
        this.bass = {};
        try {
            const res = await this._getFromSoundtouch('/bassCapabilities');
            const txt = await res.text();
            const jsObj = await this._parseXML(txt);
            if (jsObj.bassCapabilities.bassAvailable[0] === 'true') {
                this.bass.available = true;
                this.bass.min = parseInt(jsObj.bassCapabilities.bassMin[0]);
                this.bass.max = parseInt(jsObj.bassCapabilities.bassMax[0]);
            } else {
                this.bass.available = false;
            }
            this.log('Bass capabilities ', this.bass);
            return Promise.resolve();
        } catch (e) {
            return e;
        }
    }

    async _postToSoundtouch(uri, body) {
            try {
                return await Fetch('http://' + this.getSettings()._ip + ':8090' + uri, {method: 'POST', body: body});
            } catch (e) {
                return(e);
            }
    }

    async _getFromSoundtouch(uri) {
        try {
            return await Fetch('http://' + this.getSettings()._ip + ':8090' + uri, {method: 'GET'});
        } catch (e) {
            return (e);
        }
    }

    async _pollSpeakerState() {
        try {
            const res = await this._getFromSoundtouch('/now_playing');
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
            const res = await this._getFromSoundtouch('/volume');
            const body = await res.text();
            const jsObj = await this._parseXML(body);
            const targetVolume = parseInt(jsObj.volume.targetvolume[0]) / 100;
            const mute = (jsObj.volume.muteenabled[0] === 'true');
            const token = {
                'volume': mute ? 0 : targetVolume
            };
            if (this.getCapabilityValue('volume_set') !== targetVolume || this.getCapabilityValue('volume_mute') !== mute) {
                this._volumeChangedTrigger.trigger(this, token).catch(e => console.log(e));
            }
            this.setCapabilityValue('volume_set', targetVolume);
            this.setCapabilityValue('volume_mute', mute);
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